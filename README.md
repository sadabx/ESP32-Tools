# ESP32 Tools

<div align="center">

![ESP32 Web Flasher](https://img.shields.io/badge/ESP32-Web%20Flasher-blue)
![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-green)
![Web Serial API](https://img.shields.io/badge/Web%20Serial-API-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

**Professional ESP32 firmware flashing tool for GitHub repositories**

[Web Flasher](#) • [Report Bug](https://github.com/sadabx/esp32-tools/issues) • [Request Feature](https://github.com/sadabx/esp32-tools/issues)

</div>

## ✨ Features

### 🎯 **Dual Flashing Modes**
- **Manual Flash**: Upload custom `.bin` files with offset addresses
- **Auto Flash**: Automatically detect and flash firmware from repository
- **One-Click Deployment**: Flash pre-built firmware with single click

### 🔧 **Technical Capabilities**
- Web Serial API integration (Chrome/Edge 89+)
- Multiple baud rates (115200 to 2,000,000)
- Full flash erase option
- Real-time progress tracking
- Serial monitor with command input
- Device info detection (Chip type, MAC address)
- Hardware reset control


## 🚀 Quick Start

### ⿻ Clone the Repository
```bash
git clone https://github.com/sadabx/esp32-tools.git
cd esp32-tools
```

### 🛠️ Firmware Stucture
```
firmware/
├── projects.json           # Configuration file
├── project-name/
│   ├── bootloader.bin
│   ├── partitions.bin
│   └── your-firmware.bin
```

## 📁 Repository Structure

```
esp32-tools/
├── index.html              # Main application
├── style.css              # GitHub-themed styles
├── script.js              # Core functionality
├── README.md              # This file
└── firmware/              # Pre-built firmware
    ├── projects.json      # Project configuration
    ├── project-name/       # Example project
    │   ├── bootloader.bin
    │   ├── partitions.bin
    │   └── hello-world.bin
    └── your-project/      # Your firmware here
```

## 🛠️ Configuration

### Projects Configuration (`firmware/projects.json`)
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

## 📖 Usage Guide

### Manual Flashing
1. **Connect Device**: Click "Connect Device" and select your ESP32
2. **Add Files**: Add binary files with correct offsets
3. **Configure**: Select baud rate and erase option
4. **Flash**: Click "Start Flashing"

### Auto Flashing
1. **Connect Device**: Ensure ESP32 is connected
2. **Select Project**: Choose from repository projects
3. **Review**: Check files and addresses
4. **Flash**: Click "Flash Automatically"

### Serial Monitor
1. **Connect**: Device must be connected
2. **Monitor**: View real-time serial output
3. **Send**: Type commands to send to device

## 🌐 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 89+ | ✅ Full Support |
| Edge | 89+ | ✅ Full Support |
| Firefox | ❌ | Not Supported |
| Safari | ❌ | Not Supported |

**Note**: Requires Web Serial API support. Chrome/Edge recommended.

## 🧪 Development

### Prerequisites
- Chromium based browser
- ESP32 development board
- USB cable

### Adding New Features
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🤝 Contributing

Contributions make the open-source community amazing! Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- **Web Serial API**: Limited browser support
- **Large Files**: May require more memory on older devices
- **USB Drivers**: Some ESP32 boards need specific drivers

## 🎯 Share your esp32 project

- **Open Source Projects**: Distribute firmware with your repository


## 🙏 Acknowledgments

- [esptool-js](https://github.com/espressif/esptool-js) - ESP flashing library
- [GitHub Primer](https://primer.style/) - Design inspiration
- [Web Serial API](https://wicg.github.io/serial/) - Device communication

---

## 📞 Support

- **Documentation**: Check this README and code comments
- **Discussions**: [GitHub Discussions](https://github.com/sadabx/esp32-tools/discussions)
- **Email**: contact@trionine.xyz

## ⚡ Quick Links

- [ESP32 Official Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [Web Serial API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [esptool-js Documentation](https://github.com/espressif/esptool-js)
- [GitHub Pages Hosting](https://pages.github.com/)

---

**Note**: This tool requires physical access to the ESP32 device via USB and a compatible browser. Always verify firmware integrity before flashing.
