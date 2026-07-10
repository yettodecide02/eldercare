import { useQuery } from '@tanstack/react-query';
import { Settings, Info } from 'lucide-react';
import api from '../../lib/api';

const SettingRow = ({ label, value, hint }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
    <span className="text-sm font-semibold text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-full">{value}</span>
  </div>
);

export default function AdminSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then(r => r.data),
  });

  if (isLoading) return <div className="p-6 text-center text-gray-400">Loading settings…</div>;

  const settings = data || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          These are the current platform configuration values. To modify them, update the backend <code className="font-mono text-xs bg-blue-100 dark:bg-blue-800 px-1 rounded">src/routes/admin.js</code> settings endpoint or connect to a config management system.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commission */}
        <div className="card">
          <h2 className="text-base font-bold mb-3 text-gray-800 dark:text-white">Commission & Payouts</h2>
          <SettingRow label="Platform Commission" value={`${settings.commission?.percent}%`} hint="Applied to each booking" />
          <SettingRow label="Minimum Commission Fee" value={`₹${settings.commission?.minimumFee}`} />
          <SettingRow label="Minimum Payout Amount" value={`₹${settings.payoutMinimum}`} hint="Caregiver payout threshold" />
        </div>

        {/* Booking Rules */}
        <div className="card">
          <h2 className="text-base font-bold mb-3 text-gray-800 dark:text-white">Booking Rules</h2>
          <SettingRow label="Caregiver Rate Range" value={`₹${settings.rateRange?.min} – ₹${settings.rateRange?.max}/hr`} />
          <SettingRow label="Min Booking Lead Time" value={`${settings.bookingLeadTimeHours} hour`} hint="Cannot book within this window" />
          <SettingRow label="Max Booking Duration" value={`${settings.maxBookingHours} hours`} />
          <SettingRow label="SOS Alerts Per Booking" value={settings.sosLimit} hint="Maximum SOS triggers allowed" />
        </div>

        {/* Subscription Plans */}
        <div className="card">
          <h2 className="text-base font-bold mb-3 text-gray-800 dark:text-white">Subscription Prices</h2>
          {settings.subscriptionPrices && Object.entries(settings.subscriptionPrices).map(([plan, price]) => (
            <SettingRow key={plan} label={plan.replace('_', ' ')} value={price === 0 ? 'Free' : `₹${price}/mo`} />
          ))}
        </div>

        {/* System */}
        <div className="card">
          <h2 className="text-base font-bold mb-3 text-gray-800 dark:text-white">System Parameters</h2>
          <SettingRow label="OTP Rate Limit" value={`${settings.otpRateLimit} per hour`} hint="Per phone number" />
          <SettingRow label="GPS Update Frequency" value={`Every ${settings.gpsUpdateFrequencySeconds}s`} hint="During active bookings" />
          <SettingRow label="Caregiver Auto-offline" value={`${settings.caregiverAutoOfflineHours}h`} hint="If online without activity" />
        </div>
      </div>
    </div>
  );
}
