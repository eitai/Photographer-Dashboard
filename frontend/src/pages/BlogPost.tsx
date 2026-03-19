import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { FadeIn } from '@/components/FadeIn';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get(`/blog/slug/${slug}`);
        setPost(r.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);


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
          <Link to='/blog' className='text-sm text-muted-foreground hover:text-foreground'>
            ← {t('blog.back')}
          </Link>
        </div>
      </main>
    );
  }

  const postImage = post.featuredImagePath ? `${API_BASE}${post.featuredImagePath}` : undefined;
  const canonicalUrl = `${window.location.origin}/blog/${post.slug}`;

  return (
    <main className='pt-16'>
      <Helmet>
        <title>{post.seoTitle || post.title} | Koral Photography</title>
        <meta name='description' content={post.seoDescription || post.title} />
        <meta property='og:title' content={post.seoTitle || post.title} />
        <meta property='og:description' content={post.seoDescription || post.title} />
        <meta property='og:type' content='article' />
        <meta property='og:url' content={canonicalUrl} />
        {postImage && <meta property='og:image' content={postImage} />}
        <meta name='twitter:card' content='summary_large_image' />
        <meta name='twitter:title' content={post.seoTitle || post.title} />
        <meta name='twitter:description' content={post.seoDescription || post.title} />
        {postImage && <meta name='twitter:image' content={postImage} />}
        <link rel='canonical' href={canonicalUrl} />
        <script type='application/ld+json'>
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.seoDescription || '',
            image: postImage,
            datePublished: post.publishedAt || post.createdAt,
            author: { '@type': 'Person', name: 'Koral Photography' },
          })}
        </script>
      </Helmet>
      <article className='section-spacing'>
        <div className='max-w-2xl mx-auto px-6'>
          <FadeIn>
            <Link to='/blog' className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8'>
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

            {/* Rich text content */}
            <div
              className='prose prose-sm max-w-none text-foreground leading-relaxed [&_h2]: [&_h3]: [&_blockquote]:border-l-blush [&_a]:text-blush'
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
            />
          </FadeIn>
        </div>
      </article>
    </main>
  );
};
