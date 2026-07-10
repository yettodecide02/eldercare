import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/authStore';
import LoginPage from './pages/auth/LoginPage';
import CustomerLayout from './pages/customer/CustomerLayout';
import CustomerHome from './pages/customer/CustomerHome';
import SearchPage from './pages/customer/SearchPage';
import CaregiverDetailPage from './pages/customer/CaregiverDetailPage';
import MyBookingsPage from './pages/customer/MyBookingsPage';
import BookingDetailPage from './pages/customer/BookingDetailPage';
import ProfilePage from './pages/customer/ProfilePage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import VerificationQueue from './pages/admin/VerificationQueue';
import AdminBookings from './pages/admin/AdminBookings';
import AdminReports from './pages/admin/AdminReports';
import AdminCaregivers from './pages/admin/AdminCaregivers';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminNotify from './pages/admin/AdminNotify';

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Customer routes */}
        <Route path="/" element={<ProtectedRoute roles={['CUSTOMER']}><CustomerLayout /></ProtectedRoute>}>
          <Route index element={<CustomerHome />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="caregiver/:id" element={<CaregiverDetailPage />} />
          <Route path="bookings" element={<MyBookingsPage />} />
          <Route path="booking/:id" element={<BookingDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="verification" element={<VerificationQueue />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="caregivers" element={<AdminCaregivers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="notify" element={<AdminNotify />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
