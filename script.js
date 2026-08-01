import {
  ESPLoader,
  Transport,
} from "https://unpkg.com/esptool-js@0.6.0/bundle.js";

const FIRMWARE_BASE_URL = "firmware";
const REPO_CONFIG_URL = `${FIRMWARE_BASE_URL}/projects.json`;
const MAX_TERMINAL_LINES = 1000;

const state = {
  device: null,
  transport: null,
  esploader: null,
  flasherConnected: false,
  monitoring: false,
  monitorStopRequested: true,
  busy: false,
  intentionalDisconnect: false,
  availableProjects: {},
  currentProject: null,
  toastTimer: null,
};

const elements = {
  autoFlashButton: document.getElementById("btnAutoFlash"),
  autoEraseFlash: document.getElementById("autoEraseFlash"),
  autoProgressBar: document.getElementById("autoProgressBar"),
  autoProgressPercent: document.getElementById("autoProgressPercent"),
  autoProgressText: document.getElementById("autoProgressText"),
  baudRate: document.getElementById("baudRate"),
  browserNotice: document.getElementById("browserNotice"),
  browserNoticeReason: document.getElementById("browserNoticeReason"),
  browserNoticeTitle: document.getElementById("browserNoticeTitle"),
  browserSupport: document.getElementById("browserSupport"),
  chipType: document.getElementById("chipType"),
  clearConsoleButton: document.getElementById("btnClearConsole"),
  connectButton: document.getElementById("btnConnect"),
  connectionStatus: document.getElementById("connectionStatus"),
  console: document.getElementById("console"),
  eraseButton: document.getElementById("btnErase"),
  eraseFlash: document.getElementById("eraseFlash"),
  deviceBrowserStatus: document.getElementById("deviceBrowserStatus"),
  fileList: document.getElementById("fileList"),
  firmwareCount: document.getElementById("firmwareCount"),
  firmwareDescription: document.getElementById("firmwareDescription"),
  firmwareEmpty: document.getElementById("firmwareEmpty"),
  firmwareInfo: document.getElementById("firmwareInfo"),
  firmwareList: document.getElementById("firmwareList"),
  firmwareName: document.getElementById("firmwareName"),
  firmwareSize: document.getElementById("firmwareSize"),
  firmwareTarget: document.getElementById("firmwareTarget"),
  firmwareVersion: document.getElementById("firmwareVersion"),
  heroConnect: document.getElementById("heroConnect"),
  macAddr: document.getElementById("macAddr"),
  monitorBaud: document.getElementById("monitorBaud"),
  programButton: document.getElementById("btnProgram"),
  progressBar: document.getElementById("progressBar"),
  progressPercent: document.getElementById("progressPercent"),
  progressText: document.getElementById("progressText"),
  projectSelect: document.getElementById("projectSelect"),
  resetButton: document.getElementById("btnReset"),
  sendButton: document.getElementById("btnSend"),
  serialInput: document.getElementById("serialInput"),
  sessionMode: document.getElementById("sessionMode"),
  startMonitorButton: document.getElementById("btnStartMonitor"),
  statusText: document.getElementById("statusText"),
  terminalStatus: document.getElementById("terminalStatus"),
  toast: document.getElementById("toast"),
};

const serialSupported = Boolean(navigator.serial && window.isSecureContext);

function initialize() {
  initTabs();
  bindEvents();
  addFileRow("0x10000");
  renderBrowserSupport();
  renderConnection();
  updateActionStates();
  loadAvailableFirmware();

  const requestedTab = window.location.hash.slice(1);
  if (["flash", "auto", "monitor"].includes(requestedTab)) {
    activateTab(requestedTab, { scroll: false });
  }

  if (!serialSupported) {
    elements.connectButton.disabled = true;
    elements.heroConnect.disabled = true;
  }
}

