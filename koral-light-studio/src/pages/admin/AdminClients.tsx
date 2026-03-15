import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { useClientStore } from '@/store/clientStore';
import { Plus, Search, Trash2 } from 'lucide-react';

const SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

export const AdminClients = () => {
  const { t } = useI18n();
  const { clients, fetch } = useClientStore();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', sessionType: 'family', notes: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ _id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch();
  }, []);

  const filtered = clients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await api.delete(`/clients/${deleteTarget._id}`);
    setDeleting(false);
    setDeleteTarget(null);
    fetch();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await api.post('/clients', form);
    setSaving(false);
    setShowForm(false);
    setForm({ name: '', phone: '', email: '', sessionType: 'family', notes: '' });
    fetch();
  };

  return (
    <AdminLayout title={t('admin.clients.title')}>
      {/* Toolbar */}
      <div className='flex items-center gap-3 mb-6'>
        <div className='relative flex-1 max-w-sm'>
          <Search size={15} className='absolute left-3 top-1/2 -translate-y-1/2 text-warm-gray' />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.clients.search')}
            className='w-full pl-9 pr-4 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
          />
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className='flex items-center gap-2 bg-blush text-charcoal px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors'
        >
          <Plus size={15} /> {t('admin.clients.new')}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className='bg-card border border-beige rounded-xl p-6 mb-6 space-y-4'>
          <h3 className=' text-charcoal mb-2'>{t('admin.clients.new')}</h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {[
              { field: 'name', label: t('admin.common.name'), type: 'text', required: true },
              { field: 'phone', label: t('admin.common.phone'), type: 'tel' },
              { field: 'email', label: t('admin.common.email'), type: 'email' },
            ].map(({ field, label, type, required }) => (
              <div key={field}>
                <label className='block text-xs text-warm-gray mb-1'>{label}</label>
                <input
                  type={type}
                  required={required}
                  value={(form as any)[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                />
              </div>
            ))}
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
              <select
                value={form.sessionType}
                onChange={(e) => setForm({ ...form, sessionType: e.target.value })}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              >
                {SESSION_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
            />
          </div>
          <div className='flex gap-3'>
            <button
              type='submit'
              disabled={saving}
              className='bg-blush text-charcoal px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {saving ? t('admin.common.saving') : t('admin.clients.create')}
            </button>
            <button
              type='button'
              onClick={() => setShowForm(false)}
              className='px-5 py-2 rounded-lg text-sm text-warm-gray hover:bg-ivory transition-colors border border-beige'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className='bg-card rounded-xl border border-beige overflow-x-auto'>
        {filtered.length === 0 ? (
          <p className='text-sm text-warm-gray p-6'>{t('admin.clients.no_clients')}</p>
        ) : (
          <table className='w-full text-sm table-fixed'>
            <colgroup>
              <col className='w-1/4' />
              <col className='w-[120px]' />
              <col className='w-1/4' />
              <col className='w-[140px]' />
              <col className='w-[130px]' />
              <col className='w-[80px]' />
            </colgroup>
            <thead className='bg-ivory border-b border-beige'>
              <tr>
                {[
                  t('admin.common.name'),
                  t('admin.clients.col_session'),
                  t('admin.common.email'),
                  t('admin.common.phone'),
                  t('admin.common.status'),
                  '',
                ].map((h, i) => (
                  <th key={i} className='text-xs text-warm-gray font-medium px-4 py-3'>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-beige'>
              {filtered.map((c) => (
                <tr key={c._id} className='hover:bg-ivory transition-colors'>
                  <td className='px-4 py-3 text-charcoal font-medium truncate'>{c.name}</td>
                  <td className='px-4 py-3 text-warm-gray capitalize'>{c.sessionType}</td>
                  <td className='px-4 py-3 text-warm-gray truncate'>{c.email || '—'}</td>
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap'>{c.phone || '—'}</td>
                  <td className='px-4 py-3'>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      <Link to={`/admin/clients/${c._id}`} className='text-xs text-blush hover:underline whitespace-nowrap'>
                        {t('admin.clients.view')}
                      </Link>
                      <button
                        onClick={() => setDeleteTarget({ _id: c._id, name: c.name })}
                        className='text-warm-gray hover:text-rose-500 transition-colors'
                        title={t('admin.clients.delete_btn')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4'>
          <div className='bg-card rounded-2xl border border-beige shadow-xl w-full max-w-sm p-6'>
            <h3 className=' text-lg text-charcoal mb-1'>{t('admin.clients.delete_title')}</h3>
            <p className='text-sm text-warm-gray mb-1'>
              <span className='font-medium text-charcoal'>{deleteTarget.name}</span>
            </p>
            <p className='text-sm text-warm-gray mb-6'>{t('admin.clients.delete_body')}</p>
            <div className='flex gap-3'>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className='flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
              >
                {deleting ? t('admin.clients.deleting') : t('admin.clients.delete_btn')}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className='flex-1 py-2 rounded-lg text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors'
              >
                {t('admin.common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
