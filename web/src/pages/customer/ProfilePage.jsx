// src/pages/customer/ProfilePage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Plus, Edit2, Trash2, Heart, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';

const SUBSCRIPTION_PLANS = [
  { id: 'FREE', name: 'Free', price: 0, perks: ['2 bookings/month', 'Standard rates'] },
  { id: 'FAMILY_BASIC', name: 'Family Basic', price: 499, perks: ['10 bookings/month', '5% discount'] },
  { id: 'FAMILY_PREMIUM', name: 'Family Premium', price: 999, perks: ['Unlimited bookings', '10% discount', 'Priority support'] },
  { id: 'ENTERPRISE', name: 'Enterprise', price: 2999, perks: ['All Premium benefits', 'Dedicated support', 'Invoicing'] },
];

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showElderForm, setShowElderForm] = useState(false);
  const [elderForm, setElderForm] = useState({ name: '', age: '', relationship: '', specialNeeds: '' });

  const { data: profile } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => api.get('/customer/profile').then(r => r.data),
  });

  const { data: elders = [] } = useQuery({
    queryKey: ['elders'],
    queryFn: () => api.get('/customer/elders').then(r => r.data),
  });

  const addElderMutation = useMutation({
    mutationFn: (data) => api.post('/customer/elders', data),
    onSuccess: () => { toast.success('Elder added'); queryClient.invalidateQueries(['elders']); setShowElderForm(false); setElderForm({ name: '', age: '', relationship: '', specialNeeds: '' }); },
    onError: (err) => toast.error(err.error || 'Failed to add elder'),
  });

  const deleteElderMutation = useMutation({
    mutationFn: (id) => api.delete(`/customer/elders/${id}`),
    onSuccess: () => { toast.success('Elder removed'); queryClient.invalidateQueries(['elders']); },
  });

  const currentPlan = profile?.profile?.subscriptionPlan || 'FREE';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <div className="space-y-6">
        {/* Personal info */}
        <div className="card p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold">
              {user?.name?.[0]}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{user?.name}</h2>
              <p className="text-sm text-gray-500">{user?.phone}</p>
              {user?.email && <p className="text-sm text-gray-500">{user?.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">City</span><p className="font-medium">{profile?.profile?.city || '—'}</p></div>
            <div><span className="text-gray-500">Emergency Contact</span><p className="font-medium">{profile?.profile?.emergencyContact || '—'}</p></div>
          </div>
        </div>

        {/* Subscription */}
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Subscription Plan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUBSCRIPTION_PLANS.map(plan => (
              <div key={plan.id} className={`rounded-xl border-2 p-4 ${currentPlan === plan.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{plan.name}</h3>
                  <span className="font-bold text-gray-900">{plan.price === 0 ? 'Free' : `₹${plan.price}/mo`}</span>
                </div>
                <ul className="space-y-1">
                  {plan.perks.map(p => <li key={p} className="text-xs text-gray-500">• {p}</li>)}
                </ul>
                {currentPlan === plan.id ? (
                  <span className="badge badge-green mt-3">Current Plan</span>
                ) : (
                  <button className="btn-secondary text-xs mt-3 w-full justify-center">Upgrade</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Elders */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Elders in Care</h2>
            <button className="btn-primary text-sm" onClick={() => setShowElderForm(true)}>
              <Plus className="w-4 h-4" /> Add Elder
            </button>
          </div>

          {elders.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No elder profiles yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {elders.map(elder => (
                <div key={elder.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                    {elder.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{elder.name}</p>
                    <p className="text-sm text-gray-500">{elder.relationship}{elder.age ? ` · Age ${elder.age}` : ''}</p>
                    {elder.medicalConditions?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">{elder.medicalConditions.join(', ')}</p>
                    )}
                  </div>
                  <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    onClick={() => { if (confirm('Remove elder?')) deleteElderMutation.mutate(elder.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Elder Modal */}
      {showElderForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">Add Elder Profile</h2>
              <button onClick={() => setShowElderForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); addElderMutation.mutate(elderForm); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className="input" placeholder="Elder's name" value={elderForm.name}
                  onChange={(e) => setElderForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input className="input" type="number" min="50" max="110" value={elderForm.age}
                    onChange={(e) => setElderForm(p => ({ ...p, age: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship *</label>
                  <select className="input" value={elderForm.relationship}
                    onChange={(e) => setElderForm(p => ({ ...p, relationship: e.target.value }))} required>
                    <option value="">Select</option>
                    {['Mother', 'Father', 'Grandmother', 'Grandfather', 'Aunt', 'Uncle', 'Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Needs / Notes</label>
                <textarea className="input" rows={2} value={elderForm.specialNeeds}
                  onChange={(e) => setElderForm(p => ({ ...p, specialNeeds: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={addElderMutation.isPending}>
                {addElderMutation.isPending ? 'Adding...' : 'Add Elder'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
