/**
 * DiffViewer — side-by-side comparison of original vs revised listing fields.
 * Changed fields are highlighted.
 */
export default function DiffViewer({ original, actions }) {
  // Build a map of field → finalValue from approved/edited actions
  const changedFields = {};
  (actions || []).forEach((a) => {
    if ((a.action === 'approve' || a.action === 'edit') && a.finalValue) {
      changedFields[a.field] = a.finalValue;
    }
  });

  const fields = ['title', 'description', 'price', 'category', 'seller'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Original */}
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Original</h3>
        {fields.map((field) => {
          const value = field === 'seller' ? original?.seller?.name : original?.[field];
          const changed = !!changedFields[field];
          return (
            <div key={field} className={`mb-3 p-3 rounded-lg text-sm min-w-0 ${changed ? 'bg-red-950/40 border border-red-800/40' : 'bg-slate-800/40'}`}>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase">{field}</p>
              <p className="text-slate-200 break-words">{value !== undefined && value !== null ? String(value) : <span className="text-slate-600">—</span>}</p>
            </div>
          );
        })}
      </div>

      {/* Revised */}
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Revised</h3>
        {fields.map((field) => {
          const originalValue = field === 'seller' ? original?.seller?.name : original?.[field];
          const revised = changedFields[field];
          const changed = !!revised;
          return (
            <div key={field} className={`mb-3 p-3 rounded-lg text-sm min-w-0 ${changed ? 'bg-emerald-950/40 border border-emerald-800/40' : 'bg-slate-800/40'}`}>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase">{field}</p>
              <p className={`break-words ${changed ? 'text-emerald-300' : 'text-slate-200'}`}>
                {changed ? revised : (originalValue !== undefined ? String(originalValue) : <span className="text-slate-600">—</span>)}
              </p>
              {changed && <p className="text-xs text-emerald-600 mt-1">✓ Revised</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
