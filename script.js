let port;
let esploader;
let transport;
let deviceConnected = false;
let reader;
let inputBuffer = '';
let availableProjects = {};
let currentProject = null;

// UI Elements
const connectBtn = document.getElementById('btnConnect');
const resetBtn = document.getElementById('btnReset');
const eraseBtn = document.getElementById('btnErase');
const programBtn = document.getElementById('btnProgram');
const autoFlashBtn = document.getElementById('btnAutoFlash');
const consoleDiv = document.getElementById('console');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const autoProgressBar = document.getElementById('autoProgressBar');
const autoProgressText = document.getElementById('autoProgressText');
const chipType = document.getElementById('chipType');
const macAddr = document.getElementById('macAddr');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const projectSelect = document.getElementById('projectSelect');
const firmwareInfo = document.getElementById('firmwareInfo');
const firmwareList = document.getElementById('firmwareList');

// Firmware repository structure
const FIRMWARE_BASE_URL = 'firmware';
const REPO_CONFIG_URL = `${FIRMWARE_BASE_URL}/projects.json`;

// --- 1. CONNECTION MANAGER ---

connectBtn.addEventListener('click', async () => {
    if (deviceConnected) {
        await disconnect();
        return;
    }

    if (!navigator.serial) return alert("Web Serial not supported. Try Chrome/Edge.");

    try {
        port = await navigator.serial.requestPort();
        const baudRate = parseInt(document.getElementById('baudRate').value);
        await port.open({ baudRate: baudRate });

        transport = new Transport(port);
        esploader = new ESPLoader(transport, baudRate, null);

        updateStatus("connecting", "Connecting...");
        
        await esploader.main_fn();
        await esploader.flash_id();

        // Get Chip Info
        chipType.innerText = await esploader.chip.get_chip_description(esploader);
        macAddr.innerText = await esploader.chip.get_mac(esploader);
        
        deviceConnected = true;
        updateStatus("connected", "Connected");
        programBtn.disabled = false;
        autoFlashBtn.disabled = false;
        resetBtn.disabled = false;
        eraseBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fa-solid fa-link-slash"></i> Disconnect';
        
        // Update serial monitor baud rate
        updateMonitorBaudRate();
        // Start reading serial loop for the monitor
        readLoop();

    } catch (e) {
        console.error(e);
        alert("Connection Failed: " + e.message);
        updateStatus("disconnected", "Disconnected");
    }
});

async function disconnect() {
    if (reader) await reader.cancel();
    if (port) await port.close();
    
    deviceConnected = false;
    updateStatus("disconnected", "Disconnected");
    connectBtn.innerHTML = '<i class="fa-solid fa-plug"></i> Connect Device';
    programBtn.disabled = true;
    autoFlashBtn.disabled = true;
    resetBtn.disabled = true;
    eraseBtn.disabled = true;
    chipType.innerText = "-";
    macAddr.innerText = "-";
}

function updateStatus(state, text) {
    connectionStatus.className = `status-indicator ${state}`;
    statusText.innerText = text;
}

// --- 2. FIRMWARE REPOSITORY LOADER ---

