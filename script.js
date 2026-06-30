/* =========================================
   ESP32 Flasher Pro — script.js (Fixed)
   =========================================
   Key fixes:
   - Correct ESPLoader constructor (0.4.x API)
   - Proper terminal object for ESPLoader
   - event passed explicitly to switchTab
   - Serial monitor enable/disable state
   - chipFeatures populated
   - Progress percent display
   ========================================= */

let port;
let esploader;
let transport;
let deviceConnected = false;
let reader;
let availableProjects = {};
let currentProject = null;

// UI Elements
const connectBtn       = document.getElementById('btnConnect');
const resetBtn         = document.getElementById('btnReset');
const eraseBtn         = document.getElementById('btnErase');
const programBtn       = document.getElementById('btnProgram');
const autoFlashBtn     = document.getElementById('btnAutoFlash');
const consoleDiv       = document.getElementById('console');
const progressBar      = document.getElementById('progressBar');
const progressText     = document.getElementById('progressText');
const progressPercent  = document.getElementById('progressPercent');
const autoProgressBar  = document.getElementById('autoProgressBar');
const autoProgressText = document.getElementById('autoProgressText');
const chipTypeEl       = document.getElementById('chipType');
const macAddrEl        = document.getElementById('macAddr');
const chipFeaturesEl   = document.getElementById('chipFeatures');
const flashSizeEl      = document.getElementById('flashSize');
const connectionStatus = document.getElementById('connectionStatus');
const statusText       = document.getElementById('statusText');
const projectSelect    = document.getElementById('projectSelect');
const firmwareInfo     = document.getElementById('firmwareInfo');
const firmwareList     = document.getElementById('firmwareList');
const serialInput      = document.getElementById('serialInput');
const btnSend          = document.getElementById('btnSend');

// Firmware repo config
const FIRMWARE_BASE_URL = 'firmware';
const REPO_CONFIG_URL   = `${FIRMWARE_BASE_URL}/projects.json`;

// ─── Terminal object required by ESPLoader ─────────────────────────────────
const loaderTerminal = {
  clean() { /* no-op: we manage our own console */ },
  writeLine(data) { appendToConsole(String(data), 'receive'); },
  write(data)     { appendToConsole(String(data), 'receive'); },
};

// ─── 1. CONNECTION MANAGER ─────────────────────────────────────────────────

connectBtn.addEventListener('click', async () => {
  if (deviceConnected) { await disconnect(); return; }

  if (!navigator.serial) {
    return alert('Web Serial API not supported. Please use Chrome or Edge.');
  }

  try {
    port = await navigator.serial.requestPort();
    const baudRate = parseInt(document.getElementById('baudRate').value, 10);

    updateStatus('connecting', 'Connecting…');
    appendToConsole('Requesting port…', 'system');

    transport = new Transport(port, true);

    const flashOptions = {
      transport,
      baudrate: baudRate,
      terminal: loaderTerminal,
    };

    esploader = new ESPLoader(flashOptions);

    appendToConsole('Syncing with chip…', 'system');
    const chip = await esploader.main();

    // Populate device info
    chipTypeEl.textContent     = chip || 'ESP32';
    macAddrEl.textContent      = await esploader.chip.get_mac(esploader);
    chipFeaturesEl.textContent = (await esploader.chip.get_chip_features(esploader)).join(', ') || '—';
    flashSizeEl.textContent    = await esploader.get_flash_size() || '—';

    deviceConnected = true;
    updateStatus('connected', 'Connected');
    connectBtn.innerHTML = '<i class="fa-solid fa-link-slash"></i> <span>Disconnect</span>';

    programBtn.disabled   = false;
    resetBtn.disabled     = false;
    eraseBtn.disabled     = false;
    serialInput.disabled  = false;
    btnSend.disabled      = false;

    // Enable auto flash if project already selected
    if (currentProject) autoFlashBtn.disabled = false;

    appendToConsole(`Connected to ${chip}`, 'system');
    readLoop();

  } catch (e) {
    console.error(e);
    appendToConsole('Connection failed: ' + e.message, 'system');
    alert('Connection failed: ' + e.message);
    updateStatus('disconnected', 'Disconnected');

    // Cleanup
    try { if (transport) await transport.disconnect(); } catch (_) {}
    transport  = null;
    esploader  = null;
  }
});

async function disconnect() {
  try {
    if (reader)    { await reader.cancel(); reader = null; }
    if (transport) { await transport.disconnect(); transport = null; }
  } catch (e) { console.warn('Disconnect error:', e); }

  esploader     = null;
  deviceConnected = false;
  updateStatus('disconnected', 'Disconnected');
  connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> <span>Connect Device</span>';

  programBtn.disabled   = true;
  autoFlashBtn.disabled = true;
  resetBtn.disabled     = true;
  eraseBtn.disabled     = true;
  serialInput.disabled  = true;
  btnSend.disabled      = true;

  chipTypeEl.textContent     = '—';
  macAddrEl.textContent      = '—';
  chipFeaturesEl.textContent = '—';
  flashSizeEl.textContent    = '—';

  appendToConsole('Disconnected.', 'system');
}

