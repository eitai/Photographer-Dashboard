import { StatusBadge } from '@/components/admin/StatusBadge';

const STATUSES = ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'];
const SESSION_TYPES = ['family', 'maternity', 'newborn', 'branding', 'landscape'];

interface ClientInfoCardProps {
  client: any;
  editing: boolean;
  setEditing: (value: boolean) => void;
  form: any;
  setForm: (form: any) => void;
  saving: boolean;
  save: (e: React.FormEvent) => void;
  t: (key: string) => string;
}

export const ClientInfoCard = ({ client, editing, setEditing, form, setForm, saving, save, t }: ClientInfoCardProps) => {
  return (
    <div className='bg-card rounded-xl border border-beige p-6'>
      <div className='flex items-start justify-between mb-5'>
        <div>
          <h2 className=' text-xl text-charcoal'>{client.name}</h2>
          <p className='text-sm text-warm-gray capitalize'>
            {client.sessionType} {t('admin.client.session_label')}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <StatusBadge status={client.status} />
          <button onClick={() => setEditing(!editing)} className='text-xs text-blush hover:underline'>
            {editing ? t('admin.common.cancel') : t('admin.client.edit')}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={save} className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            {[
              { field: 'name', label: t('admin.common.name'), type: 'text' },
              { field: 'phone', label: t('admin.common.phone'), type: 'tel' },
              { field: 'email', label: t('admin.common.email'), type: 'email' },
            ].map(({ field, label, type }) => (
              <div key={field}>
                <label className='block text-xs text-warm-gray mb-1'>{label}</label>
                <input
                  type={type}
                  value={form[field] || ''}
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
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.status')}</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`admin.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
            />
          </div>
          <button
            type='submit'
            disabled={saving}
            className='bg-blush text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
          >
            {saving ? t('admin.common.saving') : t('admin.client.save')}
          </button>
        </form>
      ) : (
        <dl className='grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm'>
          {[
            [t('admin.common.email'), client.email || '—'],
            [t('admin.common.phone'), client.phone || '—'],
            [t('admin.common.session_type'), client.sessionType],
            [t('admin.client.created'), new Date(client.createdAt).toLocaleDateString()],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className='text-xs text-warm-gray'>{k}</dt>
              <dd className='text-charcoal mt-0.5'>{v}</dd>
            </div>
          ))}
          {client.notes && (
            <div className='col-span-2 sm:col-span-4'>
              <dt className='text-xs text-warm-gray'>{t('admin.common.notes')}</dt>
              <dd className='text-charcoal mt-0.5'>{client.notes}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
};
