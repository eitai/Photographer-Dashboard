import { useRef } from 'react';
import { Video, Trash2, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { getImageUrl } from '@/lib/api';
import { Button } from '@/components/admin/Button';
import { useVideoUpload } from '@/hooks/useVideoUpload';
import type { GalleryDetail } from '@/types/admin';

interface VideoItem {
  filename: string;
  originalName?: string;
  path: string;
}

interface Props {
  galleryId: string;
  videos: VideoItem[];
  setGallery: React.Dispatch<React.SetStateAction<GalleryDetail | null>>;
}

export const GalleryVideosTab = ({ galleryId, videos, setGallery }: Props) => {
  const { t } = useI18n();
  const { videoInputRef, videoQueue, deletingFilename, handleVideoUpload, handleVideoDelete, cancelUpload } =
    useVideoUpload(galleryId, setGallery);

  return (
    <div className='flex flex-col flex-1 overflow-hidden bg-background'>
      {/* Drop zone */}
      <div className='shrink-0 px-4 md:px-8 pt-4'>
        <input
          ref={videoInputRef}
          type='file'
          accept='video/*'
          multiple
          className='hidden'
          onChange={(e) => {
            if (e.target.files?.length) handleVideoUpload(e.target.files);
            e.target.value = '';
          }}
        />
        <div
          role='button'
          tabIndex={0}
          aria-label={t('admin.gallery.drop_video_label')}
          onClick={() => videoInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); videoInputRef.current?.click(); }
          }}
          className='flex items-center gap-3 border-2 border-dashed border-beige hover:border-charcoal/30 rounded-xl px-5 py-3 cursor-pointer transition-colors bg-muted/30'
        >
          <Video size={20} className='text-warm-gray shrink-0' />
          <div>
            <p className='text-sm text-charcoal font-medium leading-tight'>{t('admin.gallery.upload_video')}</p>
            <p className='text-xs text-warm-gray'>mp4 · mov · avi · webm</p>
          </div>
        </div>
      </div>

      {/* Upload queue */}
      {videoQueue.length > 0 && (
        <div className='shrink-0 px-4 md:px-8 pt-3 space-y-2'>
          {videoQueue.map((item) => (
            <div key={item.id} className='flex items-center gap-3 text-xs bg-muted/30 border border-beige rounded-xl px-3 py-2'>
              <span className='text-warm-gray truncate flex-1'>{item.name}</span>
              <div className='w-28 h-1.5 bg-beige rounded-full overflow-hidden shrink-0'>
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    item.error ? 'bg-rose-400' : item.cancelled ? 'bg-beige' : 'bg-blush'
                  }`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <span className={`shrink-0 w-16 text-right ${
                item.error ? 'text-rose-500' : item.cancelled ? 'text-warm-gray' : item.done ? 'text-green-600' : 'text-charcoal'
              }`}>
                {item.error ? t('admin.upload.error')
                  : item.cancelled ? t('admin.gallery.video_cancelled')
                  : item.done ? t('admin.upload.done')
                  : `${item.progress}%`}
              </span>
              {!item.done && !item.error && !item.cancelled && (
                <button
                  onClick={() => cancelUpload(item.id)}
                  title={t('admin.gallery.cancel_upload')}
                  className='shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-beige hover:bg-rose-100 hover:text-rose-500 text-warm-gray transition-colors'
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video list */}
      <div className='flex-1 overflow-y-auto px-4 md:px-8 pt-3 pb-6'>
        {videos.length > 0 ? (
          <div className='space-y-2'>
            {videos.map((v) => (
              <div key={v.filename} className='flex items-center gap-3 px-3 py-2 bg-muted/30 border border-beige rounded-xl'>
                <video src={getImageUrl(v.path)} preload='metadata' className='w-16 h-10 rounded-lg object-cover shrink-0 bg-black' />
                <span className='text-xs text-charcoal truncate flex-1'>{v.originalName || v.filename}</span>
                <Button
                  variant='danger'
                  size='sm'
                  className='shrink-0'
                  onClick={() => handleVideoDelete(v.filename)}
                  disabled={deletingFilename === v.filename}
                >
                  <Trash2 size={12} />
                  {deletingFilename === v.filename ? t('admin.common.deleting') : t('admin.gallery.delete_video')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          videoQueue.length === 0 && (
            <p className='text-sm text-warm-gray text-center py-16'>{t('admin.upload.no_images')}</p>
          )
        )}
      </div>
    </div>
  );
};
