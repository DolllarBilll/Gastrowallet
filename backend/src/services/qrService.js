const QRCode = require('qrcode');

async function generateQrDataUrl(qrToken) {
  // Encode only the unique customer QR token for lookup
  return QRCode.toDataURL(String(qrToken), {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  });
}

async function generateQrPngBuffer(qrToken) {
  return QRCode.toBuffer(String(qrToken), {
    errorCorrectionLevel: 'M',
    width: 300,
    margin: 2,
  });
}

module.exports = { generateQrDataUrl, generateQrPngBuffer };