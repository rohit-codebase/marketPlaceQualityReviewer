// Shared utility functions

export function formatPrice(price) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatRelativeDate(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str, len = 80) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export const STATUS_COLORS = {
  active: 'bg-blue-900 text-blue-200',
  under_review: 'bg-yellow-900 text-yellow-200',
  approved: 'bg-emerald-900 text-emerald-200',
  rejected: 'bg-red-900 text-red-200',
  pass: 'bg-emerald-900 text-emerald-200',
  review: 'bg-yellow-900 text-yellow-200',
  fail: 'bg-red-900 text-red-200',
  completed: 'bg-emerald-900 text-emerald-200',
  failed: 'bg-red-900 text-red-200',
  pending: 'bg-slate-700 text-slate-300',
  processing: 'bg-blue-900 text-blue-200',
};

export const SEVERITY_COLORS = {
  high: 'bg-red-900 text-red-200 border border-red-700',
  medium: 'bg-yellow-900 text-yellow-200 border border-yellow-700',
  low: 'bg-slate-700 text-slate-300 border border-slate-600',
};

export const SEVERITY_BAR = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-500',
};
