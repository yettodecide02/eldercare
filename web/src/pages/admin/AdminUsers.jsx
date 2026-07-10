import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserCheck, UserX, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../lib/api';

export default function AdminUsers() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ search: '', isActive: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', filters],
    queryFn: () => api.get('/admin/customers', { params: filters }).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => api.put(`/admin/customers/${id}/toggle-active`),
    onSuccess: (res) => {
      toast.success(res.data.isActive ? 'Account activated' : 'Account deactivated');
      qc.invalidateQueries({ queryKey: ['admin-customers'] });
    },
    onError: () => toast.error('Action failed'),
  });

  const customers = data?.customers ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users size={24} className="text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Management</h1>
        <span className="badge badge-info ml-auto">{total} customers</span>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-8 text-sm w-full"
              placeholder="Name or phone…"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            className="input text-sm"
            value={filters.isActive}
            onChange={e => setFilters(f => ({ ...f, isActive: e.target.value, page: 1 }))}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Deactivated</option>
          </select>
        </div>
        <button className="btn btn-secondary text-sm" onClick={() => setFilters({ search: '', isActive: '', page: 1 })}>
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
            <tr>
              {['Name', 'Phone', 'Email', 'Plan', 'Bookings', 'Elders', 'Joined', 'Status', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>
            ) : customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-medium">{c.user?.name}</td>
                <td className="px-4 py-3 text-gray-500">{c.user?.phone}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{c.user?.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge text-xs ${c.subscriptionPlan === 'FREE' ? 'badge-info' : 'badge-success'}`}>
                    {c.subscriptionPlan?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">{c._count?.bookings ?? 0}</td>
                <td className="px-4 py-3">{c._count?.elders ?? 0}</td>
                <td className="px-4 py-3 text-gray-500">
                  {c.user?.createdAt ? format(new Date(c.user.createdAt), 'dd MMM yy') : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${c.user?.isActive ? 'badge-success' : 'bg-red-100 text-red-600'}`}>
                    {c.user?.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMutation.mutate(c.id)}
                    disabled={toggleMutation.isPending}
                    className={`flex items-center gap-1 text-xs font-medium hover:underline transition-colors ${c.user?.isActive ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {c.user?.isActive ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} customers total</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary py-1 px-3 text-xs" disabled={filters.page === 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>Prev</button>
            <button className="btn btn-secondary py-1 px-3 text-xs" disabled={filters.page * 50 >= total} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
