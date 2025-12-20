# ⚡ ESP32 Tools

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/status-stable-success?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Web%20Serial%20API-yellow?style=for-the-badge)

**A modern, browser-based flashing utility for ESP32 microcontrollers.**
This tool allows you to flash firmware, monitor serial output, and manage ESP32 devices directly from your web browser without installing any software.

---

## 🚀 Key Features

### 🔌 Connectivity & Control
* **Web Serial API**: Connect directly to ESP32 via Chrome or Edge.
* **Smart Detection**: Automatically reads **Chip Type**, **MAC Address**, and **Device Features**.
* **Control**: Hardware **Reset** and **Full Flash Erase** capabilities built-in.

### ⚡ Flashing Capabilities
* **Manual Mode**: Upload custom `.bin` files to specific memory addresses (e.g., `0x1000`, `0x10000`).
* **Auto-Flash System**: Load pre-configured projects from a repository manifest (`projects.json`).
* **High-Speed**: Adjustable baud rates from **115200** up to **2,000,000 (Expert Mode)**.

### 📟 Integrated Serial Monitor
* **Real-Time Logs**: View device output with color-coded "Send" and "Receive" lines.
* **Command Interface**: Send terminal commands directly to the ESP32.
* **Adjustable Baud**: Change monitor baud rate on the fly (independent of flashing speed).

---

## 🛠️ Installation & Setup

Since this tool uses the **Web Serial API**, it must be served over **HTTPS** or **localhost**.

### 1️⃣ Clone the Repository
```bash
git clone [https://github.com/sadabx/esp32-tools.git](https://github.com/sadabx/esp32-tools.git)
cd esp32-tools

```

### 2️⃣ Start a Local Server

You cannot open `index.html` directly (file:// protocol won't work). Use a simple local server:

**Using Python:**

```bash
python3 -m http.server 8000

```

**Using Node.js:**

```bash
npx serve .

```

### 3️⃣ Open in Browser

Navigate to: `http://localhost:8000`

---

## 📖 Usage Guide

### 🖐️ Manual Flashing

Perfect for developers compiling their own `.bin` files.

1. Click **Connect Device**.
2. Go to the **Manual Flash** tab.
3. Add your files and set offsets (e.g., Bootloader @ `0x1000`, App @ `0x10000`).
4. (Optional) Check **Erase First** for a clean install.
5. Click **Flash Manually**.

### 🤖 Auto Flashing

Perfect for distributing firmware to end-users.

1. Go to the **Auto Flash** tab.
2. Select a project from the dropdown (loaded from `firmware/projects.json`).
3. Review the file list and total size.
4. Click **Flash Automatically**.

### 📟 Serial Monitor

1. Go to the **Serial Monitor** tab.
2. Select your firmware's baud rate (default: `115200`).
3. View logs or type commands in the input box.

---

## 📂 Repository Structure

```text
esp32-tools/
├── 📄 index.html           # Main user interface
├── 🎨 style.css            # Dark theme & glassmorphism styles
├── 🧠 script.js            # Web Serial & esptool-js logic
├── 📂 firmware/            # Firmware repository folder
│   ├── ⚙️ projects.json    # Manifest file for Auto-Flash
│   └── 📁 [project_name]/  # Folder containing binary files
└── 📄 README.md            # Documentation

```

---

## ⚙️ Adding Projects to Auto-Flash

To add your own firmware to the "Auto Flash" menu, edit `firmware/projects.json`:

```json
{
  "projects": {
    "my-awesome-project": {
      "name": "My Awesome Project",
      "version": "1.0.0",
      "description": "Blinks an LED on GPIO 2",
      "path": "my-project-folder",
      "files": [
        {
          "name": "firmware.bin",
          "address": 65536,
          "size": 102400
        }
      ]
    }
  }
}

```

*Note: Ensure the actual `.bin` files exist in `firmware/my-project-folder/`.*

---

## ⚠️ Requirements

* **Browser**: Google Chrome, Microsoft Edge, or Opera (Chromium-based).
* **Driver**: If your ESP32 isn't recognized, install the [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) or [CH340](http://www.wch-ic.com/downloads/CH341SER_ZIP.html) drivers.

---

<div align="center">
<sub>Built with ❤️ using <a href="https://github.com/espressif/esptool-js">esptool-js</a> and Web Technologies.</sub>
</div>

```

```
