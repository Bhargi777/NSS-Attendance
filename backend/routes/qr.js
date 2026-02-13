const express = require("express");
const QRCode = require("qrcode");
const sharp = require("sharp");
const path = require("path");

const router = express.Router();

const LOGO_PATH = path.join(__dirname, "..", "assets", "amrita-logo.png");

// Canvas dimensions
const CANVAS_WIDTH = 350;
const CANVAS_HEIGHT = 450;
const LOGO_WIDTH = 200;
const QR_SIZE = 300;
const MARGIN = 30;

/**
 * Validate roll number input.
 * Alphanumeric and hyphens only, 5-20 characters.
 */
function validateRollNumber(rollNumber) {
    if (!rollNumber || typeof rollNumber !== "string") {
        return false;
    }
    const trimmed = rollNumber.trim();
    if (trimmed.length < 5 || trimmed.length > 20) {
        return false;
    }
    return /^[a-zA-Z0-9.\-]+$/.test(trimmed);
}

/**
 * POST /api/generate-qr
 * Accepts { rollNumber } and returns a base64-encoded PNG
 * with the Amrita logo above the QR code.
 */
router.post("/generate-qr", async (req, res) => {
    try {
        const { rollNumber } = req.body;

        // Validate
        if (!validateRollNumber(rollNumber)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid roll number. Must be 5-20 alphanumeric characters (dots and hyphens allowed).",
            });
        }

        const trimmedRoll = rollNumber.trim();

        // Generate QR code as buffer
        const qrBuffer = await QRCode.toBuffer(trimmedRoll, {
            width: QR_SIZE,
            errorCorrectionLevel: "M",
            color: {
                dark: "#000000",
                light: "#FFFFFF",
            },
        });

        // Load and resize logo
        const logoBuffer = await sharp(LOGO_PATH)
            .resize({ width: LOGO_WIDTH })
            .toBuffer();

        const logoMeta = await sharp(logoBuffer).metadata();
        const logoHeight = logoMeta.height;

        // Calculate positions to center everything
        const logoX = Math.round((CANVAS_WIDTH - LOGO_WIDTH) / 2);
        const logoY = MARGIN;
        const qrX = Math.round((CANVAS_WIDTH - QR_SIZE) / 2);
        const qrY = logoY + logoHeight + MARGIN;

        // Adjust canvas height dynamically
        const dynamicHeight = qrY + QR_SIZE + MARGIN;

        // Compose final image: white background + logo on top + QR below
        const composedImage = await sharp({
            create: {
                width: CANVAS_WIDTH,
                height: dynamicHeight,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        })
            .composite([
                { input: logoBuffer, top: logoY, left: logoX },
                { input: qrBuffer, top: qrY, left: qrX },
            ])
            .png()
            .toBuffer();

        const base64Image = composedImage.toString("base64");

        return res.json({
            success: true,
            image: base64Image,
        });
    } catch (error) {
        console.error("QR generation error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate QR code. Please try again.",
        });
    }
});

module.exports = router;
