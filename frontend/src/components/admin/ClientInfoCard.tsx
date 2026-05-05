import { Mail, Phone, Calendar, Tag, Pencil, X } from 'lucide-react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { useI18n } from '@/lib/i18n';
import type { Client } from '@/types/admin';
import { SessionTypeCombobox } from '@/components/admin/SessionTypeCombobox';

const STATUSES = ['gallery_sent', 'viewed', 'selection_submitted', 'in_editing', 'delivered'];

interface ClientInfoCardProps {
  client: Client;
  editing: boolean;
  setEditing: (value: boolean) => void;
  form: Partial<Client>;
  setForm: (form: Partial<Client>) => void;
  saving: boolean;
  save: (e: React.FormEvent) => void;
}

export const ClientInfoCard = ({ client, editing, setEditing, form, setForm, saving, save }: ClientInfoCardProps) => {
  const { t } = useI18n();

  const displaySessionType = (st: string) => {
    const translated = t(`admin.session.${st}`);
    return translated.startsWith('admin.session.') ? st : translated;
  };

  return (
    <div className='bg-card rounded-2xl border border-beige flex flex-col h-full max-h-[560px]'>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className='px-6 pt-6 pb-4 border-b border-beige shrink-0'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className=' text-xl text-charcoal truncate'>{client.name}</h2>
            <div className='flex items-center gap-2 mt-1.5 flex-wrap'>
              {/* Session type pill */}
              <span className='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blush/20 text-rose-700'>
                <Tag size={10} className='shrink-0' />
                {displaySessionType(client.sessionType)} {t('admin.client.session_label')}
              </span>
              <StatusBadge status={client.status} />
            </div>
          </div>

          {/* Edit / Cancel toggle */}
          <button
            onClick={() => setEditing(!editing)}
            aria-label={editing ? t('admin.common.cancel') : t('admin.client.edit')}
            className='shrink-0 flex items-center gap-1.5 text-xs text-warm-gray hover:text-charcoal border border-beige rounded-lg px-2.5 py-1.5 transition-colors hover:bg-ivory'
          >
            {editing ? (
              <>
                <X size={12} />
                {t('admin.common.cancel')}
              </>
            ) : (
              <>
                <Pencil size={12} />
                {t('admin.client.edit')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className='flex-1 overflow-y-auto'>

        {editing ? (

          /* ── Edit mode ──────────────────────────────────────────────────── */
          <form onSubmit={save} className='flex flex-col h-full px-6 py-5 gap-5'>
            <div className='grid grid-cols-2 gap-4'>
              {[
                { field: 'name',  label: t('admin.common.name'),  type: 'text'  },
                { field: 'phone', label: t('admin.common.phone'), type: 'tel'   },
                { field: 'email', label: t('admin.common.email'), type: 'email' },
              ].map(({ field, label, type }) => (
                <div key={field}>
                  <label className='block text-xs text-warm-gray mb-1'>{label}</label>
                  <input
                    type={type}
                    value={(form as Record<string, string>)[field] || ''}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                  />
                </div>
              ))}
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
                <SessionTypeCombobox
                  value={form.sessionType || ''}
                  onChange={(val) => setForm({ ...form, sessionType: val })}
                />
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
              <div>
                <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.event_date')}</label>
                <input
                  type='date'
                  value={form.eventDate || ''}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
                />
              </div>
            </div>

            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.notes')}</label>
              <textarea
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={4}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
              />
            </div>

            <button
              type='submit'
              disabled={saving}
              className='self-start bg-blush text-primary-foreground px-5 py-2 rounded-xl text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {saving ? t('admin.common.saving') : t('admin.client.save')}
            </button>
          </form>

        ) : (

          /* ── View mode ──────────────────────────────────────────────────── */
          <div className='flex flex-col gap-0 divide-y divide-beige'>

            {/* Contact details */}
            <div className='px-6 py-4 flex flex-col gap-3'>
              {client.email && (
                <div className='flex items-center gap-3'>
                  <span className='flex items-center justify-center w-7 h-7 rounded-full bg-blush/15 text-rose-600 shrink-0'>
                    <Mail size={13} />
                  </span>
                  <span className='text-sm text-charcoal break-all'>{client.email}</span>
                </div>
              )}
              {!client.email && (
                <div className='flex items-center gap-3'>
                  <span className='flex items-center justify-center w-7 h-7 rounded-full bg-muted/40 text-warm-gray shrink-0'>
                    <Mail size={13} />
                  </span>
                  <span className='text-sm text-warm-gray'>—</span>
                </div>
              )}
              {client.phone && (
                <div className='flex items-center gap-3'>
                  <span className='flex items-center justify-center w-7 h-7 rounded-full bg-blush/15 text-rose-600 shrink-0'>
                    <Phone size={13} />
                  </span>
                  <span className='text-sm text-charcoal'>{client.phone}</span>
                </div>
              )}
              {!client.phone && (
                <div className='flex items-center gap-3'>
                  <span className='flex items-center justify-center w-7 h-7 rounded-full bg-muted/40 text-warm-gray shrink-0'>
                    <Phone size={13} />
                  </span>
                  <span className='text-sm text-warm-gray'>—</span>
                </div>
              )}
            </div>

            {/* Metadata: session type + created date + event date */}
            <div className='px-6 py-4 grid grid-cols-2 gap-x-4 gap-y-3'>
              <div>
                <p className='text-xs text-warm-gray mb-0.5'>{t('admin.common.session_type')}</p>
                <p className='text-sm text-charcoal font-medium'>{displaySessionType(client.sessionType)}</p>
              </div>
              <div>
                <p className='text-xs text-warm-gray mb-0.5'>{t('admin.client.created')}</p>
                <div className='flex items-center gap-1.5'>
                  <Calendar size={12} className='text-warm-gray shrink-0' />
                  <p className='text-sm text-charcoal'>
                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
              {client.eventDate && (
                <div>
                  <p className='text-xs text-warm-gray mb-0.5'>{t('admin.common.event_date')}</p>
                  <div className='flex items-center gap-1.5'>
                    <Calendar size={12} className='text-warm-gray shrink-0' />
                    <p className='text-sm text-charcoal'>
                      {new Date(client.eventDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes — scrollable section if present */}
            {client.notes && (
              <div className='px-6 py-4'>
                <p className='text-xs text-warm-gray mb-1.5'>{t('admin.common.notes')}</p>
                <p className='text-sm text-charcoal leading-relaxed whitespace-pre-wrap'>{client.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
