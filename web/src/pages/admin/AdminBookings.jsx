import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, Filter, Eye } from 'lucide-react';
import api from '../../lib/api';

const STATUS_COLORS = {
  PENDING: 'badge-warning',
  CONFIRMED: 'badge-info',
  ACTIVE: 'badge-success',
  COMPLETED: 'badge-success',
  CANCELLED: 'badge-danger',
  DISPUTED: 'badge-danger',
};

export default function AdminBookings() {
  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '', page: 1 });
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bookings', filters],
    queryFn: () => api.get('/admin/bookings', { params: filters }).then(r => r.data),
  });

  const bookings = data?.bookings ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            className="input text-sm"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
          >
            <option value="">All Statuses</option>
            {['PENDING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED','DISPUTED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.dateFrom}
            onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value, page: 1 }))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            className="input text-sm"
            value={filters.dateTo}
            onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value, page: 1 }))}
          />
        </div>
        <button
          className="btn btn-secondary text-sm"
          onClick={() => setFilters({ status: '', dateFrom: '', dateTo: '', page: 1 })}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              {['ID','Customer','Caregiver','Service','Date','Duration','Amount','Status','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No bookings found</td></tr>
            ) : bookings.map(b => (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{b.id.slice(0,8)}…</td>
                <td className="px-4 py-3 font-medium">{b.customer?.user?.name}</td>
                <td className="px-4 py-3 font-medium">{b.caregiver?.user?.name}</td>
                <td className="px-4 py-3">{b.serviceType}</td>
                <td className="px-4 py-3">{format(new Date(b.scheduledAt), 'dd MMM yyyy')}</td>
                <td className="px-4 py-3">{b.durationHours}h</td>
                <td className="px-4 py-3 font-semibold">₹{b.totalAmount}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[b.status] ?? 'badge-info'}`}>{b.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(b)} className="text-primary-600 hover:underline flex items-center gap-1">
                    <Eye size={14} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(filters.page - 1) * 20 + 1}–{Math.min(filters.page * 20, total)} of {total}</span>
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

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Booking Detail</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Booking ID', selected.id],
                ['Customer', selected.customer?.user?.name],
                ['Caregiver', selected.caregiver?.user?.name],
                ['Service', selected.serviceType],
                ['Scheduled', format(new Date(selected.scheduledAt), 'dd MMM yyyy HH:mm')],
                ['Duration', `${selected.durationHours} hours`],
                ['Amount', `₹${selected.totalAmount}`],
                ['Status', selected.status],
                ['Payment', selected.payment?.status ?? '—'],
                ['Notes', selected.notes ?? '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-medium">{val}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="btn btn-secondary w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
