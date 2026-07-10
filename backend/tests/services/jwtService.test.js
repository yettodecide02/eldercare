const { generateTempToken, verifyToken } = require('../../src/utils/jwt');

describe('JWT Utils', () => {
  test('generateTempToken creates valid temp token', () => {
    const token = generateTempToken('+919876543210');
    expect(token).toBeDefined();
    const payload = verifyToken(token);
    expect(payload.type).toBe('temp');
    expect(payload.phone).toBe('+919876543210');
  });

  test('verifyToken throws on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  test('verifyToken throws on tampered token', () => {
    const token = generateTempToken('+919876543210');
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });
});
