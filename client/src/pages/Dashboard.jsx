import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listingService } from '../services';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatRelativeDate } from '../utils/formatters';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listingService.getDashboard()
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;
  if (error) return <div className="card text-red-400">Error: {error}</div>;

  const { stats, recentReviews } = data;

  const statCards = [
    { label: 'Total Listings', value: stats.total, color: 'text-blue-400' },
    { label: 'Pending Review', value: stats.pending, color: 'text-yellow-400' },
    { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
    { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of listing quality and review activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Reviews */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">Recent Reviews</h2>
          <Link to="/history" className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>

        {recentReviews.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-3xl mb-2">📋</p>
            <p>No reviews yet. Create a listing and trigger a review to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentReviews.map((review) => (
              <div key={review._id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {review.listingId?.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {review.listingId?.category} · {formatRelativeDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={review.aiOverallStatus} />
                  <Link
                    to={`/reviews/${review._id}`}
                    className="text-xs text-brand-400 hover:text-brand-300"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <Link to="/listings/new" className="card hover:border-brand-600 transition-colors cursor-pointer text-center py-8">
          <p className="text-3xl mb-2">➕</p>
          <p className="font-medium text-slate-200">Create Listing</p>
          <p className="text-sm text-slate-400 mt-1">Add a new product or service listing</p>
        </Link>
        <Link to="/batch" className="card hover:border-brand-600 transition-colors cursor-pointer text-center py-8">
          <p className="text-3xl mb-2">⚡</p>
          <p className="font-medium text-slate-200">Batch Review</p>
          <p className="text-sm text-slate-400 mt-1">Review multiple listings at once</p>
        </Link>
      </div>
    </div>
  );
}
