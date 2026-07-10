import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/authStore';
import { LayoutDashboard, ShieldCheck, BookOpen, AlertTriangle, Users, UserCheck, BarChart2, Settings, LogOut, Menu, Bell, Moon, Sun, MessageSquare } from 'lucide-react';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/verification', icon: ShieldCheck, label: 'Verification' },
  { to: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
  { to: '/admin/reports', icon: AlertTriangle, label: 'Reports' },
  { to: '/admin/caregivers', icon: UserCheck, label: 'Caregivers' },
  { to: '/admin/users', icon: Users, label: 'Customers' },
  { to: '/admin/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/admin/notify', icon: MessageSquare, label: 'Notify' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('eldercare-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-56 bg-gray-900 dark:bg-gray-950 flex flex-col border-r border-gray-800 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}>
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <div>
              <p className="text-white font-bold text-sm">ElderCare</p>
              <p className="text-gray-500 text-xs">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-gray-800 space-y-2">
          <p className="text-gray-500 text-xs truncate">{user?.name}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-gray-500 hover:text-red-400 text-sm transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <button onClick={() => setDark(d => !d)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Toggle dark mode">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 relative">
            <Bell size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-400">
            {user?.name?.[0]}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
