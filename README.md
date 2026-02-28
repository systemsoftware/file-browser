# file-browser

> Note: This project was discontinued before reaching full completion.

A minimalist, workspace-centric file manager for macOS built with **Electron**. This project explores deep system integration, using native macOS utilities to handle file associations, icon rendering, and virtual project management.

## ✨ Features

* **Workspace-First Workflow**: Create "virtual" project folders using symlinks, allowing you to organize files without moving them from their original locations.
* **Deep macOS Integration**:
* Uses `duti` to determine and manage file associations.
* Leverages `plutil` and `sips` to extract and cache high-fidelity `.icns` files as PNGs for the UI.
* Support for **QuickLook** (`qlmanage`) directly from the context menu.


* **Cloud Storage Detection**: Automatically detects and integrates OneDrive and Google Drive from `~/Library/CloudStorage`.
* **Custom Styling**: Set custom colors for individual folders or files to make your most important directories stand out.
* **Advanced Filtering**: Includes a custom JavaScript-based filter (`associations_filter.js`) to programmatically hide or show specific "Open With" applications.

## 🛠️ Prerequisites

To use the file association features, you should have `duti` installed on your system:

```bash
brew install duti
```

## 🏗️ Building Native Helpers
The app uses a small Swift utility to bridge with macOS file association APIs. You will need to compile this before running the app for the first time.

Compile FileAssociations
From the project root, run the following command to compile the Swift source into the executable required by index.js:
```bash
swiftc FileAssociations.swift -o FileAssociations
```

Note: Ensure the resulting binary is in the same directory as index.js, as the app calls it using a relative path (./FileAssociations).

## 🚀 Getting Started

1. **Clone the repository:**
```bash
git clone https://github.com/systemsoftware/file-browser.git
cd file-browser
```


2. **Install dependencies:**
```bash
npm install
```


3. **Run the application:**
```bash
electron .
```



## 📂 Project Structure

* `index.js`: Main process handling IPC, system calls, and native menu generation.
* `package.json`: Project metadata and dependencies, including `native-prompt` and `plist`.
* `FileAssociations`: (External) A helper binary used to fetch associated applications for specific file extensions.

## 📜 License

This project is licensed under the **MIT License**.