# ESP32 Tools PRO

A modern, web-based flashing and diagnostic utility for Espressif ESP32 microcontrollers.

## 🚀 Key Features

* **Universal Browser Flasher**: Write multiple `.bin` files to specific memory offsets (e.g., `0x1000`, `0x10000`) without installing external software.
* **High-Speed Transmission**: Supports adjustable baud rates up to **921600 (Turbo)** for rapid firmware deployment.
* **Real-Time Serial Monitor**: Integrated terminal to view live debug logs and system output from the connected device.
* **Smart Device Detection**: Automatically identifies the chip type, MAC address, and hardware features upon connection.
* **Flash Management**: Built-in option to erase flash memory entirely before performing a new installation.
* **Pro UI**: A responsive, dark-themed interface built with a dual-column layout and "Glassmorphism" design elements.

## 🛠️ Technical Overview

This tool is built using high-performance web technologies:
* **Web Serial API**: Provides the direct hardware bridge between the browser and the ESP32.
* **esptool-js**: The core engine for communicating with the Espressif ROM bootloader.
* **esp-web-tools**: Integration for standardized web-based installation logic.
* **Custom CSS Design**: A GitHub-inspired design system using CSS Variables for a clean, professional aesthetic.

## 📖 How to Use

1.  **Connect**: Plug in your ESP32 and click **Connect Device**. Select the appropriate serial port in the browser prompt.
2.  **Configure**:
    * Set your memory offset (default is often `0x10000`).
    * Select your firmware `.bin` file.
    * Add additional rows if flashing multiple components like bootloaders or partition tables.
3.  **Flash**: Choose your baud rate, check "Erase First" if necessary, and click **Start Flashing**.
4.  **Monitor**: Once complete, switch to the **Serial Monitor** tab to interact with your running firmware.

## ⚠️ Requirements

* **Supported Browsers**: Google Chrome, Microsoft Edge, or any Chromium-based browser with Web Serial support.
* **Hardware**: A standard ESP32 development board and a data-capable USB cable.

---
*Repo holds ESP32 tools for educational purposes.*
