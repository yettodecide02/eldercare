// src/pages/customer/CaregiverDetailPage.jsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MapPin, CheckCircle2, Clock, Award, ChevronLeft, Calendar, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { format } from 'date-fns';

const SERVICE_LABELS = {
  PERSONAL_CARE: 'Personal Care', MEDICATION_MANAGEMENT: 'Medication',
  COMPANIONSHIP: 'Companionship', MOBILITY_ASSISTANCE: 'Mobility',
  MEAL_PREPARATION: 'Meal Prep', HOUSEKEEPING: 'Housekeeping',
  TRANSPORTATION: 'Transport', MEDICAL_MONITORING: 'Medical Monitoring',
};

export default function CaregiverDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ date: '', startTime: '', duration: 2, serviceType: '', elderId: '', specialNotes: '' });

  const { data: caregiver, isLoading } = useQuery({
    queryKey: ['caregiver', id],
    queryFn: () => api.get(`/caregiver/${id}`).then(r => r.data),
  });

  const { data: elders } = useQuery({
    queryKey: ['elders'],
    queryFn: () => api.get('/customer/elders').then(r => r.data),
  });

  const bookMutation = useMutation({
    mutationFn: (data) => api.post('/bookings', data),
    onSuccess: () => {
      toast.success('Booking created! Waiting for caregiver confirmation.');
      setShowBookModal(false);
      queryClient.invalidateQueries(['bookings']);
    },
    onError: (err) => toast.error(err.error || 'Booking failed'),
  });

  const handleBook = (e) => {
    e.preventDefault();
    bookMutation.mutate({ ...bookingForm, caregiverId: id, date: bookingForm.date });
  };

  if (isLoading) return <div className="p-6 animate-pulse"><div className="h-8 bg-gray-200 rounded w-1/3 mb-4" /></div>;
  if (!caregiver) return <div className="p-6">Caregiver not found</div>;

  const totalAmount = parseFloat(caregiver.hourlyRate) * bookingForm.duration;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/search" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Back to search
      </Link>

      {/* Hero */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-3xl font-bold text-primary-700 flex-shrink-0">
            {caregiver.avatarUrl ? <img src={caregiver.avatarUrl} className="w-full h-full rounded-2xl object-cover" alt="" /> : caregiver.name?.[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{caregiver.name}</h1>
              {caregiver.isVerified && (
                <span className="flex items-center gap-1 badge badge-green">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {caregiver.city}</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> {caregiver.rating} ({caregiver.totalReviews} reviews)</span>
              <span className="flex items-center gap-1"><Award className="w-4 h-4" /> {caregiver.yearsOfExperience} yrs experience</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {caregiver.completedBookings} bookings</span>
            </div>
            {caregiver.bio && <p className="mt-3 text-gray-600 leading-relaxed">{caregiver.bio}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">₹{caregiver.hourlyRate}</p>
            <p className="text-sm text-gray-400">/hour</p>
            <button className="btn-primary mt-3" onClick={() => setShowBookModal(true)}>
              <Calendar className="w-4 h-4" /> Book Now
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Services */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Services Offered</h2>
            <div className="flex flex-wrap gap-2">
              {caregiver.serviceTypes?.map(s => (
                <span key={s} className="badge badge-blue px-3 py-1">{SERVICE_LABELS[s] || s}</span>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Reviews</h2>
            {caregiver.reviews?.length > 0 ? (
              <div className="space-y-4">
                {caregiver.reviews.map((r) => (
                  <div key={r.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900">{r.customerName}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                    </div>
                    {r.text && <p className="text-sm text-gray-600">{r.text}</p>}
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">No reviews yet</p>}
          </div>
        </div>

        <div className="space-y-5">
          {/* Languages */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-2 text-sm">Languages</h3>
            <div className="flex flex-wrap gap-1.5">
              {caregiver.languages?.map(l => <span key={l} className="badge badge-gray">{l}</span>)}
            </div>
          </div>

          {/* Certifications */}
          {caregiver.certifications?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-medium text-gray-900 mb-2 text-sm">Certifications</h3>
              <ul className="space-y-1">
                {caregiver.certifications.map(c => (
                  <li key={c} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Availability */}
          {caregiver.availability && Object.keys(caregiver.availability).length > 0 && (
            <div className="card p-5">
              <h3 className="font-medium text-gray-900 mb-2 text-sm">Availability</h3>
              <div className="space-y-1">
                {Object.entries(caregiver.availability).map(([day, hours]) => (
                  <div key={day} className="flex justify-between text-sm">
                    <span className="text-gray-600">{day.substring(0, 3)}</span>
                    <span className="text-gray-900 font-medium">{hours.start}–{hours.end}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-gray-900">Book {caregiver.name}</h2>
              <button onClick={() => setShowBookModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleBook} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input className="input" type="date" min={new Date().toISOString().split('T')[0]}
                  value={bookingForm.date} onChange={(e) => setBookingForm(p => ({ ...p, date: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input className="input" type="time"
                    value={bookingForm.startTime} onChange={(e) => setBookingForm(p => ({ ...p, startTime: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hrs)</label>
                  <select className="input" value={bookingForm.duration}
                    onChange={(e) => setBookingForm(p => ({ ...p, duration: parseInt(e.target.value) }))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(h => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                <select className="input" value={bookingForm.serviceType}
                  onChange={(e) => setBookingForm(p => ({ ...p, serviceType: e.target.value }))} required>
                  <option value="">Select service</option>
                  {caregiver.serviceTypes?.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Elder</label>
                <select className="input" value={bookingForm.elderId}
                  onChange={(e) => setBookingForm(p => ({ ...p, elderId: e.target.value }))} required>
                  <option value="">Select elder</option>
                  {(elders || []).map(e => <option key={e.id} value={e.id}>{e.name} ({e.relationship})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Notes</label>
                <textarea className="input" rows={2} placeholder="Any special care instructions..."
                  value={bookingForm.specialNotes} onChange={(e) => setBookingForm(p => ({ ...p, specialNotes: e.target.value }))} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">₹{caregiver.hourlyRate} × {bookingForm.duration} hrs</span>
                  <span className="font-semibold text-gray-900">₹{totalAmount}</span>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full justify-center" disabled={bookMutation.isPending}>
                {bookMutation.isPending ? 'Creating booking...' : `Confirm Booking — ₹${totalAmount}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
