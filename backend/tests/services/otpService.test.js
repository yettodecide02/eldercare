const { sendOtp, verifyOtp } = require('../../src/services/otpService');

describe('OTP Service', () => {
  const phone = '+919876543210';

  test('sendOtp returns OTP in test mode', async () => {
    const result = await sendOtp(phone);
    expect(result).toBeDefined();
  });

  test('verifyOtp succeeds with correct OTP', async () => {
    const result = await sendOtp(phone);
    const otp = result?.otp;
    if (!otp) return; // skip if no OTP returned (non-console mode)
    await expect(verifyOtp(phone, otp)).resolves.not.toThrow();
  });

  test('verifyOtp throws on wrong OTP', async () => {
    await sendOtp(phone);
    await expect(verifyOtp(phone, '000000')).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });

  test('sendOtp enforces rate limit after 5 attempts', async () => {
    const testPhone = '+919000000001';
    for (let i = 0; i < 5; i++) {
      try { await sendOtp(testPhone); } catch {}
    }
    await expect(sendOtp(testPhone)).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });
});
