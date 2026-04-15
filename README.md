# MedFlow Clinic Management System

<div align="center">
  <img src="public/icon.png" alt="MedFlow Clinic Logo" width="120" height="120" />
  <h3>Modern Offline Clinic Management & Receipt System</h3>
</div>

## 📌 Overview

**MedFlow Clinic** is a desktop application built to streamline clinic operations, seamlessly managing patient receipts, financial tracking, and medical history in a completely offline environment. Designed for speed and reliability, it ensures data privacy by keeping all information stored securely on the local machine.

## ✨ Features

- **🧾 Smart Receipt Generation**: Create professional receipts with options to select payment modes (Cash / Online).
- **📊 Financial Summaries**: Automatically track clinic earnings and filter by payment mode.
- **📂 Patient History Tracking**: Maintain a clean, table-based view of previous patient visits and payment history.
- **🔌 Offline-First Architecture**: Powered by `electron-store`, ensuring permanent, secure access without relying on an internet connection.
- **💻 Cross-Platform**: Packaged for both Windows and macOS using Electron.

## 🛠️ Technology Stack

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Desktop Environment**: [Electron](https://www.electronjs.org/)
- **Local Storage**: `electron-store`
- **Icons**: `lucide-react`
- **Date Management**: `date-fns`

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/clinic_receipt.git
   cd clinic_receipt
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the application in Development Mode:**
   ```bash
   npm run dev
   ```

### Building for Production

Compile and build the cross-platform application executables:

- **Build for macOS / default system:**
  ```bash
  npm run build
  ```

- **Build for Windows:**
  ```bash
  npm run build:win
  ```

The compiled executables will be available in the `release/` directory.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request if you have ideas for new features or improvements.

## 📄 License

This project is proprietary. Please refer to the generated license using the included License Generator for distribution details.
