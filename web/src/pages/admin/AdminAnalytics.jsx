import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import api from '../../lib/api';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const exportCSV = (data, filename) => {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn: () => api.get('/admin/analytics', { params: { period } }).then(r => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data),
  });

  const dailyBookings = dashboard?.charts?.dailyBookings ?? [];
  const serviceDistrib = dashboard?.charts?.serviceTypeDistribution ?? [];
  const revenueByMonth = dashboard?.charts?.revenueByMonth
    ? Object.entries(dashboard.charts.revenueByMonth).map(([month, revenue]) => ({ month, revenue }))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h1>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${period === p ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'New Users', val: data?.newUsers ?? '—' },
          { label: 'New Bookings', val: data?.newBookings ?? '—' },
          { label: 'Revenue', val: data?.revenue ? `₹${Number(data.revenue).toLocaleString('en-IN')}` : '—' },
          { label: 'Top Caregivers', val: data?.topCaregivers?.length ?? '—' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p className="text-2xl font-bold text-primary-600">{m.val}</p>
            <p className="text-xs text-gray-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Daily Bookings Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Daily Booking Trends</h2>
          <button onClick={() => exportCSV(dailyBookings, 'daily-bookings')} className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
            <Download size={13} /> Export CSV
          </button>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dailyBookings}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={d => new Date(d).toLocaleDateString('en-IN')} />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Bookings" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Revenue by Month</h2>
            <button onClick={() => exportCSV(revenueByMonth, 'revenue')} className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
              <Download size={13} /> CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Service Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Service Distribution</h2>
            <button onClick={() => exportCSV(serviceDistrib, 'services')} className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
              <Download size={13} /> CSV
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={serviceDistrib} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }) => `${type.replace('_', ' ')} ${(percent * 100).toFixed(0)}%`}>
                {serviceDistrib.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Caregivers Table */}
      {data?.topCaregivers?.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-lg font-bold">Top Caregivers</h2>
            <button onClick={() => exportCSV(data.topCaregivers, 'top-caregivers')} className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
              <Download size={13} /> Export
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
              <tr>
                {['Rank', 'Name', 'City', 'Completed', 'Rating', 'Earnings'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.topCaregivers.map((cg, i) => (
                <tr key={cg.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-bold text-gray-400">#{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{cg.user?.name}</td>
                  <td className="px-4 py-3">{cg.city}</td>
                  <td className="px-4 py-3">{cg.completedBookings}</td>
                  <td className="px-4 py-3">⭐ {cg.averageRating ? parseFloat(cg.averageRating).toFixed(1) : '—'}</td>
                  <td className="px-4 py-3 font-semibold">₹{Number(cg.totalEarnings || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Service Breakdown */}
      {data?.serviceBreakdown?.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-lg font-bold">Service Breakdown</h2>
            <button onClick={() => exportCSV(data.serviceBreakdown, 'service-breakdown')} className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
              <Download size={13} /> Export
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-xs uppercase text-gray-500">
              <tr>
                {['Service Type', 'Bookings', 'Revenue'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.serviceBreakdown.map(s => (
                <tr key={s.serviceType} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{s.serviceType?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{s.count}</td>
                  <td className="px-4 py-3 font-semibold">₹{Number(s.revenue || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
