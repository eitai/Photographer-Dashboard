import { Video, Download } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { FadeIn } from '@/components/FadeIn';

interface VideoItem {
  filename: string;
  originalName?: string;
  path: string;
}

interface Props {
  videos: VideoItem[];
  getImageUrl: (path: string) => string;
}

export function GalleryVideoSection({ videos, getImageUrl }: Props) {
  const { t } = useI18n();

  if (!videos.length) return null;

  return (
    <FadeIn>
      <div className='mb-10 flex flex-wrap gap-4 justify-center'>
        {videos.map((v) => (
          <div
            key={v.filename}
            className='rounded-2xl overflow-hidden border border-beige bg-black w-full max-w-sm'
          >
            <div
              className='flex items-center gap-2 px-4 py-3 border-b'
              style={{
                backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)',
                borderBottomColor: 'var(--border)',
              }}
            >
              <Video size={14} style={{ color: 'var(--muted-foreground)' }} />
              <span
                className='text-sm font-sans font-medium truncate flex-1'
                style={{ color: 'var(--foreground)' }}
              >
                {v.originalName || t('gallery.video_section')}
              </span>
              <a
                href={getImageUrl(v.path)}
                download={v.originalName || v.filename}
                className='ms-auto flex items-center gap-1.5 text-xs font-sans transition-colors shrink-0'
                style={{ color: 'var(--muted-foreground)' }}
              >
                <Download size={13} />
                {t('gallery.download_video')}
              </a>
            </div>
            <video src={getImageUrl(v.path)} controls className='w-full max-h-[25vh]' />
          </div>
        ))}
      </div>
    </FadeIn>
  );
}
