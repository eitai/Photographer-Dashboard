import { useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteConfirmation } from '@/hooks/useDeleteConfirmation';
import type { ContactSubmission } from '@/types/contact';
import { Button } from '@/components/admin/Button';

const CONTACT_QUERY_KEY = ['contact'] as const;

export const AdminContact = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: CONTACT_QUERY_KEY,
    queryFn: () => api.get('/contact').then((r) => r.data as ContactSubmission[]),
  });

  const deleteMessage = useMutation({
    mutationFn: (id: string) => api.delete(`/contact/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACT_QUERY_KEY });
    },
    onError: () => {
      toast.error(t('admin.contact.delete_failed'));
    },
  });

  const deletion = useDeleteConfirmation<ContactSubmission>(
    useCallback(
      async (target) => {
        await deleteMessage.mutateAsync(target._id);
      },
      [deleteMessage],
    ),
  );

  return (
    <AdminLayout title={t('admin.contact.title')}>
      {isLoading ? (
        <div className='space-y-3'>
          {[0, 1, 2].map((i) => (
            <div key={i} className='bg-card rounded-xl border border-beige p-5'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 space-y-2'>
                  <div className='flex items-center gap-3'>
                    <Skeleton className='h-4 w-28' />
                    <Skeleton className='h-4 w-40' />
                  </div>
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-24 mt-2' />
                </div>
                <Skeleton className='h-8 w-8 rounded-lg shrink-0' />
              </div>
            </div>
          ))}
        </div>
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
                  className='shrink-0 p-1.5 rounded-xl text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
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
              <Button
                variant='danger'
                className='flex-1'
                onClick={deletion.confirm}
                disabled={deletion.deleting}
              >
                {deletion.deleting ? t('admin.contact.deleting') : t('admin.contact.delete_btn')}
              </Button>
              <Button
                variant='ghost'
                className='flex-1'
                onClick={deletion.cancel}
                disabled={deletion.deleting}
              >
                {t('admin.common.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
