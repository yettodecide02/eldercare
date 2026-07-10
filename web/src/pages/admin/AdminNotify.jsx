import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function AdminNotify() {
  const [form, setForm] = useState({ title: '', message: '', audience: 'ALL' });

  const sendMutation = useMutation({
    mutationFn: () => api.post('/admin/notify/bulk', form),
    onSuccess: (res) => {
      toast.success(`Sent to ${res.data.sent} users`);
      setForm({ title: '', message: '', audience: 'ALL' });
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to send'),
  });

  const handleSend = () => {
    if (!form.title.trim() || !form.message.trim()) return toast.error('Title and message required');
    if (!window.confirm(`Send to all ${form.audience === 'ALL' ? 'users' : form.audience.toLowerCase() + 's'}?`)) return;
    sendMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Bell size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Notifications</h1>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Audience</label>
          <div className="flex gap-3">
            {[
              { value: 'ALL', label: 'Everyone' },
              { value: 'CUSTOMER', label: 'Customers only' },
              { value: 'CAREGIVER', label: 'Caregivers only' },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${form.audience === opt.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                <input type="radio" className="hidden" value={opt.value} checked={form.audience === opt.value} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
          <input
            className="input w-full"
            placeholder="Notification title…"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
          <textarea
            className="input w-full"
            rows={4}
            placeholder="Write your notification message here…"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.message.length}/500</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-400">
          This will send a push notification to <strong>all active {form.audience === 'ALL' ? 'users' : form.audience.toLowerCase() + 's'}</strong> immediately. This action cannot be undone.
        </div>

        <button
          onClick={handleSend}
          disabled={sendMutation.isPending || !form.title.trim() || !form.message.trim()}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {sendMutation.isPending ? 'Sending…' : 'Send Notification'}
        </button>

        {sendMutation.isSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-sm text-green-700 dark:text-green-400 text-center">
            Notification sent to {sendMutation.data?.data?.sent} users successfully
          </div>
        )}
      </div>
    </div>
  );
}
