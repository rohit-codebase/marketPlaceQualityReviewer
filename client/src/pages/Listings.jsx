import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingService, reviewService } from '../services';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice, formatDate, truncate } from '../utils/formatters';

const CATEGORIES = ['Electronics','Clothing','Home','Beauty','Sports','Services','Books','Toys','Automotive','Garden'];

export default function Listings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [triggeringId, setTriggeringId] = useState(null);

  const fetchListings = useCallback(() => {
    setLoading(true);
    listingService.getAll({ status: filterStatus || undefined, category: filterCategory || undefined })
      .then((res) => { setListings(res.listings); setTotal(res.total); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filterStatus, filterCategory]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleTriggerReview = async (listingId) => {
    setTriggeringId(listingId);
    try {
      const res = await reviewService.trigger(listingId);
      navigate(`/reviews/${res.data._id}`);
    } catch (err) {
      alert(`Review failed: ${err.message}`);
      setTriggeringId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Listings</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total listing{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/listings/new" className="btn-primary inline-flex items-center justify-center text-center">+ New Listing</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          className="input w-full sm:w-auto min-w-[140px]"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {['active','under_review','approved','rejected'].map((s) => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
        <select
          className="input w-full sm:w-auto min-w-[140px]"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <div className="card text-red-400">{error}</div>
      ) : listings.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-3xl mb-3">📦</p>
          <p className="text-slate-400">No listings found.</p>
          <Link to="/listings/new" className="btn-primary inline-block mt-4">Create your first listing</Link>
        </div>
      ) : (
        <>
          {/* Mobile view (< md) */}
          <div className="block md:hidden space-y-3">
            {listings.map((l) => (
              <div key={l._id} className="card-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/listings/${l._id}`}
                    className="text-slate-100 hover:text-brand-400 font-medium text-sm leading-snug break-words flex-1 min-w-0"
                  >
                    {l.title}
                  </Link>
                  <div className="shrink-0">
                    <StatusBadge status={l.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block">Category</span>
                    <span className="text-slate-300 font-medium">{l.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Price</span>
                    <span className="text-slate-300 font-medium">{formatPrice(l.price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Seller</span>
                    <span className="text-slate-300 truncate block">{l.seller?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Created</span>
                    <span className="text-slate-400">{formatDate(l.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    id={`review-${l._id}-mobile`}
                    className="btn-primary text-xs py-2 px-4 w-full sm:w-auto"
                    onClick={() => handleTriggerReview(l._id)}
                    disabled={triggeringId === l._id}
                  >
                    {triggeringId === l._id ? 'Reviewing…' : 'Review'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/Tablet view (md+) */}
          <div className="hidden md:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Price</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Seller</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Created</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l._id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/listings/${l._id}`} className="text-slate-100 hover:text-brand-400 font-medium">
                          {truncate(l.title, 50)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{l.category}</td>
                      <td className="px-4 py-3 text-slate-300">{formatPrice(l.price)}</td>
                      <td className="px-4 py-3 text-slate-400">{l.seller?.name}</td>
                      <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          id={`review-${l._id}`}
                          className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                          onClick={() => handleTriggerReview(l._id)}
                          disabled={triggeringId === l._id}
                        >
                          {triggeringId === l._id ? 'Reviewing…' : 'Review'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
