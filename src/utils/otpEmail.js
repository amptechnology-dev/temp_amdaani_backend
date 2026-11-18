import transporter from '../config/emailtransporter.js';
import config from '../config/config.js';

export const maskEmail = (email = '') => {
  if (!email.includes('@')) return email;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
};

export const sendOtpEmail = async (to, otp) => {
  await transporter.sendMail({
    from: config.email.from,
    to,
    subject: 'Your AMDAANI login OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px">
        <h2 style="letter-spacing:4px">${otp}</h2>
        <p>This is your OTP to login into AMDAANI. It will expire in 5 minutes.</p>
        <p style="color:#888;font-size:12px">Please do not share this OTP with anyone. - AMPTECH</p>
      </div>`,
  });
};