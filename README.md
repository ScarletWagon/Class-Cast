# ClassCast

**ClassCast** is a secure, local-network file-sharing web app for teachers to share files with students in the classroom. No cloud, no accounts—just fast, safe sharing over Wi-Fi.

## Features

- Teacher uploads a file, receives a 6-digit code and QR code for students.
- Students enter the code or scan the QR to download the file.
- Files expire after 10 minutes or after first download.
- Supports PDF, PPTX, PNG, JPEG (max 50MB).
- All events logged with timestamp, code, IP, and action.
- Rate-limited to prevent brute force.
- Secure: filenames sanitized, no directory traversal, CORS restricted to LAN.

## Folder Structure

```
.gitattributes
.gitignore
.github/
  workflows/
    static.yml
classcast/
  package.json
  README.md
  server.js
  public/
    qrcode.min.js
    student.html
    student.js
    styles.css
    teacher.html
    teacher.js
  uploads/
    <uploaded files>
```

## Installation

1. **Clone the repo:**
   ```sh
   git clone <repo-url> Class-Cast
   cd Class-Cast/classcast
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Run the server:**
   ```sh
   npm start
   ```

## Usage

1. **Find your LAN IP:**
   - On Mac/Linux: `ifconfig | grep inet`
   - On Windows: `ipconfig`
   - Look for an address like `192.168.x.y` (not 127.0.0.1).
2. **Teacher:**
   - Open `http://<your-lan-ip>:3000/teacher` in your browser.
   - Upload a file. Share the 6-digit code or QR code with students.
3. **Students:**
   - Open `http://<your-lan-ip>:3000/student` in your browser.
   - Enter the code or scan the QR code to download the file.

## Testing

- **Upload valid & invalid files:** Try PDF, PPTX, PNG, JPEG, and other types (should reject invalid types).
- **Zero-byte/oversized files:** Try uploading empty or >50MB files (should show error).
- **Multiple students:** Use several devices to download with the same code (file expires after first download).
- **File expiry:** Wait 10 minutes and try to download (should show expired).
- **Rapid invalid code attempts:** Enter wrong codes repeatedly to test rate-limiting (should block after 10 tries per 10 min).
- **File deletion:** Check `uploads/`—files should be deleted after expiry or download.
- **Teacher PIN:** UI supports PIN entry, and server enforces it.
- **Server restart:** In-memory codes are lost; re-upload if server restarts.

## Security Notes

- Only accessible from LAN (CORS restricted).
- All filenames sanitized, no directory traversal.
- HTTPS optional (see server.js for self-signed cert setup).

## License

MIT