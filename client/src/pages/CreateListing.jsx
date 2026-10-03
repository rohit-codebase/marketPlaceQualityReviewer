import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listingService } from '../services';
import toast from 'react-hot-toast';

const CATEGORIES = ['Electronics','Clothing','Home','Beauty','Sports','Services','Books','Toys','Automotive','Garden'];

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  price: '',
  sellerName: '',
  sellerContact: '',
  tags: '',
  attrKey: '',
  attrValue: '',
};

function Field({ label, id, error, children }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

export default function CreateListing() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [attributes, setAttributes] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addAttribute = () => {
    if (!form.attrKey.trim()) return;
    setAttributes((a) => [...a, { key: form.attrKey.trim(), value: form.attrValue.trim() }]);
    setForm((f) => ({ ...f, attrKey: '', attrValue: '' }));
  };

  const removeAttr = (i) => setAttributes((a) => a.filter((_, idx) => idx !== i));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.category) e.category = 'Category is required';
    if (!form.price) e.price = 'Price is required';
    else if (isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'Price must be a positive number';
    if (!form.sellerName.trim()) e.sellerName = 'Seller name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const attrMap = {};
      attributes.forEach((a) => { attrMap[a.key] = a.value; });

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        seller: { name: form.sellerName.trim(), contact: form.sellerContact.trim() },
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        attributes: attrMap,
      };

      await listingService.create(payload);
      toast.success('Listing created successfully');
      navigate('/listings');
    } catch (err) {
      toast.error(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl min-w-0">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Create Listing</h1>
        <p className="text-slate-400 text-sm mt-1">Add a new marketplace listing for quality review</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-0">
        <Field label="Title *" id="title" error={errors.title}>
          <input id="title" className="input" value={form.title} onChange={set('title')}
            placeholder="e.g. Sony WH-1000XM5 Wireless Headphones" maxLength={200} />
        </Field>

        <Field label="Description *" id="description" error={errors.description}>
          <textarea id="description" className="input min-h-[120px] resize-y" value={form.description}
            onChange={set('description')} placeholder="Describe the product or service in detail…" maxLength={5000} />
          <p className="text-xs text-slate-600 mt-1">{form.description.length}/5000 characters</p>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
          <Field label="Category *" id="category" error={errors.category}>
            <select id="category" className="input" value={form.category} onChange={set('category')}>
              <option value="">Select category…</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Price (USD) *" id="price" error={errors.price}>
            <input id="price" type="number" min="0.01" step="0.01" className="input"
              value={form.price} onChange={set('price')} placeholder="e.g. 349.99" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
          <Field label="Seller Name *" id="sellerName" error={errors.sellerName}>
            <input id="sellerName" className="input" value={form.sellerName} onChange={set('sellerName')} placeholder="e.g. TechStore Pro" />
          </Field>
          <Field label="Seller Contact" id="sellerContact">
            <input id="sellerContact" className="input" value={form.sellerContact} onChange={set('sellerContact')} placeholder="email or phone" />
          </Field>
        </div>

        <Field label="Tags" id="tags">
          <input id="tags" className="input" value={form.tags} onChange={set('tags')} placeholder="Comma-separated, e.g. wireless, headphones" />
        </Field>

        {/* Attributes */}
        <div className="mb-5">
          <label className="label">Attributes</label>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input className="input flex-1 min-w-0" placeholder="Key e.g. Color" value={form.attrKey} onChange={set('attrKey')} />
            <input className="input flex-1 min-w-0" placeholder="Value e.g. Black" value={form.attrValue} onChange={set('attrValue')} />
            <button type="button" className="btn-secondary px-4 py-2 shrink-0 w-full sm:w-auto text-center" onClick={addAttribute}>Add</button>
          </div>
          {attributes.length > 0 && (
            <div className="space-y-1 mt-2">
              {attributes.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm text-slate-300 bg-slate-800 rounded px-3 py-1.5 min-w-0">
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-slate-200">{a.key}: </span>
                    <span className="text-slate-400">{a.value}</span>
                  </div>
                  <button type="button" className="shrink-0 text-red-400 hover:text-red-300 text-xs p-1" onClick={() => removeAttr(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" id="submit-listing" className="btn-primary w-full sm:w-auto" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Listing'}
          </button>
          <button type="button" className="btn-secondary w-full sm:w-auto text-center" onClick={() => navigate('/listings')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
