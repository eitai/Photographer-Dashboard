import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  category?: string;
  published: boolean;
  publishedAt?: string;
  createdAt?: string;
}

export const AdminBlog = () => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ['blog-posts'],
    queryFn: () => api.get('/blog?admin=1').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/blog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      setDeleteTargetId(null);
    },
    onError: () => toast.error(t('admin.common.error')),
  });

  const togglePublish = useMutation({
    mutationFn: (post: BlogPost) => api.put(`/blog/${post._id}`, { published: !post.published }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blog-posts'] }),
    onError: () => toast.error(t('admin.common.error')),
  });

  return (
    <AdminLayout title={t('admin.blog.title')}>
      <div className="flex justify-end mb-6">
        <Link to="/admin/blog/new"
          className="flex items-center gap-2 bg-blush text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors">
          <Plus size={15} /> {t('admin.blog.new_post')}
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-beige overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-warm-gray">
            <Loader2 size={20} className="animate-spin me-2" />
            <span className="text-sm">{t('admin.common.loading')}</span>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-warm-gray p-6">{t('admin.blog.no_posts')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ivory border-b border-beige">
              <tr>
                {[t('admin.blog.col_title'), t('admin.blog.col_category'), t('admin.blog.col_status'), t('admin.blog.col_date'), ''].map((h, i) => (
                  <th key={i} className="text-left text-xs text-warm-gray font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-beige">
              {posts.map((post) => (
                <tr key={post._id} className="hover:bg-ivory transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-charcoal font-medium font-sans">{post.title}</p>
                    <p className="text-xs text-warm-gray font-mono">{post.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-warm-gray">{post.category || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      post.published ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {post.published ? t('admin.blog.published') : t('admin.blog.draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-warm-gray">
                    {new Date(post.publishedAt || post.createdAt || Date.now()).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish.mutate(post)}
                        disabled={togglePublish.isPending}
                        title={post.published ? t('admin.blog.unpublish') : t('admin.blog.publish')}
                        className="text-warm-gray hover:text-charcoal disabled:opacity-40"
                      >
                        {post.published ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <Link to={`/admin/blog/${post._id}/edit`} className="text-warm-gray hover:text-charcoal">
                        <Edit2 size={14} />
                      </Link>
                      <button
                        onClick={() => setDeleteTargetId(post._id)}
                        className="text-warm-gray hover:text-rose-500"
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

      {deleteTargetId && (
        <Modal isOpen onClose={() => setDeleteTargetId(null)}>
          <h3 className="text-lg text-charcoal mb-2">{t('admin.blog.delete_confirm')}</h3>
          <p className="text-sm text-warm-gray mb-6">{t('admin.common.action_irreversible')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => deleteMutation.mutate(deleteTargetId)}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-rose-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-60"
            >
              {deleteMutation.isPending ? t('admin.common.deleting') : t('admin.common.delete')}
            </button>
            <button
              onClick={() => setDeleteTargetId(null)}
              disabled={deleteMutation.isPending}
              className="flex-1 py-3 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors"
            >
              {t('admin.common.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
};