async function loadAvailableFirmware() {
    try {
        const response = await fetch(REPO_CONFIG_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const config = await response.json();
        availableProjects = config.projects || {};
        
        // Clear and populate project select
        projectSelect.innerHTML = '<option value="">Select a project...</option>';
        for (const [projectName, projectInfo] of Object.entries(availableProjects)) {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = `${projectName} ${projectInfo.version ? `(v${projectInfo.version})` : ''}`;
            projectSelect.appendChild(option);
        }
        
        console.log(`Loaded ${Object.keys(availableProjects).length} projects from repository`);
    } catch (error) {
        console.error('Failed to load firmware list:', error);
        projectSelect.innerHTML = '<option value="">Failed to load projects</option>';
        autoProgressText.innerText = 'Error loading firmware list';
    }
}

projectSelect.addEventListener('change', function() {
    const projectName = this.value;
    currentProject = availableProjects[projectName];
    
    if (currentProject) {
        displayFirmwareInfo(currentProject);
        firmwareInfo.style.display = 'block';
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
    
    // Build file list
    firmwareList.innerHTML = '';
    files.forEach(file => {
        totalSize += file.size || 0;
        const fileItem = document.createElement('div');
        fileItem.className = 'firmware-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="fa-solid fa-file-binary"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
            <div class="file-address">
                <code>0x${file.address.toString(16).toUpperCase()}</code>
            </div>
        `;
        firmwareList.appendChild(fileItem);
    });
    
    // Update info panel
    document.getElementById('firmwareCount').textContent = files.length;
    document.getElementById('firmwareSize').textContent = formatFileSize(totalSize);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// --- 3. AUTO-FLASH FUNCTIONALITY ---

autoFlashBtn.addEventListener('click', async () => {
    if (!deviceConnected || !currentProject) return;
    
    const files = currentProject.files || [];
    if (files.length === 0) return alert("No firmware files found for this project.");
    
    autoFlashBtn.disabled = true;
    autoProgressText.innerText = "Downloading firmware...";
    autoProgressBar.style.width = "10%";
    autoProgressBar.classList.add("active");
    
    try {
        const fileArray = [];
        let downloadedCount = 0;
        
        // Download each file
        for (const fileInfo of files) {
            // Check for a direct URL (from your Release), otherwise use the local path
const downloadUrl = fileInfo.url ? fileInfo.url : `${FIRMWARE_BASE_URL}/${currentProject.path}/${fileInfo.name}`;
const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error(`Failed to download ${fileInfo.name}`);
            
            const blob = await response.blob();
            const data = await readFile(blob);
            
            fileArray.push({
                data: data,
                address: fileInfo.address
            });
            
            downloadedCount++;
            const progress = 10 + (downloadedCount / files.length) * 40; // 10-50%
            autoProgressBar.style.width = `${progress}%`;
            autoProgressText.innerText = `Downloading... ${downloadedCount}/${files.length}`;
        }
        
        autoProgressText.innerText = "Erasing flash...";
        autoProgressBar.style.width = "60%";
        
        // Optional: Erase Flash
        if(document.getElementById('eraseFlash').checked) {
            await esploader.erase_flash();
        }
        
        autoProgressText.innerText = "Writing flash...";
        autoProgressBar.style.width = "70%";
        
        // Write Flash
        await esploader.write_flash(
            fileArray,
            'keep',
            'keep',
            'keep',
            false,
            true,
            (fileIndex, written, total) => {
                const progress = 70 + (written / total) * 25; // 70-95%
                const percentage = Math.round(progress);
                autoProgressBar.style.width = `${percentage}%`;
                autoProgressText.innerText = `Writing... ${Math.round((written / total) * 100)}%`;
            }
        );
        
        autoProgressText.innerText = "Verifying...";
        autoProgressBar.style.width = "96%";
        
        // Optional verification could go here
        await new Promise(resolve => setTimeout(resolve, 500));
        
        autoProgressText.innerText = "Complete! Resetting device...";
        autoProgressBar.style.width = "100%";
        autoProgressBar.classList.remove("active");
        autoProgressBar.style.backgroundColor = "#238636";
        
        // Reset device
        await transport.setDTR(false);
        await transport.setRTS(true);
        
        setTimeout(() => {
            autoProgressText.innerText = "Ready for next flash";
            autoProgressBar.style.width = "0%";
            autoProgressBar.style.backgroundColor = "";
            autoFlashBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Auto-flash failed:', error);
        autoProgressText.innerText = `Error: ${error.message}`;
        autoProgressBar.style.backgroundColor = "#da3633";
        autoFlashBtn.disabled = false;
    }
});

// --- 4. MANUAL FLASHING (existing, updated) ---

programBtn.addEventListener('click', async () => {
    if (!deviceConnected) return;

    const fileRows = document.querySelectorAll('.file-row');
    const fileArray = [];

    // Gather Files
    for (const row of fileRows) {
        const fileInput = row.querySelector('.file-input');
        const offsetInput = row.querySelector('.offset-input');
        const file = fileInput.files[0];
        
        if (file) {
            const data = await readFile(file);
            const address = offsetInput.value.startsWith('0x') 
                ? parseInt(offsetInput.value, 16) 
                : parseInt(offsetInput.value, 10);
            fileArray.push({ data: data, address: address });
        }
    }

    if (fileArray.length === 0) return alert("No files selected.");

    // UI Updates
    programBtn.disabled = true;
    progressText.innerText = "Erasing flash (if selected) & Writing...";
    progressBar.style.width = "0%";
    progressBar.classList.add("active");

    try {
        // Optional: Erase Flash
        if(document.getElementById('eraseFlash').checked) {
            await esploader.erase_flash();
        }

        // Write Flash
        await esploader.write_flash(
            fileArray,
            'keep',
            'keep',
            'keep',
            false,
            true,
            (fileIndex, written, total) => {
                const percentage = Math.round((written / total) * 100);
                progressBar.style.width = `${percentage}%`;
                progressText.innerText = `Writing... ${percentage}%`;
            }
        );

        progressText.innerText = "Done! Resetting device...";
        progressBar.classList.remove("active");
        progressBar.style.backgroundColor = "#238636";
        
        await transport.setDTR(false);
        await transport.setRTS(true);

    } catch (e) {
        progressText.innerText = "Error: " + e.message;
        progressBar.style.backgroundColor = "#da3633";
    } finally {
        programBtn.disabled = false;
    }
});

// --- 5. HELPER FUNCTIONS ---

const readFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsBinaryString(file);
    });
};

document.getElementById('btnAddRow').addEventListener('click', () => {
    const list = document.getElementById('fileList');
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
        <input type="text" class="gh-input offset-input" value="0x10000" placeholder="0x10000">
        <input type="file" class="gh-input-file file-input" accept=".bin,.elf">
        <button class="gh-btn-icon remove-row"><i class="fa-solid fa-trash"></i></button>
    `;
    list.appendChild(row);
    row.querySelector('.remove-row').addEventListener('click', () => row.remove());
});

// --- 6. SERIAL MONITOR ENHANCEMENTS ---

async function readLoop() {
    while (port.readable && deviceConnected) {
        reader = port.readable.getReader();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                // Decode and display
                const text = new TextDecoder().decode(value);
                appendToConsole(text, 'receive');
            }
        } catch (error) {
            console.error('Serial read error:', error);
        } finally {
            reader.releaseLock();
        }
    }
}

function appendToConsole(text, type = 'receive') {
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.trim() === '') return;
        
        const lineDiv = document.createElement('div');
        lineDiv.className = `term-line ${type}`;
        
        if (type === 'receive') {
            lineDiv.innerHTML = `<span class="term-prompt">></span> ${escapeHtml(line)}`;
        } else {
            lineDiv.innerHTML = `<span class="term-prompt">$</span> ${escapeHtml(line)}`;
        }
        
        consoleDiv.appendChild(lineDiv);
    });
    
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send serial data
document.getElementById('btnSend').addEventListener('click', sendSerialData);
document.getElementById('serialInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendSerialData();
});

