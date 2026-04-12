import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { createGallery } from '@/services/galleryService';
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
  name: string;
  headerMessage: string;
  maxSelections: number;
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

  const [form, setForm] = useState<FormState>({
    clientId: preselectedClient?._id ?? '',
    name: '',
    headerMessage: '',
    maxSelections: 10,
  });
  const [saving, setSaving] = useState(false);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c._id === form.clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSaving(true);
    try {
      const data = await createGallery({
        name: form.name,
        headerMessage: form.headerMessage,
        maxSelections: form.maxSelections,
        clientId: selectedClient._id,
        clientName: selectedClient.name,
      });
      setEmailSent(data.emailSent ?? null);
      await queryClient.invalidateQueries({ queryKey: ['galleries'] });
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

        {/* Email feedback banner */}
        {emailSent !== null && (
          <div
            className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg mb-4 ${
              emailSent
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Mail size={13} />
            {emailSent ? t('admin.galleries.email_sent') : t('admin.galleries.no_email')}
            <button
              type='button'
              onClick={() => setEmailSent(null)}
              className='ms-auto opacity-60 hover:opacity-100'
            >
              <X size={12} />
            </button>
          </div>
        )}

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

          {/* Gallery name */}
          <div>
            <label className='block text-xs text-warm-gray mb-1'>{t('admin.galleries.name_label')}</label>
            <input
              required
              type='text'
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
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
            <input
              type='number'
              min={1}
              max={500}
              value={form.maxSelections}
              onChange={(e) => setForm((f) => ({ ...f, maxSelections: Number(e.target.value) }))}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-card text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            />
          </div>

          {/* Actions */}
          <div className='flex gap-2 pt-1'>
            <button
              type='submit'
              disabled={saving || !form.clientId}
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
