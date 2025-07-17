# ClassCast

**ClassCast** is a secure, local-network file-sharing web app for teachers to share files with students on the same Wi-Fi. No cloud, no accounts—just fast, safe sharing in the classroom.

## Features
- Teacher uploads a file, gets a 6-digit code and QR code for students.
- Students enter code or scan QR to download the file.
- Files expire after 10 minutes or after first download (configurable).
- Supports PDF, PPTX, PNG, JPEG (max 50MB).
- All events logged with timestamp, code, IP, and action.
- Rate-limited to prevent brute force.
- Secure: filenames sanitized, no directory traversal, CORS restricted to LAN.

## Project Structure
```
server.js
public/
  teacher.html
  student.html
  qrcode.min.js
  styles.css
  teacher.js
  student.js
uploads/
package.json
```

## Installation
1. **Clone the repo:**
   ```sh
   git clone <repo-url> classcast
   cd classcast
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **Run the server:**
   ```sh
   node server.js
   ```

## Usage
1. **Find your LAN IP:**
   - On Mac/Linux: `ifconfig | grep inet`
   - On Windows: `ipconfig`
   - Look for an address like `192.168.x.y` (not 127.0.0.1).
2. **Teacher:**
   - Open `http://<your-lan-ip>:3000/teacher` in browser.
   - Upload a file. Share the 6-digit code or QR code with students.
3. **Students:**
   - Open `http://<your-lan-ip>:3000/student` in browser.
   - Enter the code or scan the QR code to download the file.

## Testing
- **Upload valid & invalid files:** Try PDF, PPTX, PNG, JPEG, and other types (should reject invalid types).
- **Zero-byte/oversized files:** Try uploading empty or >50MB files (should show error).
- **Multiple students:** Use several devices to download with the same code (file expires after first download).
- **File expiry:** Wait 10 minutes and try to download (should show expired).
- **Rapid invalid code attempts:** Enter wrong codes repeatedly to test rate-limiting (should block after 10 tries per 10 min).
- **File deletion:** Check `uploads/`—files should be deleted after expiry or download.
- **Teacher PIN:** UI supports PIN entry, but server does not enforce it (can be added).
- **Server restart:** In-memory codes are lost; warn teacher to re-upload if server restarts.

## Security Notes
- Only accessible from LAN (CORS restricted).
- All filenames sanitized, no directory traversal.
- HTTPS optional (see server.js for self-signed cert setup).

## License
MIT 