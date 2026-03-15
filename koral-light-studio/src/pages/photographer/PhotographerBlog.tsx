import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePhotographer } from './PhotographerLayout';
import { FadeIn } from '@/components/FadeIn';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const PhotographerBlog = () => {
  const { t } = useI18n();
  const { username } = usePhotographer();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/p/${username}/blog`)
      .then((r) => setPosts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  return (
    <main className='pt-16'>
      <section className='section-spacing'>
        <div className='container-narrow'>
          <FadeIn>
            <div className='text-center mb-12'>
              <h1 className=' text-4xl md:text-5xl text-foreground mb-4'>{t('blog.title')}</h1>
              <p className='text-muted-foreground'>{t('blog.subtitle')}</p>
            </div>
          </FadeIn>

          {loading ? (
            <div className='flex justify-center py-20'>
              <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin' />
            </div>
          ) : posts.length === 0 ? (
            <p className='text-center text-muted-foreground py-12'>{t('blog.no_posts')}</p>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
              {posts.map((post, i) => (
                <FadeIn key={post._id} delay={i * 0.08}>
                  <Link to={`/${username}/blog/${post.slug}`} className='group block'>
                    {post.featuredImagePath && (
                      <div className='aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-beige'>
                        <img
                          src={`${API_BASE}${post.featuredImagePath}`}
                          alt={post.title}
                          className='w-full h-full object-cover transition-transform duration-500 group-hover:scale-105'
                          loading='lazy'
                        />
                      </div>
                    )}
                    {post.category && <span className='text-xs text-blush uppercase tracking-wider'>{post.category}</span>}
                    <h2 className=' text-xl text-foreground mt-1 mb-2 group-hover:text-primary transition-colors'>{post.title}</h2>
                    <p className='text-xs text-muted-foreground'>
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}
                    </p>
                  </Link>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
