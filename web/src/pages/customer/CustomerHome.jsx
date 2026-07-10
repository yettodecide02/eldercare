// src/pages/customer/CustomerHome.jsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Calendar, Star, Clock, ChevronRight, Heart, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/authStore';
import { format } from 'date-fns';

const statusColors = {
  PENDING: 'badge-yellow', CONFIRMED: 'badge-blue', ACTIVE: 'badge-green',
  COMPLETED: 'badge-gray', CANCELLED: 'badge-red',
};

export default function CustomerHome() {
  const { user } = useAuthStore();

  const { data: bookingsData } = useQuery({
    queryKey: ['bookings', 'customer'],
    queryFn: () => api.get('/bookings/customer?status=PENDING,CONFIRMED,ACTIVE&limit=3').then(r => r.data),
  });

  const { data: profileData } = useQuery({
    queryKey: ['customer-profile'],
    queryFn: () => api.get('/customer/profile').then(r => r.data),
  });

  const upcomingBookings = bookingsData?.data || [];
  const subscription = profileData?.profile?.subscriptionPlan || 'FREE';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 mt-1">How can we help with care today?</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link to="/search" className="card p-5 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary-200 transition-colors">
            <Search className="w-5 h-5 text-primary-700" />
          </div>
          <h3 className="font-semibold text-gray-900">Find Caregiver</h3>
          <p className="text-sm text-gray-500 mt-0.5">Search verified caregivers</p>
        </Link>
        <Link to="/bookings" className="card p-5 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <h3 className="font-semibold text-gray-900">My Bookings</h3>
          <p className="text-sm text-gray-500 mt-0.5">View & manage bookings</p>
        </Link>
      </div>

      {/* Subscription card */}
      <div className={`card p-5 mb-8 ${subscription !== 'FREE' ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white border-0' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${subscription !== 'FREE' ? 'text-primary-100' : 'text-gray-500'}`}>Your Plan</p>
            <h3 className={`text-xl font-bold mt-0.5 ${subscription !== 'FREE' ? 'text-white' : 'text-gray-900'}`}>
              {subscription.replace('_', ' ')}
            </h3>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${subscription !== 'FREE' ? 'bg-white/20' : 'bg-primary-100'}`}>
            <Heart className={`w-5 h-5 ${subscription !== 'FREE' ? 'text-white' : 'text-primary-600'}`} />
          </div>
        </div>
        {subscription === 'FREE' && (
          <Link to="/profile" className="inline-flex items-center gap-1 mt-3 text-sm text-primary-600 font-medium hover:underline">
            Upgrade for discounts <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Upcoming bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming Bookings</h2>
          <Link to="/bookings" className="text-sm text-primary-600 hover:underline font-medium flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {upcomingBookings.length === 0 ? (
          <div className="card p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming bookings</p>
            <Link to="/search" className="btn-primary mt-4 inline-flex">Find a Caregiver</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <Link key={booking.id} to={`/bookings/${booking.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                  {booking.caregiver?.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{booking.caregiver?.name}</p>
                  <p className="text-sm text-gray-500">
                    {booking.date ? format(new Date(booking.date), 'MMM d, yyyy') : '—'} · {booking.startTime}–{booking.endTime}
                  </p>
                </div>
                <span className={statusColors[booking.status] || 'badge-gray'}>{booking.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
