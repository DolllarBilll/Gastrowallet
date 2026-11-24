const nodemailer = require('nodemailer');
const { generateQrPngBuffer } = require('./qrService');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendCustomerPassEmail({
  toEmail,
  customerName,
  storeName,
  qrToken,
  walletUrl = null,
}) {
  // Skip sending when SMTP is not configured yet during local development
  if (!process.env.SMTP_HOST || process.env.SMTP_HOST === 'smtp.example.com') {
    return { skipped: true };
  }

  const qrBuffer = await generateQrPngBuffer(qrToken);

  const walletActionHtml = walletUrl
    ? `<p style="margin-top: 20px;">
         <a href="${walletUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
           Add to Mobile Wallet
         </a>
       </p>`
    : '';

  await transporter.sendMail({
    from: `"${storeName}" <${process.env.MAIL_FROM}>`,
    to: toEmail,
    subject: `Your GastroWallet Pass - ${storeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome, ${customerName}!</h2>
        <p>Here is your personal QR code for <strong>${storeName}</strong>. Show this code at the counter to collect and redeem points.</p>
        <div style="margin: 20px 0;">
          <img src="cid:gastrowallet-qr" alt="Loyalty QR Code" style="width: 220px; height: 220px;" />
        </div>
        ${walletActionHtml}
      </div>
    `,
    attachments: [
      {
        filename: 'gastrowallet-qr.png',
        content: qrBuffer,
        cid: 'gastrowallet-qr',
      },
    ],
  });

  return { skipped: false };
}

module.exports = { sendCustomerPassEmail };