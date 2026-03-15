import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import type { ContactSubmission } from '@/types/contact';

export const AdminContact = () => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/contact');
      setMessages(r.data);
    } catch {
      toast.error(t('admin.contact.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const deletion = useDeleteConfirmation<ContactSubmission>(
    useCallback(async (target) => {
      try {
        await api.delete(`/contact/${target._id}`);
        load();
      } catch {
        toast.error(t('admin.contact.delete_failed'));
      }
    }, []),
  );

  return (
    <AdminLayout title={t('admin.contact.title')}>
      {loading ? (
        <p className='text-sm text-warm-gray'>{t('admin.common.loading')}</p>
      ) : messages.length === 0 ? (
        <div className='bg-card rounded-xl border border-beige p-8 text-center text-sm text-warm-gray'>
          {t('admin.contact.no_messages')}
        </div>
      ) : (
        <div className='space-y-3'>
          {messages.map((msg) => (
            <div key={msg._id} className='bg-card rounded-xl border border-beige p-5'>
              <div className='flex items-start justify-between gap-4'>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-3 mb-1 flex-wrap'>
                    <p className='text-sm font-medium text-charcoal'>{msg.name}</p>
                    <a href={`mailto:${msg.email}`} className='text-xs text-blush hover:underline truncate'>
                      {msg.email}
                    </a>
                    {msg.phone && <span className='text-xs text-warm-gray'>{msg.phone}</span>}
                  </div>
                  <p className='text-sm text-charcoal leading-relaxed line-clamp-3'>{msg.message}</p>
                  <p className='text-xs text-warm-gray mt-2'>{new Date(msg.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => deletion.setTarget(msg)}
                  className='shrink-0 p-1.5 rounded-lg text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
                  title={t('admin.contact.delete_btn')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deletion.target && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm p-4'>
          <div className='bg-card rounded-2xl border border-beige shadow-xl w-full max-w-sm p-6'>
            <h3 className=' text-lg text-charcoal mb-1'>{t('admin.contact.delete_title')}</h3>
            <p className='text-sm text-warm-gray mb-1'>
              <span className='font-medium text-charcoal'>{deletion.target.name}</span>
            </p>
            <p className='text-sm text-warm-gray mb-6'>{t('admin.contact.delete_body')}</p>
            <div className='flex gap-3'>
              <button
                onClick={deletion.confirm}
                disabled={deletion.deleting}
                className='flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60'
              >
                {deletion.deleting ? t('admin.contact.deleting') : t('admin.contact.delete_btn')}
              </button>
              <button
                onClick={deletion.cancel}
                disabled={deletion.deleting}
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
