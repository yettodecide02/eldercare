// src/pages/admin/VerificationQueue.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, FileText, User, Phone, MapPin, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { format } from 'date-fns';

const DOC_LABELS = {
  AADHAAR: 'Aadhaar Card',
  PAN_CARD: 'PAN Card',
  POLICE_CHECK: 'Police Verification',
  LIVE_SELFIE: 'Live Selfie',
  CERTIFICATION: 'Certification',
  PHOTO_ID: 'Photo ID',
};

function DocViewerModal({ docs, initialIndex, onClose }) {
  const [idx, setIdx] = useState(initialIndex || 0);
  const doc = docs[idx];
  const url = doc?.viewUrl || doc?.url;
  const isImage = url && !url.includes('.pdf') && (
    doc?.fileName?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ||
    doc?.type === 'LIVE_SELFIE' ||
    doc?.type === 'AADHAAR' ||
    doc?.type === 'PAN_CARD' ||
    doc?.type === 'PHOTO_ID'
  );

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{DOC_LABELS[doc?.type] || doc?.type?.replace(/_/g, ' ')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{doc?.fileName} · {idx + 1} of {docs.length}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline px-3 py-1.5 bg-blue-50 rounded-lg">
              Open in new tab ↗
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image / PDF preview */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-4 min-h-64">
          {!url ? (
            <div className="text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No preview URL available</p>
              <p className="text-xs mt-1">The document may not have been uploaded to cloud storage yet</p>
            </div>
          ) : isImage ? (
            <img src={url} alt={doc?.type} className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm" />
          ) : (
            <iframe src={url} className="w-full h-96 rounded-lg border-0" title={doc?.type} />
          )}
        </div>

        {/* Doc navigation */}
        {docs.length > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <button
              disabled={idx === 0}
              onClick={() => setIdx(i => i - 1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <div className="flex gap-2">
              {docs.map((d, i) => (
                <button key={d.id} onClick={() => setIdx(i)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${i === idx ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {DOC_LABELS[d.type]?.split(' ')[0] || d.type?.split('_')[0]}
                </button>
              ))}
            </div>
            <button
              disabled={idx === docs.length - 1}
              onClick={() => setIdx(i => i + 1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 disabled:opacity-30 hover:text-gray-900 transition-colors"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerificationQueue() {
  const queryClient = useQueryClient();
  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [page, setPage] = useState(1);
  const [docViewer, setDocViewer] = useState(null); // { docs, initialIndex }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-pending', page],
    queryFn: () => api.get(`/admin/caregivers/pending?page=${page}&limit=20`).then(r => r.data),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, reason }) => api.put(`/admin/caregivers/${id}/verify`, { action, reason }),
    onSuccess: (_, { action }) => {
      toast.success(action === 'APPROVE' ? 'Caregiver approved!' : 'Caregiver rejected');
      setSelectedCaregiver(null);
      setRejectReason('');
      queryClient.invalidateQueries(['admin-pending']);
      queryClient.invalidateQueries(['admin-dashboard']);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Action failed'),
  });

  const caregivers = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verification Queue</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review and approve/reject caregiver documents</p>
        </div>
        {data?.pagination?.total > 0 && (
          <span className="badge badge-yellow text-sm px-3 py-1">{data.pagination.total} pending</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card p-5 h-20 animate-pulse bg-gray-100" />)}</div>
      ) : caregivers.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Queue is empty — all caught up!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {caregivers.map((cg) => (
            <div key={cg.id} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 font-bold text-lg flex-shrink-0">
                  {cg.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{cg.name}</h3>
                    <span className="badge badge-yellow">UNDER REVIEW</span>
                    <span className="text-xs text-gray-400">
                      Submitted {cg.submittedAt ? format(new Date(cg.submittedAt), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap mb-3">
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {cg.phone}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {cg.city || '—'}</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {cg.documents?.length || 0} document{cg.documents?.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Document thumbnails */}
                  {cg.documents?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {cg.documents.map((doc, docIdx) => {
                        const previewUrl = doc.viewUrl || doc.url;
                        const isImg = previewUrl && (
                          doc.fileName?.match(/\.(jpg|jpeg|png|webp)$/i) ||
                          ['LIVE_SELFIE', 'AADHAAR', 'PAN_CARD', 'PHOTO_ID'].includes(doc.type)
                        );
                        return (
                          <button
                            key={doc.id}
                            onClick={() => setDocViewer({ docs: cg.documents, initialIndex: docIdx })}
                            className="relative group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-primary-400 transition-all hover:shadow-md"
                            title={`View ${DOC_LABELS[doc.type] || doc.type}`}
                          >
                            {isImg && previewUrl ? (
                              <div className="w-24 h-20 bg-gray-100 dark:bg-gray-800">
                                <img src={previewUrl} alt={doc.type} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-24 h-20 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center gap-1 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                                <FileText className="w-7 h-7 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                <span className="text-[10px] text-gray-400 px-1 text-center leading-tight">
                                  {DOC_LABELS[doc.type]?.split(' ')[0] || doc.type}
                                </span>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                              <p className="text-[9px] text-white truncate">{DOC_LABELS[doc.type] || doc.type}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button
                    className="btn btn-secondary text-sm flex items-center gap-1.5 border-green-200 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => verifyMutation.mutate({ id: cg.id, action: 'APPROVE', reason: 'Documents verified' })}
                    disabled={verifyMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                  <button
                    className="btn btn-secondary text-sm flex items-center gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setSelectedCaregiver({ ...cg, action: 'REJECT' })}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data?.pagination?.pages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm text-gray-500">
          <span>{data.pagination.total} total pending</span>
          <div className="flex gap-2">
            <button className="btn btn-secondary py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
            <button className="btn btn-secondary py-1 px-3 text-xs" disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {selectedCaregiver?.action === 'REJECT' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Reject Caregiver</h2>
            <p className="text-sm text-gray-500 mb-4">Provide a reason for <strong>{selectedCaregiver.name}</strong></p>
            <textarea className="input mb-4 w-full" rows={3} placeholder="Reason for rejection…"
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setSelectedCaregiver(null)}>Cancel</button>
              <button className="btn btn-danger flex-1" disabled={!rejectReason.trim() || verifyMutation.isPending}
                onClick={() => verifyMutation.mutate({ id: selectedCaregiver.id, action: 'REJECT', reason: rejectReason })}>
                {verifyMutation.isPending ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document viewer modal */}
      {docViewer && (
        <DocViewerModal
          docs={docViewer.docs}
          initialIndex={docViewer.initialIndex}
          onClose={() => setDocViewer(null)}
        />
      )}
    </div>
  );
}
