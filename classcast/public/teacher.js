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
  // Build download URL for QR
  const url = `${window.location.protocol}//${window.location.host}/download?code=${data.code}`;
  qrDiv.innerHTML = '';
  new QRCode(qrDiv, {
    text: url,
    width: 180,
    height: 180
  });
  // Timer
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