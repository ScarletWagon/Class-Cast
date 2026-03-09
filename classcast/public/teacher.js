// teacher.js - Handles file upload, code display, QR, timer for ClassCast Teacher
// Requires QRCode.js (qrcode.min.js)

const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const resultSection = document.getElementById('resultSection');
const codeDisplay = document.getElementById('codeDisplay');
const qrDiv = document.getElementById('qr');
const timerDiv = document.getElementById('timer');
const fileInfo = document.getElementById('fileInfo');
const errorSection = document.getElementById('errorSection');
const pinInput = document.getElementById('pinInput');

let timerInterval = null;

// Fetch tunnel URL once on load; fall back to current host if not available.
// Polls until the tunnel is ready (cloudflared can take a few seconds to connect).
let baseUrl = `${window.location.protocol}//${window.location.host}`;

async function fetchConfig(attemptsLeft = 20) {
  try {
    const r = await fetch('/config');
    const cfg = await r.json();
    if (cfg.tunnelUrl) {
      baseUrl = cfg.tunnelUrl;
      return;
    }
  } catch (_) {}
  // Not ready yet — retry after 1.5s (up to ~30s total)
  if (attemptsLeft > 0) {
    await new Promise(res => setTimeout(res, 1500));
    return fetchConfig(attemptsLeft - 1);
  }
  // Gave up — baseUrl stays as LAN host, which still works on local network
}

// Kick off config fetch immediately; upload can happen before it resolves,
// showResult() will await it before building the QR URL.
const configReady = fetchConfig();

// --- Drag & Drop ---
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    fileInput.files = e.dataTransfer.files;
  }
});

// --- Upload Handler ---
uploadForm.addEventListener('submit', async e => {
  e.preventDefault();
  errorSection.textContent = '';
  resultSection.style.display = 'none';
  if (!fileInput.files[0]) {
    errorSection.textContent = 'Please select a file.';
    return;
  }
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  // Optionally add PIN (not enforced server-side yet)
  if (pinInput.value) formData.append('pin', pinInput.value);
  try {
    const res = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      errorSection.textContent = data.error || 'Upload failed.';
      return;
    }
    showResult(data);
  } catch (err) {
    errorSection.textContent = 'Network error.';
  }
});

function showResult(data) {
  resultSection.style.display = '';
  codeDisplay.textContent = data.code;
  fileInfo.textContent = `File: ${data.file}`;

  // Wait for tunnel URL to be confirmed before generating QR/link
  configReady.then(() => {
    const url = `${baseUrl}/student?code=${data.code}`;
    qrDiv.innerHTML = '';
    new QRCode(qrDiv, { text: url, width: 180, height: 180 });

    const urlLabel = document.createElement('p');
    urlLabel.className = 'qr-url';
    urlLabel.textContent = url;
    qrDiv.appendChild(urlLabel);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy link';
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 2000);
      });
    });
    qrDiv.appendChild(copyBtn);
  });

  // Start timer immediately regardless
  let seconds = data.expiresIn;
  timerDiv.textContent = formatTimer(seconds);
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      timerDiv.textContent = 'Expired';
      clearInterval(timerInterval);
    } else {
      timerDiv.textContent = formatTimer(seconds);
    }
  }, 1000);
}

function formatTimer(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `Expires in: ${m}:${s.toString().padStart(2, '0')}`;
} 