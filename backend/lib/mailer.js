const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendOtpEmail(to, code) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Nimbus <no-reply@nimbus.app>',
    to,
    subject: 'Your Nimbus login code',
    text: `Your login code is ${code}. It expires in 10 minutes.`,
  });
}

module.exports = { sendOtpEmail };
