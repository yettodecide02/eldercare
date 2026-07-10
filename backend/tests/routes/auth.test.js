const request = require('supertest');
const app = require('../../src/index');

describe('Auth Routes', () => {
  describe('POST /api/auth/send-otp', () => {
    test('returns 400 for invalid phone format', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '9876543210' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_PHONE_FORMAT');
    });

    test('returns 200 for valid Indian phone', async () => {
      const res = await request(app).post('/api/auth/send-otp').send({ phone: '+919876543210' });
      expect(res.status).toBe(200);
      expect(res.body.expiresIn).toBe(600);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    test('returns 400 for wrong OTP', async () => {
      await request(app).post('/api/auth/send-otp').send({ phone: '+919876540000' });
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: '+919876540000', otp: '000000' });
      expect(res.status).toBe(400);
    });

    test('returns 400 for non-numeric OTP', async () => {
      const res = await request(app).post('/api/auth/verify-otp').send({ phone: '+919876543210', otp: 'ABCDEF' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /health', () => {
    test('returns 200', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