function updateStatus(state, text) {
  connectionStatus.className = `status-indicator ${state}`;
  statusText.textContent = text;
}

// ─── 2. FIRMWARE REPOSITORY LOADER ────────────────────────────────────────

async function loadAvailableFirmware() {
  try {
    const response = await fetch(REPO_CONFIG_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const config = await response.json();
    availableProjects = config.projects || {};

    projectSelect.innerHTML = '<option value="">Choose a project…</option>';
    for (const [name, info] of Object.entries(availableProjects)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name}${info.version ? ` (v${info.version})` : ''}`;
      projectSelect.appendChild(opt);
    }
  } catch (err) {
    console.warn('Firmware list unavailable:', err);
    projectSelect.innerHTML = '<option value="">No projects found</option>';
    autoProgressText.textContent = 'Could not load firmware list';
  }
}

projectSelect.addEventListener('change', function () {
  const name = this.value;
  currentProject = availableProjects[name] || null;

  if (currentProject) {
    displayFirmwareInfo(currentProject);
    firmwareInfo.style.display = 'flex';
    autoFlashBtn.disabled = !deviceConnected;
  } else {
    firmwareInfo.style.display = 'none';
    firmwareList.innerHTML = '';
    autoFlashBtn.disabled = true;
  }
});

function displayFirmwareInfo(project) {
  const files = project.files || [];
  let totalSize = 0;

  firmwareList.innerHTML = '';
  files.forEach(file => {
    totalSize += file.size || 0;
    const item = document.createElement('div');
    item.className = 'firmware-item';
    item.innerHTML = `
      <div class="file-info">
        <i class="fa-solid fa-file-code"></i>
        <span class="file-name">${escapeHtml(file.name)}</span>
        <span class="file-size">${formatFileSize(file.size)}</span>
      </div>
      <div class="file-address">
        <code>0x${file.address.toString(16).toUpperCase().padStart(8, '0')}</code>
      </div>
    `;
    firmwareList.appendChild(item);
  });

  document.getElementById('firmwareCount').textContent = files.length;
  document.getElementById('firmwareSize').textContent  = formatFileSize(totalSize);
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── 3. AUTO-FLASH ────────────────────────────────────────────────────────

autoFlashBtn.addEventListener('click', async () => {
  if (!deviceConnected || !currentProject) return;

  const files = currentProject.files || [];
  if (!files.length) return alert('No firmware files in this project.');

  autoFlashBtn.disabled = true;
  setAutoProgress(10, 'active', 'Downloading firmware…');

  try {
    const fileArray = [];
    let downloaded = 0;

    for (const fileInfo of files) {
      const url = fileInfo.url || `${FIRMWARE_BASE_URL}/${currentProject.path}/${fileInfo.name}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to download ${fileInfo.name}`);

      const blob = await resp.blob();
      const data = await readFileAsArrayBuffer(blob);

      fileArray.push({ data, address: fileInfo.address });
      downloaded++;
      setAutoProgress(10 + (downloaded / files.length) * 40, 'active',
        `Downloading ${downloaded}/${files.length}…`);
    }

    if (document.getElementById('eraseFlash').checked) {
      setAutoProgress(55, 'active', 'Erasing flash…');
      await esploader.erase_flash();
    }

    setAutoProgress(65, 'active', 'Writing firmware…');

    await esploader.write_flash({
      fileArray,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll:  false,
      compress:  true,
      reportProgress(fileIndex, written, total) {
        const pct = Math.round((written / total) * 100);
        setAutoProgress(65 + (written / total) * 30, 'active', `Writing… ${pct}%`);
      },
    });

    setAutoProgress(100, 'success', '✓ Flash complete! Resetting…');
    await resetDevice();

    setTimeout(() => {
      setAutoProgress(0, '', 'Ready for next flash');
      autoFlashBtn.disabled = false;
    }, 2500);

  } catch (err) {
    console.error('Auto-flash failed:', err);
    setAutoProgress(autoProgressBar.style.width.replace('%', '') || 0, 'error',
      'Error: ' + err.message);
    autoFlashBtn.disabled = false;
  }
});

function setAutoProgress(pct, state, msg) {
  autoProgressBar.style.width = `${pct}%`;
  autoProgressBar.className   = `progress-bar${state ? ' ' + state : ''}`;
  autoProgressText.textContent = msg;
}

// ─── 4. MANUAL FLASH ──────────────────────────────────────────────────────

programBtn.addEventListener('click', async () => {
  if (!deviceConnected) return;

  const rows = document.querySelectorAll('.file-row');
  const fileArray = [];

  for (const row of rows) {
    const fileInput   = row.querySelector('.file-input');
    const offsetInput = row.querySelector('.offset-input');
    const file        = fileInput.files[0];
    if (!file) continue;

    const data    = await readFileAsArrayBuffer(file);
    const address = offsetInput.value.startsWith('0x')
      ? parseInt(offsetInput.value, 16)
      : parseInt(offsetInput.value, 10);

    fileArray.push({ data, address });
  }

  if (!fileArray.length) return alert('No files selected.');

  programBtn.disabled = true;
  setProgress(0, 'active', 'Preparing…');

  try {
    if (document.getElementById('eraseFlash').checked) {
      setProgress(5, 'active', 'Erasing flash…');
      await esploader.erase_flash();
    }

    await esploader.write_flash({
      fileArray,
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll:  false,
      compress:  true,
      reportProgress(fileIndex, written, total) {
        const pct = Math.round((written / total) * 100);
        setProgress(pct, 'active', `Writing… ${pct}%`, `${pct}%`);
      },
    });

    setProgress(100, 'success', '✓ Done! Resetting device…', '100%');
    await resetDevice();

    setTimeout(() => {
      setProgress(0, '', 'Ready to flash', '');
      programBtn.disabled = false;
    }, 2500);

  } catch (e) {
    setProgress(autoProgressBar.style.width.replace('%', '') || 0, 'error',
      'Error: ' + e.message, '');
    programBtn.disabled = false;
  }
});

function setProgress(pct, state, msg, pctLabel = '') {
  progressBar.style.width   = `${pct}%`;
  progressBar.className     = `progress-bar${state ? ' ' + state : ''}`;
  progressText.textContent  = msg;
  if (progressPercent) progressPercent.textContent = pctLabel;
}

// ─── 5. HELPERS ───────────────────────────────────────────────────────────

const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = (e) => resolve(e.target.result);
    fr.onerror = reject;
    fr.readAsArrayBuffer(file);
  });

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Add File Row
document.getElementById('btnAddRow').addEventListener('click', () => {
  const list = document.getElementById('fileList');
  const row  = document.createElement('div');
  row.className = 'file-row';
  row.innerHTML = `
    <input type="text" class="offset-input" value="0x10000" placeholder="0x10000" title="Flash address">
    <div class="file-input-wrapper">
      <input type="file" class="gh-input-file file-input" accept=".bin">
    </div>
    <button class="gh-btn-icon remove-row" title="Remove"><i class="fa-solid fa-xmark"></i></button>
  `;
  list.appendChild(row);
  row.querySelector('.remove-row').addEventListener('click', () => row.remove());
});

// ─── 6. SERIAL MONITOR ────────────────────────────────────────────────────

async function readLoop() {
  while (port && port.readable && deviceConnected) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        appendToConsole(new TextDecoder().decode(value), 'receive');
      }
    } catch (err) {
      if (deviceConnected) console.error('Serial read error:', err);
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

function appendToConsole(text, type = 'receive') {
  const lines = text.split('\n');
  lines.forEach(line => {
    if (!line.trim()) return;
    const div = document.createElement('div');
    div.className = `term-line ${type}`;

    const prompt = type === 'send' ? '$' : type === 'system' ? '#' : '›';
    div.innerHTML = `<span class="term-prompt">${prompt}</span><span>${escapeHtml(line)}</span>`;

    consoleDiv.appendChild(div);
  });
  consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

document.getElementById('btnSend').addEventListener('click', sendSerialData);
serialInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendSerialData(); });

async function sendSerialData() {
  const text = serialInput.value.trim();
  if (!text || !port || !deviceConnected) return;

  appendToConsole(text, 'send');
  serialInput.value = '';

  try {
    const writer  = port.writable.getWriter();
    const encoded = new TextEncoder().encode(text + '\n');
    await writer.write(encoded);
    writer.releaseLock();
  } catch (err) {
    console.error('Serial write error:', err);
    appendToConsole('Write error: ' + err.message, 'system');
  }
}

document.getElementById('btnClearConsole').addEventListener('click', () => {
  consoleDiv.innerHTML = '';
  appendToConsole('Console cleared.', 'system');
});

// ─── 7. DEVICE CONTROLS ───────────────────────────────────────────────────

resetBtn.addEventListener('click', async () => {
  if (!transport) return;
  await resetDevice();
  appendToConsole('Device reset.', 'system');
});

async function resetDevice() {
  try {
    await transport.setDTR(false);
    await transport.setRTS(true);
    await new Promise(r => setTimeout(r, 100));
    await transport.setDTR(true);
    await transport.setRTS(false);
  } catch (e) { console.warn('Reset error:', e); }
}

eraseBtn.addEventListener('click', async () => {
  if (!deviceConnected) return;
  if (!confirm('This will erase ALL flash memory. Continue?')) return;

  try {
    setProgress(0, 'active', 'Erasing entire flash…');
    await esploader.erase_flash();
    setProgress(100, 'success', '✓ Erase complete!', '');
    appendToConsole('Full erase complete.', 'system');

    setTimeout(() => {
      setProgress(0, '', 'Ready to flash', '');
    }, 2000);
  } catch (err) {
    setProgress(0, 'error', 'Erase failed: ' + err.message, '');
  }
});

// ─── 8. TABS ──────────────────────────────────────────────────────────────

window.switchTab = (tabId, event) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

// ─── INIT ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.log('ESP32 Flasher Pro ready.');
});
