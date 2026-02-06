# NSS Attendance System - Smart QR & Barcode Portal

A premium, high-performance attendance tracking system designed for NSS coordinators. Featuring a modern Glassmorphism UI, real-time QR scanning, and instant CSV export.

## Features

### Smart Scanner
- **Dual Support**: Scans both QR codes and standard Barcodes (Code 128, EAN, UPC, etc.).
- **High-Speed Detection**: Built on `html5-qrcode` for near-instant scanning.
- **Smart Parsing**: Automatically parses QR codes in the format `ROLL=xxx;NAME=yyy` or single roll number strings.
- **Audio Feedback**: Subtle "Scanner Beep" on successful entries.

### Lively UI & UX
- **Glassmorphism Design**: Modern, translucent interface with vibrant background gradients.
- **Live List**: See scanned students appear instantly in a scrollable view.
- **Micro-animations**: Smooth transitions and hover effects for a premium feel.

### Data & Export
- **Local Persistence**: Data is saved to `localStorage`—no data loss if you refresh or go offline.
- **CSV Export**: Single-click export of the entire session's attendance with Names, Roll Numbers, Time, and Date.
- **Manual Entry**: Fallback field for students without ID cards or scan issues.

## Quick Start

1. **Clone or Download** this repository.
2. **Open `index.html`** in any modern web browser (Chrome/Safari recommended for camera performance).
3. **Start Camera**: Request camera permissions when prompted.
4. **Scan**: Simply show the QR code or Barcode to the camera. It will be added to the list and saved instantly.
5. **Export**: When the session ends, click "Export CSV" to download your report.

## Technical Details

- **Frontend**: Vanilla HTML5, CSS3, and JavaScript.
- **Icons**: Lucide Icons.
- **Typography**: Outfit & Inter (Google Fonts).
- **Scanner**: html5-qrcode library.
- **Icons**: [Lucide](https://lucide.dev/)

## Project Structure

- `index.html`: The main portal (Single Page App).
- `qr.py`: Python script to generate student QR codes from a CSV.
- `roll.csv`: Template file for QR generation.
- `NSS.png` / `AMRITA.png`: Organization branding assets.

## Security & Privacy
This application runs entirely on the **client-side**. No student data is sent to a server; all attendance records are stored locally in your browser and exported directly to your machine.

---
