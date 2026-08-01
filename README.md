# ESP32 Tools

ESP32 firmware flashing tool for GitHub repositories, built with Web Serial API.

[Web Flasher](https://sadabx.github.io/ESP32-Tools) • [Report Bug](https://github.com/sadabx/esp32-tools/issues) • [GitHub Discussion](https://github.com/sadabx/esp32-tools/discussions)

## Features

- **Manual Flash**: Upload custom `.bin` files with offset addresses
- **Quick Install**: Validate and flash configured firmware packages from the repository
- **One-Click Deployment**: Flash pre-built firmware with single click
- Web Serial API integration (Chrome/Edge 89+)
- Multiple baud rates (115200 to 2,000,000)
- Full flash erase option
- Real-time, multi-image progress tracking
- Serial monitor with command input and an isolated UART connection
- Device info detection (Chip type, MAC address)
- Hardware reset control
- Responsive circuit-board interface inspired by [ESP32.net](http://esp32.net/)

## Quick Start

### Clone the Repository

```bash
git clone https://github.com/sadabx/esp32-tools.git
cd esp32-tools
```

### Firmware Structure

```
firmware/
├── projects.json           # Configuration file
├── project-name/
│   ├── bootloader.bin
│   ├── partitions.bin
│   └── your-firmware.bin
```

## Repository Structure

```
esp32-tools/
├── index.html              # Main application
├── assets/esp32-chip.svg  # ESP32-style site icon
├── css/styles.css         # Circuit-workbench interface
├── script.js              # Core functionality
├── README.md              # This file
└── firmware/              # Pre-built firmware
    ├── projects.json      # Project configuration
    ├── project-name/       # Example project
    │   ├── bootloader.bin
    │   ├── partitions.bin
    │   └── firmware.bin
    └── your-project/      # Your firmware here
```

## Configuration

### projects.json (`firmware/projects.json`)

```json
{
  "projects": {
    "project-name": {
      "name": "Project Display Name",
      "version": "1.0.0",
      "description": "Project description",
      "path": "folder-name",
      "files": [
        {
          "name": "bootloader.bin",
          "address": 4096,
          "size": 28672
        },
        {
          "name": "partitions.bin",
          "address": 32768,
          "size": 4096
        },
        {
          "name": "firmware.bin",
          "address": 65536,
          "size": 1048576
        }
      ]
    }
  }
}
```

## Usage

### Manual Flashing

1. Connect Device: Click "Connect Device" and select your ESP32
2. Add Files: Add `.bin` images with correct, non-overlapping offsets
3. Configure: Select baud rate and erase option
4. Flash: Click "Start Flashing"

### Auto Flashing

1. Connect Device: Ensure ESP32 is connected
2. Select Project: Choose an available package from the firmware catalog
3. Review: Check files and addresses
4. Flash: Click "Flash Automatically"

### Serial Monitor

1. Open Serial Scope: Choose the monitor baud rate and click Start Monitor
2. Monitor: The app opens a dedicated UART session and displays live output
3. Send: Type commands to send to device

## Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 89+ | Full Support |
| Edge | 89+ | Full Support |
| Firefox | - | Not Supported |
| Safari | - | Not Supported |

Requires Web Serial API support. Chrome/Edge recommended.

## Development

### Prerequisites

- Chromium based browser
- ESP32 development board
- USB cable

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Share your ESP32 open-source projects and distribute firmware directly through the repository.

## Quick Links

- [ESP32 Official Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [Web Serial API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [esptool-js Documentation](https://github.com/espressif/esptool-js)

---

Note: This tool requires physical access to the ESP32 device via USB and a compatible browser. Always verify firmware integrity before flashing.
