import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { listingService, batchService } from '../services';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { truncate } from '../utils/formatters';

export default function BatchReview() {
  const [listings, setListings] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [batchState, setBatchState] = useState(null); // { batchId, status, items }
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    listingService.getAll({ limit: 50 })
      .then((res) => setListings(res.listings))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === listings.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(listings.map((l) => l._id)));
    }
  };

  const startBatch = async () => {
    if (selected.size === 0) return;
    try {
      const res = await batchService.start([...selected]);
      setBatchState({ batchId: res.data.batchId, status: 'processing', items: [...selected].map((id) => ({
        listingId: id,
        status: 'pending',
      })) });
      setPolling(true);
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await batchService.getStatus(res.data.batchId);
          setBatchState(statusRes.data);
          if (statusRes.data.status === 'completed') {
            clearInterval(pollRef.current);
            setPolling(false);
          }
        } catch {
          clearInterval(pollRef.current);
          setPolling(false);
        }
      }, 3000);
    } catch (err) {
      alert(`Batch failed: ${err.message}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  const itemStatusColor = {
    pending: 'text-slate-500',
    processing: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  };

  // Find listing title by ID for batch results
  const listingMap = Object.fromEntries(listings.map((l) => [l._id, l]));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Batch Review</h1>
        <p className="text-slate-400 mt-1">Select listings and trigger an AI quality review for all of them at once.</p>
      </div>

      {/* Batch result */}
      {batchState && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-100">Batch {batchState.batchId?.slice(0, 8)}…</h2>
            <div className="flex items-center gap-2">
              {polling && (
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              )}
              <span className={`badge ${batchState.status === 'completed' ? 'bg-emerald-900 text-emerald-200' : 'bg-blue-900 text-blue-200'}`}>
                {batchState.status}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {batchState.items?.map((item, i) => {
              const listing = listingMap[item.listingId];
              return (
                <div key={i} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-200 truncate">{listing?.title || item.listingId}</p>
                    {item.error && <p className="text-xs text-red-400">{item.error}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${itemStatusColor[item.status] || 'text-slate-500'}`}>
                      {item.status}
                    </span>
                    {item.reviewId && (
                      <Link to={`/reviews/${item.reviewId}`} className="text-brand-400 hover:text-brand-300 text-xs">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection */}
      {loading ? (
        <LoadingSpinner />
      ) : listings.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-slate-400">No listings available. <Link to="/listings/new" className="text-brand-400">Create one first.</Link></p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <input
                id="select-all"
                type="checkbox"
                className="w-4 h-4 accent-brand-600"
                checked={selected.size === listings.length && listings.length > 0}
                onChange={toggleAll}
              />
              <label htmlFor="select-all" className="text-sm text-slate-400">
                {selected.size === 0 ? 'Select all' : `${selected.size} selected`}
              </label>
            </div>
            <button
              id="start-batch"
              className="btn-primary"
              onClick={startBatch}
              disabled={selected.size === 0 || polling}
            >
              {polling ? 'Processing…' : `Review ${selected.size} Listing${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 w-10"></th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Seller</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr
                    key={l._id}
                    className={`border-b border-slate-800/50 transition-colors cursor-pointer ${selected.has(l._id) ? 'bg-brand-600/10' : 'hover:bg-slate-800/30'}`}
                    onClick={() => toggleSelect(l._id)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-brand-600"
                        checked={selected.has(l._id)}
                        onChange={() => {}}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{truncate(l.title, 55)}</td>
                    <td className="px-4 py-3 text-slate-400">{l.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{l.seller?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
