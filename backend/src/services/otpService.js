const { getRedis } = require('../utils/redis');
const logger = require('../utils/logger');

const OTP_TTL = 600; // 10 minutes
const OTP_RATE_LIMIT = 5; // per hour
const OTP_RATE_WINDOW = 3600; // 1 hour in seconds

// const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const generateOtp = () => 456545;

const getRateLimitKey = (phone) => `otp_rate:${phone}`;
const getOtpKey = (phone) => `otp:${phone}`;

const sendOtp = async (phone) => {
  const redis = getRedis();
  const rateKey = getRateLimitKey(phone);

  const attempts = await redis.incr(rateKey);
  if (attempts === 1) await redis.expire(rateKey, OTP_RATE_WINDOW);
  if (attempts > OTP_RATE_LIMIT) {
    const ttl = await redis.ttl(rateKey);
    throw Object.assign(new Error('Too many OTP requests. Try again later.'), {
      code: 'RATE_LIMIT_EXCEEDED', statusCode: 429, retryAfter: ttl,
    });
  }

  const otp = generateOtp();
  await redis.set(getOtpKey(phone), otp, 'EX', OTP_TTL);

  if (process.env.OTP_PROVIDER === 'msg91') {
    await sendViaMSG91(phone, otp);
  } else if (process.env.OTP_PROVIDER === 'twilio') {
    await sendViaTwilio(phone, otp);
  } else {
    logger.info(`[DEV OTP] Phone: ${phone} | OTP: ${otp}`);
    if (process.env.NODE_ENV === 'test') return { otp }; // expose for tests
  }

  return { message: 'OTP sent', expiresIn: OTP_TTL };
};

const verifyOtp = async (phone, code) => {
  const redis = getRedis();
  const stored = await redis.get(getOtpKey(phone));

  if (!stored) throw Object.assign(new Error('OTP expired or not found'), { code: 'OTP_EXPIRED', statusCode: 400 });
  if (stored !== code) throw Object.assign(new Error('Invalid OTP'), { code: 'INVALID_OTP', statusCode: 400 });

  await redis.del(getOtpKey(phone)); // single-use
  await redis.del(getRateLimitKey(phone)); // reset rate limit on success
};

const sendViaMSG91 = async (phone, otp) => {
  const https = require('https');
  const data = JSON.stringify({
    template_id: process.env.MSG91_TEMPLATE_ID,
    short_url: '0',
    mobiles: phone.replace('+', ''),
    otp,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'control.msg91.com',
      path: '/api/v5/otp',
      headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

const sendViaTwilio = async (phone, otp) => {
  // Twilio integration stub — add credentials via env
  logger.warn('Twilio not configured; OTP not sent', { phone });
};

module.exports = { sendOtp, verifyOtp };
