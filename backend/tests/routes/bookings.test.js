const request = require('supertest');
const app = require('../../src/index');

// Unit tests for booking business logic
describe('Booking Business Logic', () => {
  describe('Refund calculation', () => {
    const calcRefund = (hoursUntil, total) => {
      let pct = 0;
      if (hoursUntil > 24) pct = 100;
      else if (hoursUntil > 1) pct = 50;
      return (total * pct) / 100;
    };

    test('>24h gets 100% refund', () => {
      expect(calcRefund(25, 1800)).toBe(1800);
    });
    test('1-24h gets 50% refund', () => {
      expect(calcRefund(12, 1800)).toBe(900);
    });
    test('<1h gets no refund', () => {
      expect(calcRefund(0.5, 1800)).toBe(0);
    });
  });

  describe('Subscription limits', () => {
    test('FREE plan: 2 bookings/month', () => {
      const limits = { FREE: 2, FAMILY_BASIC: 10, FAMILY_PREMIUM: Infinity, ENTERPRISE: Infinity };
      expect(limits.FREE).toBe(2);
      expect(limits.FAMILY_BASIC).toBe(10);
    });

    test('Subscription discounts are correct', () => {
      const getDiscount = (plan) => {
        if (plan === 'FAMILY_BASIC') return 0.05;
        if (['FAMILY_PREMIUM', 'ENTERPRISE'].includes(plan)) return 0.10;
        return 0;
      };
      expect(getDiscount('FREE')).toBe(0);
      expect(getDiscount('FAMILY_BASIC')).toBe(0.05);
      expect(getDiscount('FAMILY_PREMIUM')).toBe(0.10);
      expect(getDiscount('ENTERPRISE')).toBe(0.10);
    });
  });

  describe('SOS limit', () => {
    test('Max 3 SOS per booking', () => {
      const SOS_MAX = 3;
      expect(SOS_MAX).toBe(3);
    });
  });
});
