// src/pages/admin/AdminDashboard.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, DollarSign, Star, AlertTriangle, UserCheck, TrendingUp, MapPin, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '../../lib/api';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const KPICard = ({ icon: Icon, label, value, sub, color = 'primary', alert }) => (
  <div className={`card p-5 ${alert ? 'border-amber-200 bg-amber-50' : ''}`}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center`}>
        <Icon className={`w-5 h-5 text-${color}-700`} />
      </div>
      {alert && <span className="badge badge-yellow">{alert}</span>}
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

function ActiveSessionsPanel({ onClose }) {
  const { data } = useQuery({
    queryKey: ['admin-active-bookings'],
    queryFn: () => api.get('/admin/active-bookings').then(r => r.data),
    refetchInterval: 30_000,
  });
  const sessions = data?.bookings ?? [];
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-800 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Live Sessions</h3>
          <p className="text-xs text-gray-400">{sessions.length} active now</p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No active sessions</div>
        ) : sessions.map(s => (
          <div key={s.id} className="px-4 py-3">
            <p className="text-sm font-medium text-gray-800 dark:text-white">{s.caregiverName}</p>
            <p className="text-xs text-gray-500">→ {s.customerName}</p>
            <p className="text-xs text-gray-400 mt-1">{s.serviceType?.replace(/_/g, ' ')} · #{s.bookingNumber}</p>
            {s.lastLocation && (
              <p className="text-xs text-primary-600 mt-1">
                📍 {parseFloat(s.lastLocation.latitude).toFixed(4)}, {parseFloat(s.lastLocation.longitude).toFixed(4)}
                <span className="text-gray-400 ml-1">· {new Date(s.lastLocation.timestamp).toLocaleTimeString()}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [showSessions, setShowSessions] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100" />)}
      </div>
    </div>
  );

  const m = data?.metrics || {};
  const charts = data?.charts || {};
  const alerts = data?.alerts || {};

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform overview</p>
        </div>
        <div className="flex gap-2">
          {alerts.pendingVerifications > 0 && (
            <span className="badge badge-yellow">{alerts.pendingVerifications} pending verifications</span>
          )}
          {alerts.activeDisputes > 0 && (
            <span className="badge badge-red">{alerts.activeDisputes} open disputes</span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard icon={Users} label="Total Users" value={m.totalUsers?.toLocaleString()} sub={`${m.totalCustomers} customers`} color="blue" />
        <KPICard icon={UserCheck} label="Active Caregivers" value={m.activeCaregivers} color="primary" />
        <KPICard icon={Calendar} label="Total Bookings" value={m.totalBookings?.toLocaleString()} sub={`${m.completedBookings} completed`} color="purple" />
        <KPICard icon={DollarSign} label="Total Revenue" value={`₹${(m.totalRevenue || 0).toLocaleString()}`} color="primary" />
        <div onClick={() => setShowSessions(true)} className="cursor-pointer">
          <KPICard icon={MapPin} label="Active Now" value={m.activeBookings} color="green" sub="Click for live view" />
        </div>
        <KPICard icon={Star} label="Avg Rating" value={parseFloat(m.avgRating || 0).toFixed(1)} color="yellow" />
        <KPICard icon={AlertTriangle} label="Pending Verify" value={alerts.pendingVerifications} color="amber"
          alert={alerts.pendingVerifications > 0 ? 'Action needed' : undefined} />
        <KPICard icon={AlertTriangle} label="Open Disputes" value={alerts.activeDisputes} color="red"
          alert={alerts.activeDisputes > 0 ? 'Review' : undefined} />
      </div>

      {showSessions && <ActiveSessionsPanel onClose={() => setShowSessions(false)} />}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily bookings */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Daily Bookings (Last 30 days)
          </h2>
          {charts.dailyBookings?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts.dailyBookings} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>

        {/* Service distribution */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Service Type Distribution</h2>
          {charts.serviceTypeDistribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts.serviceTypeDistribution} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={80} label={({ type, percent }) => `${type?.replace(/_/g, ' ')?.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {charts.serviceTypeDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n?.replace(/_/g, ' ')]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-gray-400 text-sm">No data</div>}
        </div>
      </div>
    </div>
  );
}
