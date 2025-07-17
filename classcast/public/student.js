// student.js - Handles code input, file info, and download for ClassCast Student

const codeForm = document.getElementById('codeForm');
const codeInput = document.getElementById('codeInput');
const fileSection = document.getElementById('fileSection');
const fileMeta = document.getElementById('fileMeta');
const downloadBtn = document.getElementById('downloadBtn');
const errorSection = document.getElementById('errorSection');

let currentCode = null;
let currentMeta = null;
let currentPin = '';

const pinPrompt = document.createElement('div');
pinPrompt.innerHTML = '<label for="pinInput">PIN:</label> <input type="password" id="pinInput" maxlength="16" />';
pinPrompt.style.display = 'none';
codeForm.appendChild(pinPrompt);
const pinInput = pinPrompt.querySelector('#pinInput');

codeForm.addEventListener('submit', async e => {
  e.preventDefault();
  errorSection.textContent = '';
  fileSection.style.display = 'none';
  pinPrompt.style.display = 'none';
  const code = codeInput.value.trim();
  let pin = pinInput.value.trim();
  if (!/^[0-9]{6}$/.test(code)) {
    errorSection.textContent = 'Please enter a valid 6-digit code.';
    return;
  }
  // Try to fetch metadata (HEAD request)
  try {
    let url = `/download?code=${code}`;
    if (pin) url += `&pin=${encodeURIComponent(pin)}`;
    let res = await fetch(url, { method: 'HEAD' });
    if (res.status === 401) {
      // PIN required or incorrect
      pinPrompt.style.display = '';
      errorSection.textContent = 'PIN required or incorrect.';
      return;
    }
    if (res.status === 404 || res.status === 410) {
      errorSection.textContent = 'Code invalid or expired.';
      return;
    }
    // If valid, try to get filename/size from headers
    const disp = res.headers.get('Content-Disposition');
    const size = res.headers.get('Content-Length');
    let filename = 'file';
    if (disp) {
      const match = disp.match(/filename="?([^";]+)"?/);
      if (match) filename = decodeURIComponent(match[1]);
    }
    fileMeta.textContent = `File: ${filename} (${formatSize(size)})`;
    fileSection.style.display = '';
    currentCode = code;
    currentMeta = { filename, size };
    currentPin = pin;
  } catch (err) {
    errorSection.textContent = 'Network error.';
  }
});

downloadBtn.addEventListener('click', () => {
  if (!currentCode) return;
  let url = `/download?code=${currentCode}`;
  if (currentPin) url += `&pin=${encodeURIComponent(currentPin)}`;
  window.location = url;
});

function formatSize(bytes) {
  if (!bytes) return '';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
} 