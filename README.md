# Amrita Roll Number QR Generator

A full-stack web application that generates QR codes for Amrita Vishwa Vidyapeetham student roll numbers, with the Amrita logo composited above the QR code.

## Features

- Enter a roll number and generate a QR code
- Amrita logo automatically placed above the QR code
- Modal popup to view and download the QR image
- Input validation with helpful error messages
- Downloadable PNG with logo + QR combined

## Tech Stack

**Frontend:** Next.js (App Router), TypeScript, Tailwind CSS  
**Backend:** Node.js, Express.js, qrcode, sharp

## Project Structure

```
├── backend/
│   ├── server.js          # Express server entry point
│   ├── routes/
│   │   └── qr.js          # QR generation API route  
│   ├── assets/
│   │   └── amrita-logo.png
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Main page
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   └── QRModal.tsx     # QR display modal
│   ├── services/
│   │   └── api.ts          # API service layer
│   └── package.json
└── PRD.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Backend Setup

```bash
cd backend
npm install
npm start
```

The backend runs on `http://localhost:5000` by default.

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

Then start the dev server:

```bash
npm run dev
```

The frontend runs on `http://localhost:3000`.

## API

### POST /api/generate-qr

**Request:**
```json
{
  "rollNumber": "CB.EN.U4CSE12345"
}
```

**Response (success):**
```json
{
  "success": true,
  "image": "<base64-encoded-png>"
}
```

**Response (error):**
```json
{
  "success": false,
  "message": "Invalid roll number."
}
```

## Deployment

- **Backend:** Deploy to Render (see setup instructions below)
- **Frontend:** Deploy to Vercel (see setup instructions below)
