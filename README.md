# Scroomin

[![Version](https://img.shields.io/github/package-json/v/sdrzfn/scroomin-privacy-screen?label=version&filename=scroomin-privacy-screen%2Fpackage.json)](https://github.com/sdrzfn/scroomin-privacy-screen/releases)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome)](https://github.com/sdrzfn/scroomin-privacy-screen/releases)
[![Privacy](https://img.shields.io/badge/Privacy-Local%20First-green)](#privacy)

<p align="center">
  <img src="https://raw.githubusercontent.com/sdrzfn/scroomin-privacy-screen/main/public/icons/logo-scroomin-no-text.png" alt="Scroomin Logo" width="120" height="120">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/sdrzfn/scroomin-privacy-screen/main/public/icons/logo_scroomin.png" alt="Scroomin Banner" width="100%">
</p>

## What is Scroomin?

Scroomin is a private screen extension for browser use, dedicated to people who wanted more privacy than just meet the eyes.

This is an early release for this product and currently at version 0.1.1. Please if you have any kind of problems or bugs while running this extension, kindly contact me.

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Installation](#installation)
  - [Method 1: Chrome Web Store](#method-1-chrome-web-store)
  - [Method 2: Download the release build](#method-2-download-the-release-build)
- [Usage](#usage)
- [Development setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Clone the repository](#clone-the-repository)
  - [Install packages](#install-packages)
  - [Build the extension](#build-the-extension)
  - [Load your build into Chrome](#load-your-build-into-chrome)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Reporting bugs and contact](#reporting-bugs-and-contact)
- [License](#license)

## Features

- **Auto mode (camera):** uses your webcam to detect whether you are in front of the screen. When you look away or leave, or when more than one face appears, the current tab is covered automatically. When you return, the screen is revealed again.
- **Manual mode:** covers the current tab until you turn protection off. No camera is used in this mode.
- **On-device processing:** face detection runs locally in the browser. No camera frame and no face data is saved or uploaded.
- **Light, dark, and system themes:** switch from the button in the popup header.

## How it works

1. You turn on Protection from the Scroomin popup.
2. In Auto mode, Scroomin asks for camera permission and reads the camera feed locally using MediaPipe face landmark detection.
3. It will automatically redirecting to a new page asking for camera permission.
4. Click on option "Allow while visiting this site".
5. The detected state (attending, away, or multiple faces) decides whether the active tab is covered.
6. Turning protection off stops the camera and uncovers the tab.

## Installation

You can install Scroomin in two ways. The Chrome Web Store is the easiest option and updates automatically. The release build is useful if you want a specific version, or if you cannot reach the store.

### Method 1: Chrome Web Store

1. Open the Scroomin page on the Chrome Web Store:
   `NOT AVAILABLE YET`
2. Click **Add to Chrome**.
3. Review the permission prompt and click **Add extension**.
4. Click the puzzle piece icon in the Chrome toolbar and pin **Scroomin** so it is always one click away.
5. Click the Scroomin icon to open the popup and start using it. See [Usage](#usage).

Extensions installed from the Chrome Web Store update automatically.

### Method 2: Download the release build

The release build is a ready-to-use package, so you do not need Node.js or any build tools.

1. Go to the Releases page of this repository:
   `https://github.com/sdrzfn/scroomin-privacy-screen/releases`
2. Download the latest build pack, for example `scroomin-v0.1.0.zip`, from the **Assets** section of the newest release.
3. Extract the zip file into a folder you will keep, for example `Documents/scroomin`. Do not delete this folder afterwards, because Chrome loads the extension directly from it.
4. Open Chrome and go to `chrome://extensions`.
5. Turn on **Developer mode** using the toggle in the top-right corner.
6. Click **Load unpacked**.
7. Select the extracted folder, the one that directly contains `manifest.json`. If you picked the wrong folder, Chrome will show a "Manifest file is missing or unreadable" error. Go one level down or up and try again.
8. Scroomin now appears in your extension list. Click the puzzle piece icon in the toolbar and pin it.

Notes for this method:

- Extensions loaded this way do not update automatically. To update, download the newer build pack, replace the contents of your folder, then click the reload icon on the Scroomin card in `chrome://extensions`.
- Chrome may show a banner about running extensions in developer mode when you restart the browser. This is expected for unpacked extensions.
- Other Chromium-based browsers (Edge, Brave, and similar) use the same steps from their own extensions page.

## Usage

1. Open the tab you want to protect, then click the Scroomin icon.
2. Turn on **Protection**.
3. Choose a mode:
   - **Auto:** Scroomin asks for camera access. When the browser prompt appears at the top-left, click **Allow**. The viewfinder in the popup shows your current state.
   - **Manual:** the tab is covered right away and stays covered until you turn protection off.
4. To stop, turn **Protection** off. The camera is released and the tab is uncovered.

The status display in the popup shows what is happening:

| State | Meaning |
| --- | --- |
| Attending | One face is detected. The screen stays visible. |
| Away | No face is detected. The screen is covered. |
| Multiple faces | More than one face is detected. The screen is covered. |
| Manual | Manual protection is on. The screen is covered. |
| Camera error | The camera could not start. See [Troubleshooting](#troubleshooting). |

## Development setup

Follow these steps if you want to run Scroomin from source, make changes, or build your own package.

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (a current LTS version is recommended) with npm, which is included with Node.js
- A Chromium-based browser such as Google Chrome

Check that everything is installed:

```bash
git --version
node --version
npm --version
```

### Clone the repository

```bash
git clone https://github.com/sdrzfn/scroomin-privacy-screen.git
cd scroomin
```

### Install packages

Install all dependencies listed in `package.json`:

```bash
npm install
```

If you prefer another package manager, use its equivalent command (`pnpm install` or `yarn install`).

### Build the extension

Create a production build:

```bash
npm run build
```

When the build finishes, the extension files are written to the `dist` folder. This folder contains `manifest.json`, the popup, the icons, and the bundled model and WASM files used for face detection.

If you want to rebuild automatically while you edit the code, use the development script if your `package.json` defines one:

```bash
npm run dev
```

To create a zip file you can share or attach to a release, compress the contents of the `dist` folder (not the folder itself), so that `manifest.json` sits at the top level of the archive.

### Load your build into Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.
4. After each new build, click the reload icon on the Scroomin card to apply your changes.

## Privacy

Scroomin is built to be local-first.

- **No data collection:** it does not collect, store, or transmit any personal data.
- **No camera recordings:** camera frames are processed locally in your browser and never saved or uploaded.
- **No face data stored:** face landmarks are computed in real time and discarded immediately after each frame.
- **Local-first:** all detection runs on your device using MediaPipe. Nothing leaves your machine.
- **Permission-based:** camera access is only requested when you enable Auto mode.

## Troubleshooting

**The camera permission prompt does not appear, or I clicked Block.**
Click the lock or tune icon in the address bar, or open the extension's site settings in Chrome, and allow the camera for Scroomin. Then open the popup and click **Try again**.

**"Couldn't start the camera" appears in the popup.**
Check that no other application is using the webcam, that the camera permission is allowed, and that the model and WASM files are present in the extension folder. If you built from source, run `npm run build` again and reload the extension.

**"Could not update this tab. Try refreshing the webpage."**
Refresh the page and try again. Browser-internal pages (such as `chrome://` pages) and the Chrome Web Store may not allow extensions to modify them, so protection may not work there.

**"Manifest file is missing or unreadable" when loading unpacked.**
You selected the wrong folder. Select the folder that directly contains `manifest.json`.

**The popup does not switch to dark mode automatically.**
Set the theme with the button in the popup header. The System option follows your operating system theme and needs a recent version of Chrome.

## Reporting bugs and contact

This is an early release, so feedback is very welcome. If you run into a problem, please open an issue on the repository:

`https://github.com/sdrzfn/scroomin-privacy-screen/issues`

When reporting a bug, please include:

- Your browser name and version
- Your operating system
- The Scroomin version (currently 0.1.1)
- The steps to reproduce the problem and what you expected to happen
- Any error message shown in the popup, or in the browser console

You can also contact me directly at `sadrakhxvid777@gmail.com`.

## License

There is no license yet for this project.