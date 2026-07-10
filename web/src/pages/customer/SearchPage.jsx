// src/pages/customer/SearchPage.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Star, MapPin, Filter, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

const SERVICE_TYPES = [
  'PERSONAL_CARE', 'MEDICATION_MANAGEMENT', 'COMPANIONSHIP',
  'MOBILITY_ASSISTANCE', 'MEAL_PREPARATION', 'HOUSEKEEPING', 'TRANSPORTATION', 'MEDICAL_MONITORING'
];

const formatService = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function SearchPage() {
  const [filters, setFilters] = useState({ city: '', serviceType: '', minRate: '', maxRate: '', minRating: '', sortBy: 'rating' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({ page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) }).toString();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['caregivers', queryParams],
    queryFn: () => api.get(`/caregiver/search?${queryParams}`).then(r => r.data),
    keepPreviousData: true,
  });

  const caregivers = data?.data || [];
  const pagination = data?.pagination;

  const updateFilter = (k, v) => { setFilters(prev => ({ ...prev, [k]: v })); setPage(1); };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Find Caregivers</h1>
        <p className="text-gray-500 mt-1">Browse verified, trained professionals</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="City (e.g. Bangalore)"
            value={filters.city} onChange={(e) => updateFilter('city', e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="card p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
            <select className="input text-sm" value={filters.serviceType} onChange={(e) => updateFilter('serviceType', e.target.value)}>
              <option value="">All services</option>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{formatService(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Rate (₹/hr)</label>
            <input className="input text-sm" type="number" placeholder="250" value={filters.minRate}
              onChange={(e) => updateFilter('minRate', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Rate (₹/hr)</label>
            <input className="input text-sm" type="number" placeholder="2000" value={filters.maxRate}
              onChange={(e) => updateFilter('maxRate', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Min Rating</label>
            <select className="input text-sm" value={filters.minRating} onChange={(e) => updateFilter('minRating', e.target.value)}>
              <option value="">Any rating</option>
              {[3, 3.5, 4, 4.5].map(r => <option key={r} value={r}>{r}+ stars</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sort By</label>
            <select className="input text-sm" value={filters.sortBy} onChange={(e) => updateFilter('sortBy', e.target.value)}>
              <option value="rating">Highest Rated</option>
              <option value="rate">Lowest Rate</option>
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full bg-gray-200" />
                <div className="flex-1"><div className="h-4 bg-gray-200 rounded mb-2 w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div>
              </div>
              <div className="h-3 bg-gray-200 rounded mb-2" /><div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : caregivers.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No caregivers found. Try different filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{pagination?.total || 0} caregivers found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {caregivers.map((cg) => (
              <Link key={cg.id} to={`/caregivers/${cg.id}`} className="card p-5 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl flex-shrink-0">
                    {cg.avatarUrl ? <img src={cg.avatarUrl} className="w-full h-full rounded-full object-cover" alt={cg.name} /> : cg.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 truncate">{cg.name}</h3>
                      {cg.isVerified && <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">{cg.rating || 'New'}</span>
                      <span className="text-xs text-gray-400">({cg.totalReviews || 0})</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" /> {cg.city}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{cg.hourlyRate}</p>
                    <p className="text-xs text-gray-400">/hr</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  {(cg.serviceTypes || []).slice(0, 3).map(s => (
                    <span key={s} className="badge badge-blue text-xs">{formatService(s)}</span>
                  ))}
                  {(cg.serviceTypes?.length || 0) > 3 && (
                    <span className="badge badge-gray">+{cg.serviceTypes.length - 3}</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${cg.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                    {cg.isOnline ? 'Available' : 'Offline'}
                  </span>
                  {cg.languages?.length > 0 && <span>{cg.languages.slice(0, 2).join(', ')}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
              <button className="btn-secondary" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
