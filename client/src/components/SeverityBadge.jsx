import { SEVERITY_COLORS } from '../utils/formatters';

export default function SeverityBadge({ severity }) {
  const colors = SEVERITY_COLORS[severity] || 'bg-slate-700 text-slate-300';
  return (
    <span className={`badge ${colors} uppercase tracking-wide`}>
      {severity}
    </span>
  );
}
