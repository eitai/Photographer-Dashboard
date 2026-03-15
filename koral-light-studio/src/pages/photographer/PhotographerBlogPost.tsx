import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const PhotographerBlogPost = () => {
  const { slug } = useParams<{ username: string; slug: string }>();
  const { t } = useI18n();
  const { username } = usePhotographer();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/p/${username}/blog/${slug}`)
      .then((r) => setPost(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, slug]);

  useEffect(() => {
    if (!post) return;
    document.title = post.seoTitle || post.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', post.seoDescription || '');
  }, [post]);

  if (loading) {
    return (
      <main className='pt-16 min-h-screen flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin' />
      </main>
    );
  }

  if (notFound || !post) {
    return (
      <main className='pt-16 min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <p className=' text-2xl text-foreground mb-2'>{t('blog.post_not_found')}</p>
          <Link to={`/${username}/blog`} className='text-sm text-muted-foreground hover:text-foreground'>
            ← {t('blog.back')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className='pt-16'>
      <article className='section-spacing'>
        <div className='max-w-2xl mx-auto px-6'>
          <FadeIn>
            <Link
              to={`/${username}/blog`}
              className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8'
            >
              <ArrowLeft size={14} /> {t('blog.back')}
            </Link>

            {post.category && <span className='text-xs text-blush uppercase tracking-wider'>{post.category}</span>}
            <h1 className=' text-3xl md:text-4xl text-foreground mt-2 mb-4 leading-tight'>{post.title}</h1>
            <p className='text-sm text-muted-foreground mb-8'>{new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</p>

            {post.featuredImagePath && (
              <div className='rounded-2xl overflow-hidden mb-10 aspect-[16/9]'>
                <img src={`${API_BASE}${post.featuredImagePath}`} alt={post.title} className='w-full h-full object-cover' />
              </div>
            )}

            <div
              className='prose prose-sm max-w-none text-foreground leading-relaxed [&_h2]: [&_h3]: [&_blockquote]:border-l-blush [&_a]:text-blush'
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
            />
          </FadeIn>
        </div>
      </article>
    </main>
  );
};
