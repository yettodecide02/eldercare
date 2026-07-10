import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, Ban, CheckCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const STATUS_COLORS = {
  VERIFIED: 'badge-success',
  UNDER_REVIEW: 'badge-warning',
  REJECTED: 'badge-danger',
  SUSPENDED: 'bg-gray-100 text-gray-600',
};

export default function AdminCaregivers() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ status: '', city: '', page: 1 });
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-caregivers', filters],
    queryFn: () => api.get('/admin/caregivers', { params: filters }).then(r => r.data),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }) => api.put(`/admin/caregivers/${id}/suspend`, { reason }),
    onSuccess: () => {
      toast.success('Caregiver suspended');
      qc.invalidateQueries({ queryKey: ['admin-caregivers'] });
      setSuspendTarget(null);
      setReason('');
    },
    onError: () => toast.error('Action failed'),
  });

  const caregivers = data?.caregivers ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Caregivers</h1>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            className="input text-sm"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          >
            <option value="">All</option>
            {['VERIFIED','UNDER_REVIEW','REJECTED','SUSPENDED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
          <input
            className="input text-sm"
            placeholder="Filter by city"
            value={filters.city}
            onChange={e => setFilters(f => ({ ...f, city: e.target.value, page: 1 }))}
          />
        </div>
        <button
          className="btn btn-secondary text-sm"
          onClick={() => setFilters({ status: '', city: '', page: 1 })}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              {['Name','Phone','City','Services','Rate (₹/hr)','Rating','Bookings','Status','Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : caregivers.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No caregivers found</td></tr>
            ) : caregivers.map(cg => (
              <tr key={cg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{cg.user?.name}</td>
                <td className="px-4 py-3 text-gray-500">{cg.user?.phone}</td>
                <td className="px-4 py-3">{cg.city}</td>
                <td className="px-4 py-3 max-w-[140px]">
                  <div className="flex flex-wrap gap-1">
                    {(cg.serviceTypes ?? []).slice(0, 2).map(s => (
                      <span key={s} className="badge badge-info text-xs">{s}</span>
                    ))}
                    {cg.serviceTypes?.length > 2 && (
                      <span className="badge bg-gray-100 text-gray-500 text-xs">+{cg.serviceTypes.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">₹{cg.hourlyRate}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Star size={13} className="text-yellow-400 fill-yellow-400" />
                    <span>{cg.avgRating ? parseFloat(cg.avgRating).toFixed(1) : '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{cg._count?.bookings ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[cg.verificationStatus] ?? 'badge-info'}`}>
                    {cg.verificationStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {cg.verificationStatus === 'VERIFIED' && (
                    <button
                      onClick={() => setSuspendTarget(cg)}
                      className="flex items-center gap-1 text-red-500 hover:underline text-xs"
                    >
                      <Ban size={13} /> Suspend
                    </button>
                  )}
                  {cg.verificationStatus === 'SUSPENDED' && (
                    <span className="text-gray-400 text-xs">Suspended</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} caregivers total</span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary py-1 px-3 text-xs"
              disabled={filters.page === 1}
              onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
            >Prev</button>
            <button
              className="btn btn-secondary py-1 px-3 text-xs"
              disabled={filters.page * 20 >= total}
              onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
            >Next</button>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-600">Suspend Caregiver</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You are about to suspend <strong>{suspendTarget.user?.name}</strong>. They will not appear in search results and cannot accept bookings.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                rows={3}
                className="input w-full"
                placeholder="Reason for suspension…"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => { setSuspendTarget(null); setReason(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger flex-1"
                disabled={!reason.trim() || suspendMutation.isPending}
                onClick={() => suspendMutation.mutate({ id: suspendTarget.id, reason })}
              >
                {suspendMutation.isPending ? 'Processing…' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
