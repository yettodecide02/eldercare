import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/authStore';
import { Home, Search, BookOpen, User, LogOut, Moon, Sun, Bell } from 'lucide-react';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Find Care', icon: Search },
  { to: '/bookings', label: 'Bookings', icon: BookOpen },
  { to: '/profile', label: 'Profile', icon: User },
];

export default function CustomerLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('eldercare-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <span className="text-xl">🌿</span>
        <span className="font-bold text-gray-900 dark:text-white text-sm flex-1">ElderCare</span>
        <button onClick={() => setDark(d => !d)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Bell size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400">
          {user?.name?.[0]}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex z-30 safe-bottom">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
