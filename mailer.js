const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Nimbus <onboarding@resend.dev>';

async function sendOtpEmail(to, code) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: 'Your Nimbus login code',
      text: `Your login code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to send OTP email: ${resp.status} ${errText}`);
  }
}

module.exports = { sendOtpEmail };
