// src/pages/customer/MyBookingsPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Star, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { format } from 'date-fns';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Upcoming', value: 'CONFIRMED,PENDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const STATUS_STYLE = {
  PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', ACTIVE: 'badge-green',
  COMPLETED: 'badge-gray', CANCELLED: 'badge-red', DISPUTED: 'badge-red',
};

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', 'customer', activeTab, page],
    queryFn: () => api.get(`/bookings/customer?${activeTab ? `status=${activeTab}&` : ''}page=${page}&limit=20`).then(r => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/bookings/${id}/cancel`, { reason }),
    onSuccess: () => { toast.success('Booking cancelled'); queryClient.invalidateQueries(['bookings']); },
    onError: (err) => toast.error(err.error || 'Cancel failed'),
  });

  const bookings = data?.data || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.value}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => { setActiveTab(tab.value); setPage(1); }}>
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-24 animate-pulse bg-gray-100" />)}</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No bookings found</p>
          <Link to="/search" className="btn-primary mt-4 inline-flex">Find a Caregiver</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="card p-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0">
                  {booking.caregiver?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{booking.caregiver?.name}</span>
                    <span className={STATUS_STYLE[booking.status] || 'badge-gray'}>{booking.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {booking.date ? format(new Date(booking.date), 'EEE, MMM d') : '—'} · {booking.startTime}–{booking.endTime}
                    {booking.elder && ` · ${booking.elder.name}`}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">₹{booking.totalAmount}</p>
                </div>
                <div className="flex items-center gap-2">
                  {booking.status === 'ACTIVE' && (
                    <button className="btn-danger text-xs px-3 py-1.5">
                      <AlertTriangle className="w-3 h-3" /> SOS
                    </button>
                  )}
                  {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                    <button className="btn-secondary text-xs px-3 py-1.5"
                      onClick={() => { if (confirm('Cancel booking?')) cancelMutation.mutate({ id: booking.id, reason: 'Customer cancelled' }); }}>
                      Cancel
                    </button>
                  )}
                  <Link to={`/bookings/${booking.id}`} className="btn-secondary text-xs px-3 py-1.5">
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.pagination?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span className="text-sm text-gray-500 flex items-center">{page} / {data.pagination.pages}</span>
          <button className="btn-secondary" disabled={page === data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
