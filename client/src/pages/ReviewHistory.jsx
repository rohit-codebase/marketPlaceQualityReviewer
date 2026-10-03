import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { reviewService } from '../services';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate, truncate } from '../utils/formatters';

export default function ReviewHistory() {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Guard to prevent concurrent duplicate requests
  const isFetchingRef = useRef(false);

  const fetchHistory = useCallback(async (targetPage, targetLimit, forceRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await reviewService.getHistory({
        page: targetPage,
        limit: targetLimit,
        skipCache: forceRefresh,
      });
      setReviews(res.reviews || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || Math.ceil((res.total || 0) / targetLimit) || 1);
    } catch (err) {
      setError(err.message || 'Failed to load review history');
      if (err.isRateLimited || err.statusCode === 429) {
        setIsRateLimited(true);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchHistory(page, limit);
  }, [fetchHistory, page, limit]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
    }
  };

  const handleLimitChange = (e) => {
    const newLimit = parseInt(e.target.value, 10);
    setLimit(newLimit);
    setPage(1);
  };

  const handleRetry = () => {
    fetchHistory(page, limit, true);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Review History</h1>
          <p className="text-slate-400 mt-1">
            {total} completed review{total !== 1 ? 's' : ''} recorded in audit trail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 flex items-center gap-1">
            Per page:
            <select
              value={limit}
              onChange={handleLimitChange}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>

          <button
            onClick={() => fetchHistory(page, limit, true)}
            disabled={loading}
            className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            title="Refresh review history"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading review history…" />
      ) : error ? (
        <div className="card border-red-500/30 bg-red-950/20 text-red-300 p-6 text-center space-y-3">
          <p className="font-medium text-lg">
            {isRateLimited ? '⏳ Rate Limit Notice' : '⚠️ Unable to Load History'}
          </p>
          <p className="text-sm text-slate-300 max-w-md mx-auto">{error}</p>
          <div>
            <button
              onClick={handleRetry}
              className="btn-primary text-xs px-4 py-2 mt-2"
            >
              {isRateLimited ? 'Wait a moment & Retry' : 'Try Again'}
            </button>
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🕓</p>
          <p className="text-lg font-medium text-slate-200">No reviews found</p>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            Reviews will appear here once listings are evaluated against marketplace policies.
          </p>
          <Link to="/listings" className="btn-primary inline-block mt-5 text-sm">
            View Listings to Review →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Listing</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">AI Status</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Findings</th>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">Reviewed</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => {
                    const totalFindings =
                      (r.deterministicFindings?.length || 0) + (r.aiFindings?.length || 0);
                    return (
                      <tr
                        key={r._id}
                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-slate-200">
                            {truncate(r.listingId?.title, 55) || 'Unknown Listing'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{r._id}</p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400">
                          <span className="badge bg-slate-800 text-slate-300">
                            {r.listingId?.category || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={r.aiOverallStatus || r.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          <span
                            className={
                              totalFindings > 0
                                ? 'font-medium text-amber-400'
                                : 'text-slate-400'
                            }
                          >
                            {totalFindings} finding{totalFindings !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-xs">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            to={`/reviews/${r._id}`}
                            className="btn-secondary text-xs px-2.5 py-1 inline-flex items-center gap-1 hover:border-brand-500"
                          >
                            Review →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-3">
              <p className="text-xs text-slate-400">
                Showing{' '}
                <span className="text-slate-200 font-medium">
                  {(page - 1) * limit + 1}
                </span>{' '}
                to{' '}
                <span className="text-slate-200 font-medium">
                  {Math.min(page * limit, total)}
                </span>{' '}
                of <span className="text-slate-200 font-medium">{total}</span> reviews
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1 || loading}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <span className="text-xs text-slate-400 px-2">
                  Page <strong className="text-slate-200">{page}</strong> of{' '}
                  <strong className="text-slate-200">{totalPages}</strong>
                </span>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
