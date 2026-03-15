import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

export const AdminBlog = () => {
  const { t } = useI18n();
  const [posts, setPosts] = useState<any[]>([]);

  const load = async () => {
    try {
      const r = await api.get('/blog?admin=1');
      setPosts(r.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => { load(); }, []);

  const deletePost = async (id: string) => {
    if (!confirm(t('admin.blog.delete_confirm'))) return;
    await api.delete(`/blog/${id}`);
    load();
  };

  const togglePublish = async (post: any) => {
    await api.put(`/blog/${post._id}`, { published: !post.published });
    load();
  };

  return (
    <AdminLayout title={t('admin.blog.title')}>
      <div className="flex justify-end mb-6">
        <Link to="/admin/blog/new"
          className="flex items-center gap-2 bg-blush text-charcoal px-4 py-2 rounded-lg text-sm font-medium hover:bg-blush/80 transition-colors">
          <Plus size={15} /> {t('admin.blog.new_post')}
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-beige overflow-hidden">
        {posts.length === 0 ? (
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
                      post.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {post.published ? t('admin.blog.published') : t('admin.blog.draft')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-warm-gray">
                    {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => togglePublish(post)} title={post.published ? 'Unpublish' : 'Publish'}
                        className="text-warm-gray hover:text-charcoal">
                        {post.published ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <Link to={`/admin/blog/${post._id}/edit`} className="text-warm-gray hover:text-charcoal">
                        <Edit2 size={14} />
                      </Link>
                      <button onClick={() => deletePost(post._id)} className="text-warm-gray hover:text-rose-500">
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
    </AdminLayout>
  );
};

