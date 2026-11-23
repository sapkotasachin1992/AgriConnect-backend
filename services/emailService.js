const mailer = require('../config/mailer');

async function sendMail({ to, subject, html }) {
  try {
    await mailer.sendMail({
      from: `"AgriConnect Nepal 🌾" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error(`❌ Email to ${to} FAILED — check SMTP_USER/SMTP_PASS in .env. Reason: ${e.message}`);
    return { sent: false, reason: e.message };
  }
}

const OTP_HTML = (otp, title, body) => `
  <div style="font-family:'DM Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f7f5f0;border-radius:16px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <span style="font-size:28px;">🌾</span>
        <span style="font-size:22px;font-weight:800;color:#1e6e1e;">AgriConnect</span>
      </div>
    </div>
    <div style="background:white;border-radius:12px;padding:28px 24px;border:1px solid #ede8dc;">
      <h2 style="color:#3a2a1f;font-size:20px;margin:0 0 10px;">${title}</h2>
      <p style="color:#8b7050;font-size:14px;line-height:1.6;margin:0 0 24px;">${body}</p>
      <div style="text-align:center;background:#f0f9f0;border:2px dashed #44b044;border-radius:12px;padding:20px;">
        <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#1e6e1e;font-family:monospace;">${otp}</div>
        <p style="color:#6f5540;font-size:12px;margin:8px 0 0;">Valid for 15 minutes</p>
      </div>
    </div>
    <p style="text-align:center;color:#a68f69;font-size:11px;margin-top:20px;">
      If you didn't request this, you can safely ignore this email.<br/>
      © ${new Date().getFullYear()} AgriConnect Nepal
    </p>
  </div>
`;

module.exports = { sendMail, OTP_HTML };
