// server.js
// ClassCast: Secure LAN file sharing server
// Express server setup with static file serving and LAN-restricted CORS
// See: https://expressjs.com/ and https://www.npmjs.com/package/cors

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const rateLimit = require('express-rate-limit'); // npm install express-rate-limit

const app = express();
const PORT = process.env.PORT || 3000;

// --- LAN IP detection helper ---
function getLocalIPs() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// --- CORS: Only allow requests from LAN IPs ---
const lanIPs = getLocalIPs();
const allowedOrigins = lanIPs.map(ip => `http://${ip}:${PORT}`);
allowedOrigins.push(`http://localhost:${PORT}`);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Not allowed by ClassCast LAN policy'), false);
  }
}));

// --- Multer setup for file uploads ---
const multer = require('multer');
const sanitize = require('sanitize-filename'); // npm install sanitize-filename

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitize original name, prepend timestamp
    const safeName = sanitize(file.originalname).replace(/\s+/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safeName}`);
  }
});

// Allowed MIME types
const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'image/png',
  'image/jpeg'
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: function (req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, PPTX, PNG, JPEG allowed.'));
    }
  }
});

// --- In-memory map: code -> file metadata/path/expiry ---
const fileMap = {}; // { code: { path, originalName, size, mimetype, expiresAt, downloaded, uploadTime } }
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// --- Logging helper ---
function logEvent(action, code, req, extra = {}) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const time = new Date().toISOString();
  console.log(`[${time}] [${ip}] [${action}] code=${code} ${JSON.stringify(extra)}`);
}

// --- POST /upload ---
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      // Multer error (file type, size, etc)
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    if (req.file.size === 0) {
      // Remove zero-byte file
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Cannot upload zero-byte file.' });
    }
    // Generate random 6-digit code
    let code;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (fileMap[code]);
    // Store metadata, including PIN if provided
    const now = Date.now();
    const pin = req.body.pin || (req.body && req.body.get && req.body.get('pin')) || (req.query && req.query.pin) || '';
    fileMap[code] = {
      path: req.file.path,
      originalName: req.file.originalname,
      safeName: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      expiresAt: now + CODE_EXPIRY_MS,
      downloaded: false,
      uploadTime: now,
      pin: pin ? String(pin) : undefined
    };
    logEvent('UPLOAD', code, req, { file: req.file.filename, size: req.file.size, pin: pin ? 'set' : 'none' });
    res.json({ code, expiresIn: CODE_EXPIRY_MS / 1000, file: req.file.originalname, pinRequired: !!pin });
  });
});

// --- Rate limiting for /download: 10 attempts per 10 minutes per IP ---
const downloadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // limit each IP to 10 download attempts per windowMs
  message: { error: 'Too many download attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- GET /download?code=123456&pin=xxxx ---
app.get('/download', downloadLimiter, (req, res) => {
  const code = req.query.code;
  const pin = req.query.pin;
  if (!code || !/^[0-9]{6}$/.test(code)) {
    return res.status(404).json({ error: 'Invalid or missing code.' });
  }
  const entry = fileMap[code];
  if (!entry) {
    return res.status(404).json({ error: 'Code not found or expired.' });
  }
  if (entry.expiresAt < Date.now()) {
    if (fs.existsSync(entry.path)) fs.unlink(entry.path, () => {});
    delete fileMap[code];
    logEvent('DOWNLOAD_EXPIRED', code, req);
    return res.status(410).json({ error: 'File expired.' });
  }
  if (!fs.existsSync(entry.path)) {
    delete fileMap[code];
    logEvent('DOWNLOAD_MISSING', code, req);
    return res.status(410).json({ error: 'File deleted before download.' });
  }
  if (entry.pin) {
    if (!pin || String(pin) !== String(entry.pin)) {
      logEvent('DOWNLOAD_PIN_FAIL', code, req);
      return res.status(401).json({ error: 'PIN required or incorrect.' });
    }
  }
  res.download(entry.path, entry.originalName, err => {
    if (!err) {
      logEvent('DOWNLOAD', code, req, { file: entry.safeName });
    } else {
      logEvent('DOWNLOAD_ERROR', code, req, { error: err.message });
    }
  });
});

// --- HEAD /download?code=123456&pin=xxxx (for student metadata fetch) ---
app.head('/download', downloadLimiter, (req, res) => {
  const code = req.query.code;
  const pin = req.query.pin;
  if (!code || !/^[0-9]{6}$/.test(code)) {
    return res.status(404).end();
  }
  const entry = fileMap[code];
  if (!entry) {
    return res.status(404).end();
  }
  if (entry.expiresAt < Date.now()) {
    if (fs.existsSync(entry.path)) fs.unlink(entry.path, () => {});
    delete fileMap[code];
    return res.status(410).end();
  }
  if (!fs.existsSync(entry.path)) {
    delete fileMap[code];
    return res.status(410).end();
  }
  if (entry.pin) {
    if (!pin || String(pin) !== String(entry.pin)) {
      return res.status(401).end();
    }
  }
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(entry.originalName)}"`);
  res.setHeader('Content-Length', entry.size);
  res.status(200).end();
});

// --- Periodic cleanup: delete expired files and codes every minute ---
setInterval(() => {
  const now = Date.now();
  for (const code in fileMap) {
    const entry = fileMap[code];
    if (entry.expiresAt < now) {
      if (fs.existsSync(entry.path)) {
        fs.unlink(entry.path, () => {});
      }
      delete fileMap[code];
      // No req object, so log manually
      console.log(`[${new Date().toISOString()}] [CLEANUP] code=${code} expired and deleted.`);
    }
  }
}, 60 * 1000); // every 60 seconds

// --- Serve static frontend from public/ ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Placeholder for further routes (upload/download) ---

// --- Start HTTP server (HTTPS optional, see below) ---
http.createServer(app).listen(PORT, () => {
  console.log(`ClassCast server running on:`);
  lanIPs.forEach(ip => {
    console.log(`  http://${ip}:${PORT}/teacher`);
    console.log(`  http://${ip}:${PORT}/student`);
  });
  console.log(`  http://localhost:${PORT}/teacher`);
});

// --- Optional: HTTPS support (uncomment to use self-signed certs) ---
// const sslOptions = {
//   key: fs.readFileSync('key.pem'),
//   cert: fs.readFileSync('cert.pem')
// };
// https.createServer(sslOptions, app).listen(3443, () => {
//   console.log('HTTPS server running on port 3443');
// });

// --- End of server.js basic setup --- 