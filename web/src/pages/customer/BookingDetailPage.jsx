// src/pages/customer/BookingDetailPage.jsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Star, CheckCircle2, Clock, MapPin, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { api } from '../../lib/api';

export default function BookingDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [review, setReview] = useState({ rating: 5, text: '' });
  const [showReview, setShowReview] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: (data) => api.post(`/bookings/${id}/review`, data),
    onSuccess: () => {
      toast.success('Review submitted!');
      setShowReview(false);
      queryClient.invalidateQueries(['booking', id]);
    },
    onError: (err) => toast.error(err.error || 'Failed to submit review'),
  });

  if (isLoading) return <div className="p-6 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-4" /></div>;
  if (!booking) return <div className="p-6">Booking not found</div>;

  const canReview = booking.status === 'COMPLETED' && booking.payment?.status === 'RELEASED' && !booking.review;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/bookings" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to bookings
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Booking #{booking.bookingNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{booking.createdAt ? format(new Date(booking.createdAt), 'MMM d, yyyy HH:mm') : ''}</p>
        </div>
        <span className={`badge text-sm px-3 py-1 ${
          booking.status === 'ACTIVE' ? 'badge-green' : booking.status === 'COMPLETED' ? 'badge-gray' :
          booking.status === 'CONFIRMED' ? 'badge-blue' : booking.status === 'PENDING' ? 'badge-yellow' : 'badge-red'
        }`}>{booking.status}</span>
      </div>

      <div className="space-y-4">
        {/* Caregiver info */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Caregiver</h3>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
              {booking.caregiver?.name?.[0]}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{booking.caregiver?.name}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                {booking.caregiver?.rating || 'New'}
              </div>
            </div>
            {booking.caregiver?.phone && ['CONFIRMED', 'ACTIVE'].includes(booking.status) && (
              <a href={`tel:${booking.caregiver.phone}`} className="btn-secondary text-sm">
                <Phone className="w-4 h-4" /> Call
              </a>
            )}
          </div>
        </div>

        {/* Booking details */}
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-500">Booking Details</h3>
          {[
            { label: 'Date', value: booking.bookingDate ? format(new Date(booking.bookingDate), 'EEEE, MMMM d, yyyy') : '—' },
            { label: 'Time', value: `${booking.startTime} – ${booking.endTime}` },
            { label: 'Duration', value: `${booking.duration} hours` },
            { label: 'Service', value: booking.serviceType?.replace(/_/g, ' ') },
            { label: 'Elder', value: booking.elder?.name },
          ].map(({ label, value }) => value && (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
          {booking.specialNotes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Special Notes</p>
              <p className="text-sm text-gray-700">{booking.specialNotes}</p>
            </div>
          )}
        </div>

        {/* Check-in/out */}
        {(booking.checkInTime || booking.checkOutTime) && (
          <div className="card p-5 space-y-2">
            <h3 className="text-sm font-medium text-gray-500">Timeline</h3>
            {booking.checkInTime && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-gray-600">Checked in at</span>
                <span className="font-medium">{format(new Date(booking.checkInTime), 'HH:mm')}</span>
              </div>
            )}
            {booking.checkOutTime && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Checked out at</span>
                <span className="font-medium">{format(new Date(booking.checkOutTime), 'HH:mm')}</span>
              </div>
            )}
          </div>
        )}

        {/* Payment */}
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Payment</h3>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900 text-lg">₹{booking.totalAmount}</span>
            <span className={`badge ${booking.payment?.status === 'RELEASED' ? 'badge-green' : booking.payment?.status === 'HELD' ? 'badge-blue' : 'badge-yellow'}`}>
              {booking.payment?.status || 'PENDING'}
            </span>
          </div>
        </div>

        {/* Existing review */}
        {booking.review && (
          <div className="card p-5">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Your Review</h3>
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < booking.review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
              ))}
            </div>
            <p className="text-sm text-gray-700">{booking.review.text}</p>
          </div>
        )}

        {/* Review form */}
        {canReview && (
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-4">Leave a Review</h3>
            <div className="flex items-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} type="button" onClick={() => setReview(p => ({ ...p, rating: r }))}>
                  <Star className={`w-8 h-8 transition-colors ${r <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`} />
                </button>
              ))}
            </div>
            <textarea className="input mb-3" rows={3} placeholder="Share your experience (optional, max 500 chars)"
              maxLength={500} value={review.text} onChange={(e) => setReview(p => ({ ...p, text: e.target.value }))} />
            <button className="btn-primary" onClick={() => reviewMutation.mutate(review)} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
