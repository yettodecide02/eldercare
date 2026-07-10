import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const TYPE_COLORS = {
  SAFETY: 'badge-danger',
  MISCONDUCT: 'badge-warning',
  PAYMENT: 'badge-info',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function AdminReports() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => api.get('/admin/reports', { params: { status: statusFilter } }).then(r => r.data),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }) => api.put(`/admin/reports/${id}/resolve`, { resolution }),
    onSuccess: () => {
      toast.success('Report resolved');
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      setResolving(null);
      setResolution('');
    },
    onError: () => toast.error('Failed to resolve'),
  });

  const reports = data?.reports ?? [];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {['OPEN','INVESTIGATING','RESOLVED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
          <p>No {statusFilter.toLowerCase()} reports</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => (
            <div key={r.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge text-xs ${TYPE_COLORS[r.type] ?? 'badge-info'}`}>{r.type}</span>
                      <span className="text-xs text-gray-400">{format(new Date(r.createdAt), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                    <p className="font-medium mt-1">{r.description}</p>
                  </div>
                </div>
                {r.status === 'OPEN' && (
                  <button
                    onClick={() => setResolving(r)}
                    className="btn btn-primary text-xs py-1.5 px-3 shrink-0"
                  >
                    Resolve
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                <div>
                  <p className="text-xs text-gray-400">Reported By</p>
                  <p className="font-medium">{r.reporter?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Reported Against</p>
                  <p className="font-medium">{r.reportedUser?.name ?? '—'}</p>
                </div>
                {r.booking && (
                  <div>
                    <p className="text-xs text-gray-400">Booking</p>
                    <p className="font-mono text-xs">{r.bookingId?.slice(0, 8)}…</p>
                  </div>
                )}
              </div>

              {r.resolution && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                  <span className="font-semibold">Resolution: </span>{r.resolution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {resolving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold">Resolve Report</h2>
            <div className="text-sm space-y-1">
              <p className="text-gray-500">Type: <span className="font-medium text-gray-800 dark:text-gray-200">{resolving.type}</span></p>
              <p className="text-gray-500">Description: <span className="font-medium text-gray-800 dark:text-gray-200">{resolving.description}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Resolution Notes</label>
              <textarea
                rows={4}
                className="input w-full"
                placeholder="Describe the action taken…"
                value={resolution}
                onChange={e => setResolution(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => { setResolving(null); setResolution(''); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={!resolution.trim() || resolveMutation.isPending}
                onClick={() => resolveMutation.mutate({ id: resolving.id, resolution })}
              >
                {resolveMutation.isPending ? 'Saving…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
