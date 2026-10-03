import { useState } from 'react';
import SeverityBadge from './SeverityBadge';

/**
 * FieldReviewCard
 *
 * Renders a single AI finding with Approve / Edit / Reject actions.
 * The reviewer can:
 *   - Approve: accept the AI suggestion as-is
 *   - Edit: modify the suggestion before approving
 *   - Reject: dismiss the finding, keeping the original
 *
 * onAction is called with { field, findingIndex, action, originalText, aiSuggestion, finalValue }
 */
export default function FieldReviewCard({ finding, findingIndex, onAction, actionTaken }) {
  const [mode, setMode] = useState(null); // null | 'edit'
  const [editedText, setEditedText] = useState(finding.suggestedText || '');
  const [submitting, setSubmitting] = useState(false);

  const handleAction = async (action) => {
    setSubmitting(true);
    try {
      await onAction({
        field: finding.field,
        source: finding.source || 'ai',
        findingIndex,
        findingId: `${finding.source || 'ai'}-${findingIndex}`,
        action,
        originalText: finding.originalText,
        aiSuggestion: finding.suggestedText,
        finalValue: action === 'approve' ? finding.suggestedText : action === 'edit' ? editedText : null,
      });
    } finally {
      setSubmitting(false);
      setMode(null);
    }
  };

  const isActioned = !!actionTaken;

  return (
    <div className={`card-sm mb-4 min-w-0 ${isActioned ? 'opacity-60' : ''}`}>
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 break-all">
            {finding.field}
          </span>
          <SeverityBadge severity={finding.severity} />
          {finding.source === 'deterministic' && (
            <span className="badge bg-slate-700 text-slate-300 text-xs">Deterministic</span>
          )}
          {isActioned && (
            <span className={`badge text-xs ${actionTaken === 'approve' || actionTaken === 'edit' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
              {actionTaken === 'approve' ? '✓ Approved' : actionTaken === 'edit' ? '✓ Edited' : '✕ Rejected'}
            </span>
          )}
        </div>
        {finding.policySection && (
          <span className="text-xs text-brand-400 font-mono break-all shrink-0">{finding.policySection}</span>
        )}
      </div>

      {/* Issue */}
      <p className="text-sm font-semibold text-slate-100 mb-1 break-words">{finding.issue}</p>
      <p className="text-sm text-slate-400 mb-3 break-words leading-relaxed">{finding.explanation}</p>

      {/* Original text */}
      {finding.originalText && (
        <div className="mb-3 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1">Original text</p>
          <blockquote className="border-l-2 border-red-700 pl-3 text-sm text-red-300 italic break-words">
            {finding.originalText}
          </blockquote>
        </div>
      )}

      {/* Suggested text / edit mode */}
      {finding.suggestedText && (
        <div className="mb-3 min-w-0">
          <p className="text-xs font-medium text-slate-500 mb-1">Suggested revision</p>
          {mode === 'edit' ? (
            <textarea
              className="input text-sm min-h-[80px] w-full resize-y break-words"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              disabled={submitting}
            />
          ) : (
            <blockquote className="border-l-2 border-emerald-700 pl-3 text-sm text-emerald-300 break-words">
              {finding.suggestedText}
            </blockquote>
          )}
        </div>
      )}

      {/* Confidence */}
      {finding.confidence !== undefined && (
        <p className="text-xs text-slate-600 mb-3">AI confidence: {Math.round(finding.confidence * 100)}%</p>
      )}

      {/* Actions */}
      {!isActioned && (
        <div className="flex flex-wrap gap-2 mt-2 pt-1">
          {finding.suggestedText && mode !== 'edit' && (
            <button
              id={`approve-${findingIndex}`}
              className="btn-success text-xs py-2 px-3.5 min-h-[36px]"
              onClick={() => handleAction('approve')}
              disabled={submitting}
            >
              Approve
            </button>
          )}
          {finding.suggestedText && mode === 'edit' && (
            <button
              id={`save-edit-${findingIndex}`}
              className="btn-success text-xs py-2 px-3.5 min-h-[36px]"
              onClick={() => handleAction('edit')}
              disabled={submitting || !editedText.trim()}
            >
              Save Edit
            </button>
          )}
          {finding.suggestedText && (
            <button
              id={`edit-${findingIndex}`}
              className="btn-secondary text-xs py-2 px-3.5 min-h-[36px]"
              onClick={() => setMode(mode === 'edit' ? null : 'edit')}
              disabled={submitting}
            >
              {mode === 'edit' ? 'Cancel' : 'Edit'}
            </button>
          )}
          <button
            id={`reject-${findingIndex}`}
            className="btn-danger text-xs py-2 px-3.5 min-h-[36px]"
            onClick={() => {
              if (window.confirm('Reject this finding? The original text will be kept.')) {
                handleAction('reject');
              }
            }}
            disabled={submitting}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
