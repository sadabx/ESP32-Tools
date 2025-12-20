let port;
let esploader;
let transport;
let deviceConnected = false;
let reader;
let inputBuffer = '';

// UI Elements
const connectBtn = document.getElementById('btnConnect');
const resetBtn = document.getElementById('btnReset');
const programBtn = document.getElementById('btnProgram');
const consoleDiv = document.getElementById('console');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const chipType = document.getElementById('chipType');
const macAddr = document.getElementById('macAddr');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');

// --- 1. CONNECTION MANAGER ---

connectBtn.addEventListener('click', async () => {
    if (deviceConnected) {
        await disconnect();
        return;
    }

    if (!navigator.serial) return alert("Web Serial not supported. Try Chrome/Edge.");

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: parseInt(document.getElementById('baudRate').value) });

        transport = new Transport(port);
        esploader = new ESPLoader(transport, parseInt(document.getElementById('baudRate').value), null);

        updateStatus("connecting", "Connecting...");
        
        await esploader.main_fn();
        await esploader.flash_id();

        // Get Chip Info
        chipType.innerText = await esploader.chip.get_chip_description(esploader);
        macAddr.innerText = await esploader.chip.get_mac(esploader);
        
        deviceConnected = true;
        updateStatus("connected", "Connected");
        programBtn.disabled = false;
        resetBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fa-solid fa-link-slash"></i> Disconnect';
        
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
    resetBtn.disabled = true;
    chipType.innerText = "-";
    macAddr.innerText = "-";
}

function updateStatus(state, text) {
    connectionStatus.className = `status-indicator ${state}`;
    statusText.innerText = text;
}

// --- 2. FLASHING LOGIC ---

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
            fileArray.push({ data: data, address: parseInt(offsetInput.value, 16) });
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
        progressBar.style.backgroundColor = "#238636"; // Green
        
        await transport.setDTR(false);
        await transport.setRTS(true); // Hard Reset

    } catch (e) {
        progressText.innerText = "Error: " + e.message;
        progressBar.style.backgroundColor = "#da3633"; // Red
    } finally {
        programBtn.disabled = false;
    }
});

// --- 3. HELPER FUNCTIONS ---

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
        <input type="text" class="gh-input offset-input" value="0x10000" placeholder="Offset">
        <input type="file" class="gh-input-file file-input" accept=".bin">
        <button class="gh-btn-icon remove-row"><i class="fa-solid fa-trash"></i></button>
    `;
    list.appendChild(row);
    row.querySelector('.remove-row').addEventListener('click', () => row.remove());
});

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.target.classList.add('active');
};

// --- 4. SERIAL MONITOR (Simplified) ---

async function readLoop() {
    while (port.readable && deviceConnected) {
        const reader = port.readable.getReader();
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                // Decode Uint8Array to string
                const text = new TextDecoder().decode(value);
                consoleDiv.innerHTML += text.replace(/\n/g, "<br>");
                consoleDiv.scrollTop = consoleDiv.scrollHeight;
            }
        } catch (error) {
            console.error(error);
        } finally {
            reader.releaseLock();
        }
    }
}

document.getElementById('btnReset').addEventListener('click', async () => {
    if(transport) {
        await transport.setDTR(false);
        await transport.setRTS(true);
    }
});