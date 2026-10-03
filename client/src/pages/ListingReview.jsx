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
    <div className="min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link to="/listings" className="text-slate-500 hover:text-slate-300 text-sm">← Listings</Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 break-words">{snapshot?.title}</h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
            <StatusBadge status={review.aiOverallStatus} />
            <span className="text-slate-400 text-xs sm:text-sm break-words">{snapshot?.category} · {snapshot?.seller?.name}</span>
            <span className="text-slate-500 text-xs">{formatDate(review.createdAt)}</span>
          </div>
        </div>
        <div className="sm:text-right shrink-0 bg-slate-900/60 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-slate-800">
          <p className="text-xs text-slate-500 mb-0.5 sm:mb-1">Review ID</p>
          <p className="text-xs font-mono text-slate-400 sm:text-slate-600 break-all">{review._id}</p>
        </div>
      </div>

      {/* Summary card */}
      <div className="card mb-6 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold text-slate-100 text-base sm:text-lg">AI Summary</h2>
          <div className="flex flex-wrap gap-2">
            {highCount > 0 && <span className="badge bg-red-900 text-red-200">{highCount} high</span>}
            {medCount > 0 && <span className="badge bg-yellow-900 text-yellow-200">{medCount} medium</span>}
          </div>
        </div>
        <p className="text-slate-300 text-sm break-words leading-relaxed">{review.aiSummary || 'No AI summary available.'}</p>
        {review.aiAssumptions?.length > 0 && (
          <div className="mt-3 p-3 bg-slate-800/60 rounded-lg min-w-0">
            <p className="text-xs font-semibold text-yellow-400 mb-2">⚠ Assumptions / Unverifiable Claims</p>
            <ul className="space-y-1">
              {review.aiAssumptions.map((a, i) => (
                <li key={i} className="text-xs text-slate-400 flex gap-2 break-words"><span>·</span><span className="break-words">{a}</span></li>
              ))}
            </ul>
          </div>
        )}
        {review.policySectionsUsed?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-slate-500">Policy sections used:</span>
            {review.policySectionsUsed.map((s) => (
              <span key={s} className="text-xs font-mono text-brand-400 bg-slate-800 px-1.5 py-0.5 rounded break-all">{s}</span>
            ))}
          </div>
        )}
        {review.status === 'failed' && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/40 rounded-lg min-w-0">
            <p className="text-sm text-red-400 break-words">⚠ AI review failed: {review.errorMessage}</p>
            <p className="text-xs text-slate-500 mt-1">Deterministic findings are still available below.</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 rounded-lg p-1 w-full sm:w-fit border border-slate-800 overflow-x-auto max-w-full">
        {[
          { key: 'findings', label: `Findings (${allFindings.length})` },
          { key: 'diff', label: 'Original vs Revised' },
          { key: 'listing', label: 'Listing Details' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors shrink-0 whitespace-nowrap min-h-[36px] ${
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
        <div className="min-w-0">
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
        <div className="card min-w-0">
          <DiffViewer original={snapshot} actions={actions} />
        </div>
      )}

      {/* Listing Details Tab */}
      {activeTab === 'listing' && (
        <div className="card space-y-4 min-w-0">
          {[
            { label: 'Title', value: snapshot?.title },
            { label: 'Description', value: snapshot?.description },
            { label: 'Category', value: snapshot?.category },
            { label: 'Price', value: snapshot?.price !== undefined ? formatPrice(snapshot.price) : '—' },
            { label: 'Seller', value: `${snapshot?.seller?.name || ''}${snapshot?.seller?.contact ? ` (${snapshot.seller.contact})` : ''}` },
            { label: 'Tags', value: snapshot?.tags?.join(', ') || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase mb-1">{label}</p>
              <p className="text-sm text-slate-200 break-words whitespace-pre-line">{value}</p>
            </div>
          ))}
          {snapshot?.attributes && Object.keys(snapshot.attributes).length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Attributes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(snapshot.attributes).map(([k, v]) => (
                  <div key={k} className="bg-slate-800 rounded px-3 py-2 text-sm min-w-0">
                    <span className="text-slate-400">{k}: </span>
                    <span className="text-slate-200 break-words">{v}</span>
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
