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
    <div className={`card-sm mb-4 ${isActioned ? 'opacity-60' : ''}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
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
          <span className="text-xs text-brand-400 font-mono shrink-0">{finding.policySection}</span>
        )}
      </div>

      {/* Issue */}
      <p className="text-sm font-semibold text-slate-100 mb-1">{finding.issue}</p>
      <p className="text-sm text-slate-400 mb-3">{finding.explanation}</p>

      {/* Original text */}
      {finding.originalText && (
        <div className="mb-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Original text</p>
          <blockquote className="border-l-2 border-red-700 pl-3 text-sm text-red-300 italic">
            {finding.originalText}
          </blockquote>
        </div>
      )}

      {/* Suggested text / edit mode */}
      {finding.suggestedText && (
        <div className="mb-3">
          <p className="text-xs font-medium text-slate-500 mb-1">Suggested revision</p>
          {mode === 'edit' ? (
            <textarea
              className="input text-sm min-h-[80px] resize-y"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              disabled={submitting}
            />
          ) : (
            <blockquote className="border-l-2 border-emerald-700 pl-3 text-sm text-emerald-300">
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
        <div className="flex flex-wrap gap-2 mt-2">
          {finding.suggestedText && mode !== 'edit' && (
            <button
              id={`approve-${findingIndex}`}
              className="btn-success text-xs py-1.5 px-3"
              onClick={() => handleAction('approve')}
              disabled={submitting}
            >
              Approve
            </button>
          )}
          {finding.suggestedText && mode === 'edit' && (
            <button
              id={`save-edit-${findingIndex}`}
              className="btn-success text-xs py-1.5 px-3"
              onClick={() => handleAction('edit')}
              disabled={submitting || !editedText.trim()}
            >
              Save Edit
            </button>
          )}
          {finding.suggestedText && (
            <button
              id={`edit-${findingIndex}`}
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={() => setMode(mode === 'edit' ? null : 'edit')}
              disabled={submitting}
            >
              {mode === 'edit' ? 'Cancel' : 'Edit'}
            </button>
          )}
          <button
            id={`reject-${findingIndex}`}
            className="btn-danger text-xs py-1.5 px-3"
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