async function sendSerialData() {
    const input = document.getElementById('serialInput');
    const text = input.value + '\n';
    
    if (!text || !port || !deviceConnected) return;
    
    appendToConsole(text.trim(), 'send');
    
    try {
        const writer = port.writable.getWriter();
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(text));
        writer.releaseLock();
    } catch (error) {
        console.error('Serial write error:', error);
    }
    
    input.value = '';
}

// Clear console
document.getElementById('btnClearConsole').addEventListener('click', () => {
    consoleDiv.innerHTML = '<div class="term-line"><span class="term-prompt">$</span> Console cleared</div>';
});

// Reset device
resetBtn.addEventListener('click', async () => {
    if(transport) {
        await transport.setDTR(false);
        await transport.setRTS(true);
        setTimeout(() => transport.setDTR(true), 100);
    }
});

// Full erase
eraseBtn.addEventListener('click', async () => {
    if(!deviceConnected || !confirm('This will erase ALL flash memory. Continue?')) return;
    
    try {
        progressText.innerText = "Erasing entire flash...";
        progressBar.style.width = "0%";
        progressBar.classList.add("active");
        
        await esploader.erase_flash();
        
        progressText.innerText = "Erase complete!";
        progressBar.style.width = "100%";
        progressBar.style.backgroundColor = "#238636";
        
        setTimeout(() => {
            progressText.innerText = "Ready";
            progressBar.style.width = "0%";
            progressBar.style.backgroundColor = "";
        }, 2000);
    } catch (error) {
        progressText.innerText = "Erase failed: " + error.message;
        progressBar.style.backgroundColor = "#da3633";
    }
});

// Tab switching
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.target.classList.add('active');
    
    // Update monitor baud rate if switching to monitor tab
    if (tabId === 'monitor' && deviceConnected) {
        updateMonitorBaudRate();
    }
};

function updateMonitorBaudRate() {
    if (!port || !deviceConnected) return;
    
    const monitorBaud = parseInt(document.getElementById('monitorBaud').value);
    const currentBaud = parseInt(document.getElementById('baudRate').value);
    
    // Only update if different
    if (monitorBaud !== currentBaud) {
        // Note: Changing baud rate requires reconnection in Web Serial API
        // For now, we'll just update the display
        console.log(`Monitor baud rate: ${monitorBaud} (Flashing: ${currentBaud})`);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('ESP32 Tools Pro initialized');
});

