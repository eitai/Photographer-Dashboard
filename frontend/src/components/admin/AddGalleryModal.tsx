import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Infinity } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { createGallery } from '@/services/galleryService';
import { SessionTypeCombobox } from '@/components/admin/SessionTypeCombobox';
import type { Client } from '@/types/admin';

interface AddGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  preselectedClient?: Client;
  onSuccess: () => void;
}

interface FormState {
  clientId: string;
  headerMessage: string;
  maxSelections: number;
  expiresAt: string;
  sessionType: string;
}

export const AddGalleryModal = ({
  isOpen,
  onClose,
  clients,
  preselectedClient,
  onSuccess,
}: AddGalleryModalProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>({
    clientId: preselectedClient?._id ?? '',
    headerMessage: '',
    maxSelections: 10,
    expiresAt: '',
    sessionType: '',
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c._id === form.clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSaving(true);
    try {
      const data = await createGallery({
        name: form.sessionType,
        headerMessage: form.headerMessage,
        maxSelections: form.maxSelections,
        clientId: selectedClient._id,
        clientName: selectedClient.name,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        sessionType: form.sessionType || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
      toast({
        title: t('admin.galleries.create'),
        description: data.emailSent
          ? t('admin.galleries.email_sent')
          : t('admin.galleries.no_email'),
      });
      window.open(`/admin/galleries/${data._id}`, '_blank');
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = () => {
    if (!saving) onClose();
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
      onClick={handleBackdropClick}
    >
      <div
        className='bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-base font-semibold text-charcoal'>{t('admin.galleries.new')}</h2>
          <button
            type='button'
            onClick={onClose}
            disabled={saving}
            className='p-1 rounded-xl text-warm-gray hover:bg-beige transition-colors disabled:opacity-40'
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Client select */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.galleries.client_label')}</label>
            <select
              required
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            >
              <option value='' disabled>
                {t('admin.galleries.select_client')}
              </option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Session type — also used as gallery name */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.common.session_type')}</label>
            <SessionTypeCombobox
              value={form.sessionType}
              onChange={(val) => setForm((f) => ({ ...f, sessionType: val }))}
            />
          </div>

          {/* Header message */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.galleries.header_msg')}</label>
            <input
              type='text'
              value={form.headerMessage}
              onChange={(e) => setForm((f) => ({ ...f, headerMessage: e.target.value }))}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
          </div>

          {/* Max selections */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.client.max_selections')}</label>
            <div className='flex items-center gap-2'>
              <input
                type='number'
                min={1}
                max={500}
                disabled={form.maxSelections === 0}
                value={form.maxSelections === 0 ? '' : form.maxSelections}
                onChange={(e) => setForm((f) => ({ ...f, maxSelections: Number(e.target.value) }))}
                placeholder='10'
                className='flex-1 px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 disabled:opacity-40 disabled:cursor-not-allowed'
              />
              <button
                type='button'
                title='Unlimited'
                onClick={() => setForm((f) => ({ ...f, maxSelections: f.maxSelections === 0 ? 10 : 0 }))}
                className={`shrink-0 p-2 rounded-lg border transition-colors ${
                  form.maxSelections === 0
                    ? 'bg-blush text-white border-blush'
                    : 'border-beige text-warm-gray hover:border-blush hover:text-blush'
                }`}
              >
                <Infinity size={16} />
              </button>
            </div>
          </div>

          {/* Expiry date (optional) */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.gallery.expires_at_label')}</label>
            <div className='flex items-center gap-2'>
              <input
                type='datetime-local'
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className='flex-1 px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
              {form.expiresAt && (
                <button
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, expiresAt: '' }))}
                  className='shrink-0 text-xs text-warm-gray hover:text-rose-500 transition-colors px-2 py-1 rounded-lg border border-beige hover:border-rose-200 hover:bg-rose-50'
                >
                  {t('admin.gallery.expires_at_clear')}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className='flex gap-2 pt-1'>
            <button
              type='submit'
              disabled={saving || !form.clientId || !form.sessionType}
              className='bg-blush text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {saving ? t('admin.galleries.creating') : t('admin.galleries.create')}
            </button>
            <button
              type='button'
              onClick={onClose}
              disabled={saving}
              className='px-4 py-2 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors disabled:opacity-40'
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
