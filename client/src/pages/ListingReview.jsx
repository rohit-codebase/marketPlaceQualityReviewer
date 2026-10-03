import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reviewService } from '../services';
import FieldReviewCard from '../components/FieldReviewCard';
import DiffViewer from '../components/DiffViewer';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate, formatPrice } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function ListingReview() {
  const { id } = useParams();
  const [review, setReview] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('findings');

  const fetchData = useCallback(async () => {
    try {
      const res = await reviewService.getHistoryDetail(id);
      setReview(res.data.review);
      setActions(res.data.actions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (actionData) => {
    try {
      const res = await reviewService.submitAction(id, actionData);
      setActions((prev) => [...prev, res.data]);
      toast.success(`Finding ${actionData.action}d`);
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };

  // Build a map of action keys → action taken
  const actionMap = {};
  actions.forEach((a) => {
    if (a.source) {
      actionMap[`${a.source}-${a.field}-${a.findingIndex}`] = a.action;
      actionMap[`${a.source}-${a.findingIndex}`] = a.action;
    }
    actionMap[`${a.field}-${a.findingIndex}`] = a.action;
  });

  if (loading) return <LoadingSpinner message="Loading review…" />;
  if (error) return <div className="card text-red-400">Error: {error}</div>;
  if (!review) return <div className="card text-slate-400">Review not found.</div>;

  const snapshot = review.listingSnapshot;
  const allFindings = [
    ...(review.deterministicFindings || []),
    ...(review.aiFindings || []),
  ];
  const highCount = allFindings.filter((f) => f.severity === 'high').length;
  const medCount = allFindings.filter((f) => f.severity === 'medium').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/listings" className="text-slate-500 hover:text-slate-300 text-sm">← Listings</Link>
          </div>
          <h1 className="text-xl font-bold text-slate-100">{snapshot?.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={review.aiOverallStatus} />
            <span className="text-slate-400 text-sm">{snapshot?.category} · {snapshot?.seller?.name}</span>
            <span className="text-slate-500 text-xs">{formatDate(review.createdAt)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500 mb-1">Review ID</p>
          <p className="text-xs font-mono text-slate-600">{review._id}</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-100">AI Summary</h2>
          <div className="flex gap-2">
            {highCount > 0 && <span className="badge bg-red-900 text-red-200">{highCount} high</span>}
            {medCount > 0 && <span className="badge bg-yellow-900 text-yellow-200">{medCount} medium</span>}
          </div>
        </div>
        <p className="text-slate-300 text-sm">{review.aiSummary || 'No AI summary available.'}</p>
        {review.aiAssumptions?.length > 0 && (
          <div className="mt-3 p-3 bg-slate-800/60 rounded-lg">
            <p className="text-xs font-semibold text-yellow-400 mb-2">⚠ Assumptions / Unverifiable Claims</p>
            <ul className="space-y-1">
              {review.aiAssumptions.map((a, i) => (
                <li key={i} className="text-xs text-slate-400 flex gap-2"><span>·</span>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {review.policySectionsUsed?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-xs text-slate-500">Policy sections used:</span>
            {review.policySectionsUsed.map((s) => (
              <span key={s} className="text-xs font-mono text-brand-400">{s}</span>
            ))}
          </div>
        )}
        {review.status === 'failed' && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/40 rounded-lg">
            <p className="text-sm text-red-400">⚠ AI review failed: {review.errorMessage}</p>
            <p className="text-xs text-slate-500 mt-1">Deterministic findings are still available below.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 rounded-lg p-1 w-fit border border-slate-800">
        {[
          { key: 'findings', label: `Findings (${allFindings.length})` },
          { key: 'diff', label: 'Original vs Revised' },
          { key: 'listing', label: 'Listing Details' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Findings Tab */}
      {activeTab === 'findings' && (
        <div>
          {allFindings.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-emerald-400 font-medium">No findings. The listing passed all checks.</p>
            </div>
          ) : (
            <>
              {/* Deterministic findings */}
              {review.deterministicFindings?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    Deterministic Validation ({review.deterministicFindings.length})
                  </h3>
                  {review.deterministicFindings.map((f, i) => (
                    <FieldReviewCard
                      key={`det-${i}`}
                      finding={{ ...f, source: 'deterministic' }}
                      findingIndex={i}
                      onAction={handleAction}
                      actionTaken={
                        actionMap[`deterministic-${f.field}-${i}`] ||
                        actionMap[`${f.field}-${i}`]
                      }
                    />
                  ))}
                </div>
              )}

              {/* AI findings */}
              {review.aiFindings?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    AI Policy Findings ({review.aiFindings.length})
                  </h3>
                  {review.aiFindings.map((f, i) => (
                    <FieldReviewCard
                      key={`ai-${i}`}
                      finding={{ ...f, source: 'ai' }}
                      findingIndex={i}
                      onAction={handleAction}
                      actionTaken={
                        actionMap[`ai-${f.field}-${i}`] ||
                        actionMap[`${f.field}-${(review.deterministicFindings?.length || 0) + i}`] ||
                        actionMap[`${f.field}-${i}`]
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Diff Tab */}
      {activeTab === 'diff' && (
        <div className="card">
          <DiffViewer original={snapshot} actions={actions} />
        </div>
      )}

      {/* Listing Details Tab */}
      {activeTab === 'listing' && (
        <div className="card space-y-4">
          {[
            { label: 'Title', value: snapshot?.title },
            { label: 'Description', value: snapshot?.description },
            { label: 'Category', value: snapshot?.category },
            { label: 'Price', value: snapshot?.price !== undefined ? formatPrice(snapshot.price) : '—' },
            { label: 'Seller', value: `${snapshot?.seller?.name}${snapshot?.seller?.contact ? ` (${snapshot.seller.contact})` : ''}` },
            { label: 'Tags', value: snapshot?.tags?.join(', ') || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">{label}</p>
              <p className="text-sm text-slate-200">{value}</p>
            </div>
          ))}
          {snapshot?.attributes && Object.keys(snapshot.attributes).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Attributes</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(snapshot.attributes).map(([k, v]) => (
                  <div key={k} className="bg-slate-800 rounded px-3 py-2 text-sm">
                    <span className="text-slate-400">{k}: </span>
                    <span className="text-slate-200">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
