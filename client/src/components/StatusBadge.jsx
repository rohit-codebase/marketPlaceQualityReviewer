import { STATUS_COLORS } from '../utils/formatters';

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || 'bg-slate-700 text-slate-300';
  return (
    <span className={`badge ${colors}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}