function renderBrowserSupport() {
  const browserName = detectBrowserName();
  let title = `${browserName} is ready`;
  let reason = "Web Serial is available in this secure browser context.";

  if (!window.isSecureContext) {
    title = "A secure connection is required";
    reason = `${browserName} can only use Web Serial over HTTPS or localhost.`;
  } else if (!navigator.serial) {
    title = `${browserName} does not support Web Serial here`;
    reason = "Open this page in a current desktop version of Chrome or Microsoft Edge.";
  }

  elements.browserSupport.className = `browser-support ${serialSupported ? "supported" : "unsupported"}`;
  const icon = document.createElement("i");
  icon.className = serialSupported ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark";
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = serialSupported ? `${browserName} · Web Serial ready` : `${browserName} · Unsupported`;
  elements.browserSupport.replaceChildren(icon, label);

  elements.browserNotice.hidden = serialSupported;
  elements.browserNoticeTitle.textContent = title;
  elements.browserNoticeReason.textContent = reason;
  elements.deviceBrowserStatus.replaceChildren();
  const deviceLabel = document.createTextNode(serialSupported ? `${browserName} · supported` : `${browserName} · unsupported`);
  const breakLine = document.createElement("br");
  const detail = document.createElement("small");
  detail.textContent = serialSupported ? "Web Serial API detected" : reason;
  elements.deviceBrowserStatus.append(deviceLabel, breakLine, detail);

  if (!serialSupported) showToast(reason, "error");
}

function detectBrowserName() {
  const brands = navigator.userAgentData?.brands || [];
  const preferredBrands = ["Microsoft Edge", "Google Chrome", "Opera", "Chromium"];
  for (const preferredBrand of preferredBrands) {
    const match = brands.find((brand) => brand.brand === preferredBrand);
    if (match) return match.brand.replace("Google ", "");
  }

  const userAgent = navigator.userAgent;
  if (/Edg\//.test(userAgent)) return "Microsoft Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "This browser";
}

function bindEvents() {
  elements.connectButton.addEventListener("click", handleConnectToggle);
  elements.heroConnect.addEventListener("click", handleConnectToggle);
  document.getElementById("btnAddRow").addEventListener("click", () => addFileRow());
  elements.programButton.addEventListener("click", flashManualFirmware);
  elements.autoFlashButton.addEventListener("click", flashSelectedProject);
  elements.projectSelect.addEventListener("change", handleProjectChange);
  elements.eraseButton.addEventListener("click", eraseEntireFlash);
  elements.resetButton.addEventListener("click", resetBoard);
  elements.startMonitorButton.addEventListener("click", handleMonitorToggle);
  elements.sendButton.addEventListener("click", sendSerialData);
  elements.serialInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) sendSerialData();
  });
  elements.clearConsoleButton.addEventListener("click", clearConsole);
  elements.monitorBaud.addEventListener("change", () => {
    if (state.monitoring) showToast("Restart the monitor to apply the new baud rate.");
  });
  elements.baudRate.addEventListener("change", () => {
    if (state.flasherConnected) {
      showToast("Reconnect the board to apply the new upload speed.");
    }
  });
  document.querySelectorAll(".tab-shortcut").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.targetTab));
  });
  window.addEventListener("beforeunload", () => {
    state.monitorStopRequested = true;
  });
}

function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });
}

