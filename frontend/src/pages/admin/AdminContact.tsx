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
        <div className='bg-card rounded-xl border border-beige overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-beige bg-ivory/60'>
                {[140, 160, 100, 90, 200, 80, 40].map((w, i) => (
                  <th key={i} className='px-4 py-3'>
                    <Skeleton className={`h-3 w-${w === 40 ? 6 : w > 160 ? 40 : w > 100 ? 24 : 16}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className='border-b border-beige/60 last:border-0'>
                  <td className='px-4 py-3'><Skeleton className='h-3 w-28' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-3 w-36' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-3 w-20' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-5 w-16 rounded-full' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-3 w-full' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-3 w-20' /></td>
                  <td className='px-4 py-3'><Skeleton className='h-6 w-6 rounded-md' /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : messages.length === 0 ? (
        <div className='bg-card rounded-xl border border-beige p-8 text-center text-sm text-warm-gray'>
          {t('admin.contact.no_messages')}
        </div>
      ) : (
        <div className='bg-card rounded-xl border border-beige overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-beige bg-ivory/60 text-xs text-warm-gray uppercase tracking-wide'>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_name')}</th>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_email')}</th>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_phone')}</th>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_session')}</th>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_message')}</th>
                <th className='px-4 py-3 text-start font-medium'>{t('admin.contact.col_date')}</th>
                <th className='px-4 py-3' />
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg._id} className='border-b border-beige/60 last:border-0 hover:bg-ivory/40 transition-colors'>
                  <td className='px-4 py-3 font-medium text-charcoal whitespace-nowrap'>{msg.name}</td>
                  <td className='px-4 py-3'>
                    <a href={`mailto:${msg.email}`} className='text-blush hover:underline'>
                      {msg.email}
                    </a>
                  </td>
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap'>{msg.phone ?? '—'}</td>
                  <td className='px-4 py-3'>
                    {msg.sessionType ? (
                      <span className='bg-blush/15 text-blush px-2 py-0.5 rounded-full text-xs whitespace-nowrap'>
                        {msg.sessionType}
                      </span>
                    ) : (
                      <span className='text-warm-gray'>—</span>
                    )}
                  </td>
                  <td className='px-4 py-3 text-charcoal max-w-xs'>
                    <p className='line-clamp-2 leading-relaxed'>{msg.message}</p>
                  </td>
                  <td className='px-4 py-3 text-warm-gray whitespace-nowrap text-xs'>
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                  <td className='px-4 py-3'>
                    <button
                      onClick={() => deletion.setTarget(msg)}
                      className='p-1.5 rounded-lg text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
                      title={t('admin.contact.delete_btn')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
