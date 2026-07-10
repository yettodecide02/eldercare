// src/pages/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Smartphone, ShieldCheck, Heart } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState('phone'); // phone | otp | signup
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [signupData, setSignupData] = useState({ name: '', role: 'CUSTOMER', city: '' });
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(600);
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone.match(/^\+91[6-9]\d{9}$/)) {
      return toast.error('Enter valid Indian phone number (+91XXXXXXXXXX)');
    }
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { phone });
      setStep('otp');
      startCountdown();
      toast.success('OTP sent!');
    } catch (err) {
      toast.error(err.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp });
      if (data.isNewUser) {
        setTempToken(data.tempToken);
        setStep('signup');
      } else {
        setAuth(data.user, data.token);
        navigate(data.user.role === 'ADMIN' ? '/admin' : '/');
      }
    } catch (err) {
      toast.error(err.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/complete-signup', signupData, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      setAuth(data.user, data.token);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/');
      toast.success('Welcome to ElderCare!');
    } catch (err) {
      toast.error(err.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ElderCare</h1>
          <p className="text-gray-500 mt-1">Trusted care for your loved ones</p>
        </div>

        <div className="card p-8">
          {step === 'phone' && (
            <form onSubmit={handleSendOtp}>
              <h2 className="text-xl font-semibold mb-2">Sign in</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your Indian phone number to get started</p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                className="input mb-4" type="tel" placeholder="+919876543210"
                value={phone} onChange={(e) => setPhone(e.target.value)} required
              />
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? 'Sending...' : <><Smartphone className="w-4 h-4" /> Send OTP</>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <h2 className="text-xl font-semibold mb-2">Verify OTP</h2>
              <p className="text-gray-500 text-sm mb-6">6-digit OTP sent to <strong>{phone}</strong></p>
              <input
                className="input mb-2 text-center text-2xl tracking-widest font-mono" type="text"
                placeholder="000000" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required
              />
              {countdown > 0 && (
                <p className="text-xs text-gray-400 mb-4 text-center">Expires in {formatCountdown(countdown)}</p>
              )}
              <button type="submit" className="btn-primary w-full justify-center mb-3" disabled={loading || otp.length < 6}>
                {loading ? 'Verifying...' : <><ShieldCheck className="w-4 h-4" /> Verify OTP</>}
              </button>
              <button type="button" className="btn-secondary w-full justify-center" onClick={() => { setStep('phone'); setOtp(''); }}>
                Change number
              </button>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={handleSignup}>
              <h2 className="text-xl font-semibold mb-2">Create Account</h2>
              <p className="text-gray-500 text-sm mb-6">Just a few details to get started</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input className="input" placeholder="Your full name" value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">I am a</label>
                  <select className="input" value={signupData.role}
                    onChange={(e) => setSignupData({ ...signupData, role: e.target.value })}>
                    <option value="CUSTOMER">Customer (Booking care for family)</option>
                    <option value="CAREGIVER">Caregiver (Providing care services)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input className="input" placeholder="Your city" value={signupData.city}
                    onChange={(e) => setSignupData({ ...signupData, city: e.target.value })} required />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center mt-6" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