function activateTab(tabName, { scroll = true } = {}) {
  const target = document.getElementById(`tab-${tabName}`);
  if (!target) return;

  document.querySelectorAll(".tab-content").forEach((panel) => {
    panel.classList.toggle("active", panel === target);
  });
  document.querySelectorAll(".tab-btn").forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  window.history.replaceState(null, "", `#${tabName}`);
  if (scroll) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function handleConnectToggle() {
  if (!serialSupported || state.busy) return;

  if (state.flasherConnected || state.monitoring) {
    await disconnectSession();
    return;
  }

  await connectFlasher();
}

async function connectFlasher(existingDevice = null) {
  setBusy(true, "connecting");
  updateConnection("connecting", "Opening bootloader", "Bootloader");

  try {
    state.device = existingDevice || await navigator.serial.requestPort();
    state.transport = new Transport(state.device, false);
    state.transport.setDeviceLostCallback(handleDeviceLost);

    const terminal = {
      clean() {},
      writeLine(data) {
        appendTerminal(data, classifyTerminalLine(data));
      },
      write(data) {
        appendTerminal(data, classifyTerminalLine(data));
      },
    };

    state.esploader = new ESPLoader({
      transport: state.transport,
      baudrate: Number.parseInt(elements.baudRate.value, 10),
      terminal,
      debugLogging: false,
    });

    const detectedChip = await state.esploader.main();
    let macAddress = "Unavailable";
    try {
      macAddress = await state.esploader.chip.readMac(state.esploader);
    } catch (error) {
      console.warn("Unable to read MAC address", error);
    }

    state.flasherConnected = true;
    elements.chipType.textContent = detectedChip || state.esploader.chip.CHIP_NAME || "ESP device";
    elements.macAddr.textContent = macAddress;
    updateConnection("connected", "Board connected", "Bootloader");
    appendTerminal(`Connected to ${elements.chipType.textContent}`, "system");
    showToast("Board connected and ready to flash.", "success");
  } catch (error) {
    console.error("Connection failed", error);
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("error", "Connection failed", "Standby");
    showToast(normalizeSerialError(error, "Could not connect to the board."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function disconnectSession() {
  if (state.busy) return;
  setBusy(true, "disconnecting");
  try {
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("disconnected", "Disconnected", "Standby");
    showToast("USB session closed.");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function closeTransport({ forgetDevice = true, silent = false } = {}) {
  state.monitorStopRequested = true;
  state.intentionalDisconnect = true;

  const activeTransport = state.transport;
  state.flasherConnected = false;
  state.monitoring = false;

  if (activeTransport) {
    try {
      await activeTransport.disconnect();
    } catch (error) {
      const message = String(error?.message || error);
      if (!message.includes("closed") && !message.includes("unlock")) {
        console.warn("Serial disconnect did not finish cleanly", error);
        if (!silent) showToast("The port closed with a browser warning.", "error");
      }
    }
  }

  state.transport = null;
  state.esploader = null;
  if (forgetDevice) state.device = null;
  state.intentionalDisconnect = false;
  elements.chipType.textContent = "Not detected";
  elements.macAddr.textContent = "—";
  elements.terminalStatus.textContent = "uart://waiting-for-device";
  renderConnection();
}

function handleDeviceLost() {
  if (state.intentionalDisconnect) return;
  state.monitorStopRequested = true;
  state.flasherConnected = false;
  state.monitoring = false;
  state.transport = null;
  state.esploader = null;
  state.device = null;
  elements.chipType.textContent = "Not detected";
  elements.macAddr.textContent = "—";
  updateConnection("error", "Device removed", "Standby");
  appendTerminal("USB device disconnected.", "error");
  showToast("The board was disconnected.", "error");
  setBusy(false);
  renderConnection();
}

function renderConnection() {
  let status = "disconnected";
  let label = "Disconnected";
  let mode = "Standby";

  if (state.busy) {
    status = elements.connectionStatus.dataset.state || "busy";
    label = elements.statusText.textContent || "Working";
    mode = elements.sessionMode.textContent || "Busy";
  } else if (state.monitoring) {
    status = "monitoring";
    label = "Serial streaming";
    mode = "UART monitor";
  } else if (state.flasherConnected) {
    status = "connected";
    label = "Board connected";
    mode = "Bootloader";
  } else if (elements.connectionStatus.dataset.state === "error") {
    status = "error";
    label = elements.statusText.textContent;
  }

  elements.connectionStatus.dataset.state = status;
  elements.statusText.textContent = label;
  elements.sessionMode.textContent = mode;

  const hasSession = state.flasherConnected || state.monitoring;
  elements.connectButton.classList.toggle("disconnect", hasSession);
  elements.connectButton.innerHTML = hasSession
    ? '<i class="fa-solid fa-link-slash" aria-hidden="true"></i> Disconnect'
    : '<i class="fa-brands fa-usb" aria-hidden="true"></i> Connect board';
  elements.heroConnect.innerHTML = hasSession
    ? '<i class="fa-solid fa-link-slash" aria-hidden="true"></i> Disconnect board'
    : '<i class="fa-brands fa-usb" aria-hidden="true"></i> Connect board';

  elements.startMonitorButton.classList.toggle("active", state.monitoring);
  elements.startMonitorButton.innerHTML = state.monitoring
    ? '<i class="fa-solid fa-stop" aria-hidden="true"></i> Stop monitor'
    : '<i class="fa-solid fa-play" aria-hidden="true"></i> Start monitor';

  elements.serialInput.disabled = !state.monitoring || state.busy;
  elements.sendButton.disabled = !state.monitoring || state.busy;
  updateActionStates();
}

function updateConnection(status, label, mode) {
  elements.connectionStatus.dataset.state = status;
  elements.statusText.textContent = label;
  elements.sessionMode.textContent = mode;
}

function setBusy(busy, status = "busy") {
  state.busy = busy;
  if (busy) elements.connectionStatus.dataset.state = status;
  elements.connectButton.disabled = busy || !serialSupported;
  elements.heroConnect.disabled = busy || !serialSupported;
  elements.startMonitorButton.disabled = busy || !serialSupported;
  updateActionStates();
}

function updateActionStates() {
  const manualReady = state.flasherConnected && hasSelectedManualFile() && !state.busy;
  const autoReady = state.flasherConnected && Boolean(state.currentProject) && !state.busy;

  elements.programButton.disabled = !manualReady;
  elements.autoFlashButton.disabled = !autoReady;
  elements.resetButton.disabled = !state.flasherConnected || state.busy;
  elements.eraseButton.disabled = !state.flasherConnected || state.busy;
  elements.projectSelect.disabled = state.busy;
}

function hasSelectedManualFile() {
  return [...elements.fileList.querySelectorAll(".file-input")]
    .some((input) => input.files?.length);
}

function addFileRow(preferredAddress = null) {
  const row = document.createElement("div");
  const address = preferredAddress || findNextAddress();
  row.className = "file-row";

  const addressInput = document.createElement("input");
  addressInput.className = "address-input";
  addressInput.type = "text";
  addressInput.value = address;
  addressInput.placeholder = "0x10000";
  addressInput.setAttribute("aria-label", "Flash offset");
  addressInput.spellcheck = false;

  const filePicker = document.createElement("label");
  filePicker.className = "file-picker";
  const fileIcon = document.createElement("i");
  fileIcon.className = "fa-solid fa-file-arrow-up";
  fileIcon.setAttribute("aria-hidden", "true");

  const pickerCopy = document.createElement("span");
  pickerCopy.className = "file-picker-copy";
  const pickerTitle = document.createElement("strong");
  pickerTitle.textContent = "Choose a .bin file";
  const pickerMeta = document.createElement("small");
  pickerMeta.textContent = "Local file · not uploaded";
  pickerCopy.append(pickerTitle, pickerMeta);

  const fileInput = document.createElement("input");
  fileInput.className = "file-input";
  fileInput.type = "file";
  fileInput.accept = ".bin,application/octet-stream";
  fileInput.setAttribute("aria-label", "Choose firmware binary");

  const removeButton = document.createElement("button");
  removeButton.className = "remove-row";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "Remove firmware row");
  removeButton.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    filePicker.classList.toggle("has-file", Boolean(file));
    pickerTitle.textContent = file?.name || "Choose a .bin file";
    pickerMeta.textContent = file ? formatFileSize(file.size) : "Local file · not uploaded";
    updateActionStates();
  });
  addressInput.addEventListener("input", () => {
    addressInput.classList.remove("invalid");
  });
  removeButton.addEventListener("click", () => {
    row.remove();
    updateActionStates();
  });

  filePicker.append(fileIcon, pickerCopy, fileInput);
  row.append(addressInput, filePicker, removeButton);
  elements.fileList.appendChild(row);
}

function findNextAddress() {
  const standardAddresses = ["0x1000", "0x8000", "0xE000", "0x10000", "0x110000"];
  const used = new Set(
    [...elements.fileList.querySelectorAll(".address-input")]
      .map((input) => input.value.trim().toUpperCase()),
  );
  return standardAddresses.find((address) => !used.has(address.toUpperCase())) || "0x10000";
}

function parseAddress(value) {
  const normalized = String(value).trim();
  if (!/^(?:0x[\da-f]+|\d+)$/i.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, normalized.toLowerCase().startsWith("0x") ? 16 : 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffffffff) return null;
  return parsed;
}

async function collectManualImages() {
  const mappedImages = [];
  const rows = [...elements.fileList.querySelectorAll(".file-row")];

  for (const [index, row] of rows.entries()) {
    const fileInput = row.querySelector(".file-input");
    const addressInput = row.querySelector(".address-input");
    const file = fileInput.files?.[0];
    if (!file) continue;

    const address = parseAddress(addressInput.value);
    if (address === null) {
      addressInput.classList.add("invalid");
      throw new Error(`Row ${index + 1} has an invalid flash offset.`);
    }
    if (!file.name.toLowerCase().endsWith(".bin")) {
      throw new Error(`${file.name} is not a .bin firmware image.`);
    }

    mappedImages.push({
      address,
      data: new Uint8Array(await file.arrayBuffer()),
      name: file.name,
      size: file.size,
    });
  }

  if (!mappedImages.length) throw new Error("Choose at least one firmware binary.");

  const sorted = [...mappedImages].sort((a, b) => a.address - b.address);
  for (let index = 1; index < sorted.length; index += 1) {
    const previousEnd = sorted[index - 1].address + sorted[index - 1].size;
    if (sorted[index].address < previousEnd) {
      throw new Error(`${sorted[index - 1].name} overlaps ${sorted[index].name} in flash memory.`);
    }
  }
  return mappedImages;
}

async function flashManualFirmware() {
  if (!state.flasherConnected || state.busy) return;

  try {
    setBusy(true);
    updateConnection("busy", "Preparing images", "Flashing");
    setProgress("manual", 2, "Reading local binaries", "active");
    const images = await collectManualImages();
    await writeImages(images, "manual", elements.eraseFlash.checked);
    setProgress("manual", 100, "Firmware written — resetting board", "success");
    await state.esploader.after("hard_reset");
    showToast("Firmware written successfully. The board was reset.", "success");
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("disconnected", "Flash complete", "Standby");
  } catch (error) {
    console.error("Manual flash failed", error);
    setProgress("manual", 0, normalizeSerialError(error, "Firmware write failed."), "error");
    updateConnection(state.flasherConnected ? "connected" : "error", state.flasherConnected ? "Board connected" : "Flash failed", state.flasherConnected ? "Bootloader" : "Standby");
    showToast(normalizeSerialError(error, "Firmware write failed."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function writeImages(images, progressKind, eraseAll) {
  const fileArray = images.map(({ data, address }) => ({ data, address }));
  const totalBytes = images.reduce((sum, image) => sum + image.data.length, 0);
  const completedBefore = images.map((_, index) =>
    images.slice(0, index).reduce((sum, image) => sum + image.data.length, 0),
  );

  setProgress(progressKind, 5, eraseAll ? "Erasing flash and preparing write" : "Preparing flash write", "active");

  await state.esploader.writeFlash({
    fileArray,
    flashMode: "keep",
    flashFreq: "keep",
    flashSize: "keep",
    eraseAll,
    compress: true,
    reportProgress(fileIndex, written, total) {
      const fileLength = images[fileIndex]?.data.length || total;
      const normalizedWritten = total > 0 ? (written / total) * fileLength : written;
      const overallWritten = completedBefore[fileIndex] + normalizedWritten;
      const percentage = Math.min(99, Math.max(6, Math.round((overallWritten / totalBytes) * 93 + 6)));
      setProgress(progressKind, percentage, `Writing ${images[fileIndex]?.name || `image ${fileIndex + 1}`}`, "active");
    },
  });
}

async function loadAvailableFirmware() {
  try {
    const response = await fetch(REPO_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`);
    const config = await response.json();
    state.availableProjects = config.projects || {};
    elements.projectSelect.replaceChildren(new Option("Select a firmware package…", ""));

    for (const [projectId, project] of Object.entries(state.availableProjects)) {
      const suffix = project.available === false ? " · unavailable" : project.version ? ` · v${project.version}` : "";
      const option = new Option(`${project.name || projectId}${suffix}`, projectId);
      option.disabled = project.available === false;
      elements.projectSelect.appendChild(option);
    }

    const availableCount = Object.values(state.availableProjects)
      .filter((project) => project.available !== false).length;
    if (!availableCount) throw new Error("No installable firmware packages were found");
  } catch (error) {
    console.error("Failed to load firmware catalog", error);
    elements.projectSelect.replaceChildren(new Option("Firmware catalog unavailable", ""));
    elements.autoProgressText.textContent = "Could not load firmware catalog";
    showToast("The firmware catalog could not be loaded.", "error");
  }
}

function handleProjectChange() {
  const project = state.availableProjects[elements.projectSelect.value] || null;
  state.currentProject = project?.available === false ? null : project;
  displayFirmwareInfo(state.currentProject);
  updateActionStates();
}

function displayFirmwareInfo(project) {
  if (!project) {
    elements.firmwareInfo.hidden = true;
    elements.firmwareEmpty.hidden = false;
    elements.firmwareList.replaceChildren();
    elements.autoProgressText.textContent = "Select a firmware package";
    elements.autoProgressPercent.textContent = "0%";
    elements.autoProgressBar.style.width = "0%";
    return;
  }

  const files = Array.isArray(project.files) ? project.files : [];
  const knownSize = files.every((file) => Number.isFinite(file.size));
  const totalSize = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);

  elements.firmwareEmpty.hidden = true;
  elements.firmwareInfo.hidden = false;
  elements.firmwareName.textContent = project.name || "Unnamed firmware";
  elements.firmwareDescription.textContent = project.description || "No package description provided.";
  elements.firmwareVersion.textContent = project.version ? `v${project.version}` : "unversioned";
  elements.firmwareCount.textContent = String(files.length);
  elements.firmwareSize.textContent = knownSize ? formatFileSize(totalSize) : "Verified on download";
  elements.firmwareTarget.textContent = project.target || "ESP32";
  elements.firmwareList.replaceChildren();

  files.forEach((file) => {
    const item = document.createElement("div");
    item.className = "firmware-item";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-file-code";
    icon.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "firmware-file-copy";
    const name = document.createElement("strong");
    name.textContent = file.name || "unnamed.bin";
    const size = document.createElement("small");
    const sizeLabel = Number.isFinite(file.size) ? formatFileSize(file.size) : "Size checked during download";
    size.textContent = file.sha256 ? `${sizeLabel} · SHA-256 checked` : sizeLabel;
    copy.append(name, size);

    const address = document.createElement("span");
    address.className = "firmware-address";
    const parsedAddress = parseAddress(file.address);
    address.textContent = parsedAddress === null ? "Invalid" : formatAddress(parsedAddress);
    item.append(icon, copy, address);
    elements.firmwareList.appendChild(item);
  });

  setProgress("auto", 0, state.flasherConnected ? "Ready to install" : "Connect a board to install", "idle");
}

async function flashSelectedProject() {
  if (!state.flasherConnected || !state.currentProject || state.busy) return;
  const project = state.currentProject;
  const files = Array.isArray(project.files) ? project.files : [];
  if (!files.length) {
    showToast("This package does not contain any firmware images.", "error");
    return;
  }

  try {
    setBusy(true);
    updateConnection("busy", "Downloading package", "Quick install");
    setProgress("auto", 2, "Downloading firmware package", "active");

    const images = [];
    for (const [index, file] of files.entries()) {
      const address = parseAddress(file.address);
      if (address === null) throw new Error(`${file.name} has an invalid flash offset.`);
      const downloadUrl = resolveFirmwareUrl(project, file);
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`${file.name} returned HTTP ${response.status}.`);
      const data = new Uint8Array(await response.arrayBuffer());
      if (!data.length) throw new Error(`${file.name} downloaded as an empty file.`);
      if (Number.isFinite(file.size) && data.length !== file.size) {
        throw new Error(`${file.name} size did not match the catalog.`);
      }
      if (file.sha256) {
        const actualDigest = await calculateSha256(data);
        if (actualDigest !== String(file.sha256).toLowerCase()) {
          throw new Error(`${file.name} failed its SHA-256 integrity check.`);
        }
      }
      images.push({ data, address, name: file.name, size: data.length });
      const downloadProgress = Math.round(((index + 1) / files.length) * 30);
      setProgress("auto", downloadProgress, `Downloaded ${index + 1} of ${files.length} components`, "active");
    }

    updateConnection("busy", "Writing package", "Quick install");
    await writeImages(images, "auto", elements.autoEraseFlash.checked);
    setProgress("auto", 100, "Install complete — resetting board", "success");
    await state.esploader.after("hard_reset");
    showToast(`${project.name || "Firmware"} installed successfully.`, "success");
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("disconnected", "Install complete", "Standby");
  } catch (error) {
    console.error("Quick install failed", error);
    setProgress("auto", 0, normalizeSerialError(error, "Quick install failed."), "error");
    updateConnection(state.flasherConnected ? "connected" : "error", state.flasherConnected ? "Board connected" : "Install failed", state.flasherConnected ? "Bootloader" : "Standby");
    showToast(normalizeSerialError(error, "Quick install failed."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

function resolveFirmwareUrl(project, file) {
  const candidate = file.url || `${FIRMWARE_BASE_URL}/${project.path}/${file.name}`;
  const resolved = new URL(candidate, window.location.href);
  if (!["http:", "https:"].includes(resolved.protocol)) {
    throw new Error(`Unsupported download URL for ${file.name}.`);
  }
  return resolved.href;
}

async function resetBoard() {
  if (!state.flasherConnected || state.busy) return;
  setBusy(true);
  updateConnection("busy", "Resetting board", "Bootloader");
  try {
    await state.esploader.after("hard_reset");
    appendTerminal("Board hard reset complete.", "system");
    showToast("Board reset. Reconnect when you want to flash again.", "success");
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("disconnected", "Board reset", "Standby");
  } catch (error) {
    console.error("Reset failed", error);
    updateConnection("error", "Reset failed", "Bootloader");
    showToast(normalizeSerialError(error, "Board reset failed."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function eraseEntireFlash() {
  if (!state.flasherConnected || state.busy) return;
  const confirmed = window.confirm(
    "Erase the entire ESP flash memory? This permanently removes the installed firmware and stored settings.",
  );
  if (!confirmed) return;

  setBusy(true);
  updateConnection("busy", "Erasing all flash", "Destructive action");
  setProgress("manual", 8, "Erasing the entire flash chip", "active");
  try {
    await state.esploader.eraseFlash();
    setProgress("manual", 100, "Entire flash erased", "success");
    appendTerminal("Entire flash erased successfully.", "system");
    showToast("The flash chip is now empty.", "success");
    updateConnection("connected", "Board connected", "Bootloader");
  } catch (error) {
    console.error("Erase failed", error);
    setProgress("manual", 0, normalizeSerialError(error, "Erase failed."), "error");
    updateConnection("error", "Erase failed", "Bootloader");
    showToast(normalizeSerialError(error, "Erase failed."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function handleMonitorToggle() {
  if (!serialSupported || state.busy) return;
  if (state.monitoring) {
    await stopMonitor();
  } else {
    await startMonitor();
  }
}

async function startMonitor() {
  let reusableDevice = state.device;
  setBusy(true, "connecting");
  updateConnection("connecting", "Opening serial scope", "UART monitor");

  try {
    if (state.flasherConnected) {
      appendTerminal("Closing bootloader session before opening UART monitor…", "system");
      await state.esploader.after("hard_reset");
      await closeTransport({ forgetDevice: false, silent: true });
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    reusableDevice = reusableDevice || await navigator.serial.requestPort();
    state.device = reusableDevice;
    state.transport = new Transport(state.device, false, false);
    state.transport.setDeviceLostCallback(handleDeviceLost);
    state.monitorStopRequested = false;
    await state.transport.connect(Number.parseInt(elements.monitorBaud.value, 10));
    state.monitoring = true;
    elements.chipType.textContent = "UART device";
    elements.macAddr.textContent = "Not read in monitor mode";
    elements.terminalStatus.textContent = `uart://${Number.parseInt(elements.monitorBaud.value, 10).toLocaleString()}-baud`;
    updateConnection("monitoring", "Serial streaming", "UART monitor");
    activateTab("monitor");
    appendTerminal(`Monitor started at ${Number.parseInt(elements.monitorBaud.value, 10).toLocaleString()} baud.`, "system");
    showToast("Serial monitor started.", "success");
    void readSerialMonitor(state.transport);
  } catch (error) {
    console.error("Monitor connection failed", error);
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("error", "Monitor failed", "Standby");
    appendTerminal(normalizeSerialError(error, "Could not open the serial monitor."), "error");
    showToast(normalizeSerialError(error, "Could not open the serial monitor."), "error");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function readSerialMonitor(activeTransport) {
  const decoder = new TextDecoder();
  let lineBuffer = "";

  try {
    await activeTransport.rawRead(
      (chunk) => {
        lineBuffer += decoder.decode(chunk, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || "";
        lines.forEach((line) => appendTerminal(line, classifyTerminalLine(line)));
      },
      () => state.monitorStopRequested || state.transport !== activeTransport,
    );
    lineBuffer += decoder.decode();
    if (lineBuffer) appendTerminal(lineBuffer, classifyTerminalLine(lineBuffer));
  } catch (error) {
    if (!state.monitorStopRequested && state.transport === activeTransport) {
      console.error("Serial monitor read failed", error);
      appendTerminal(normalizeSerialError(error, "Serial stream ended unexpectedly."), "error");
      showToast("The serial stream ended unexpectedly.", "error");
    }
  }
}

async function stopMonitor() {
  if (!state.monitoring || state.busy) return;
  setBusy(true, "disconnecting");
  appendTerminal("Stopping serial monitor…", "system");
  try {
    await closeTransport({ forgetDevice: true, silent: true });
    updateConnection("disconnected", "Disconnected", "Standby");
    appendTerminal("Serial monitor stopped.", "system");
    showToast("Serial monitor stopped.");
  } finally {
    setBusy(false);
    renderConnection();
  }
}

async function sendSerialData() {
  const value = elements.serialInput.value;
  if (!state.monitoring || !state.transport || !value.trim()) return;

  elements.serialInput.value = "";
  appendTerminal(value, "send");
  try {
    await state.transport.write(new TextEncoder().encode(`${value}\n`));
  } catch (error) {
    console.error("Serial send failed", error);
    appendTerminal(normalizeSerialError(error, "Could not send the command."), "error");
    showToast("Could not send the serial command.", "error");
  }
}

function clearConsole() {
  elements.console.replaceChildren();
  appendTerminal("Console cleared.", "system");
}

function appendTerminal(rawText, type = "receive") {
  const text = String(rawText ?? "");
  const lines = text.split(/\r?\n/).filter((line, index, array) => line || array.length === 1);

  lines.forEach((line) => {
    if (!line && lines.length > 1) return;
    const row = document.createElement("div");
    row.className = `term-line ${type}`;
    const time = document.createElement("span");
    time.className = "term-time";
    time.textContent = new Date().toLocaleTimeString([], { hour12: false });
    const mark = document.createElement("span");
    mark.className = "term-mark";
    mark.textContent = type === "send" ? ">" : type === "error" ? "!" : "●";
    const content = document.createElement("span");
    content.textContent = line;
    row.append(time, mark, content);
    elements.console.appendChild(row);
  });

  while (elements.console.children.length > MAX_TERMINAL_LINES) {
    elements.console.firstElementChild?.remove();
  }
  elements.console.scrollTop = elements.console.scrollHeight;
}

function classifyTerminalLine(text) {
  const normalized = String(text).trim();
  if (/^(?:E\s*\(|error|fatal|panic)/i.test(normalized)) return "error";
  if (/^(?:W\s*\(|warn)/i.test(normalized)) return "warning";
  return "receive";
}

function setProgress(kind, percentage, text, status = "idle") {
  const percent = Math.min(100, Math.max(0, Math.round(percentage)));
  const bar = kind === "auto" ? elements.autoProgressBar : elements.progressBar;
  const label = kind === "auto" ? elements.autoProgressText : elements.progressText;
  const percentLabel = kind === "auto" ? elements.autoProgressPercent : elements.progressPercent;

  bar.style.width = `${percent}%`;
  bar.classList.toggle("active", status === "active");
  bar.classList.toggle("error", status === "error");
  label.textContent = text;
  percentLabel.textContent = `${percent}%`;
}

function formatAddress(address) {
  return `0x${address.toString(16).toUpperCase()}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

async function calculateSha256(data) {
  if (!window.crypto?.subtle) {
    throw new Error("This browser cannot verify firmware integrity with Web Crypto.");
  }
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeSerialError(error, fallback) {
  const message = String(error?.message || "").trim();
  if (!message) return fallback;
  if (/no port selected|user cancelled|user canceled|chooser/i.test(message)) {
    return "No serial device was selected.";
  }
  if (/already open/i.test(message)) {
    return "The serial port is already open in another tab or application.";
  }
  if (/failed to execute 'open'|networkerror/i.test(message)) {
    return "The port is busy. Close other serial tools and try again.";
  }
  if (/permission|denied|notallowederror/i.test(message)) {
    return "Browser permission to use the serial device was denied.";
  }
  return message.length > 180 ? fallback : message;
}

function showToast(message, type = "info") {
  window.clearTimeout(state.toastTimer);
  const icon = document.createElement("i");
  icon.className = type === "error" ? "fa-solid fa-circle-exclamation" : type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-info";
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.textContent = message;
  elements.toast.replaceChildren(icon, copy);
  elements.toast.className = `toast show ${type}`;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 4300);
}

initialize();
