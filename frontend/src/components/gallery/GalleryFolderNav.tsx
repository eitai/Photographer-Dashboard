import { Folder, FolderOpen } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { GalleryImage } from '@/types/gallery';

interface Folder {
  _id: string;
  name: string;
}

interface Props {
  folders: Folder[];
  images: GalleryImage[];
  activeFolderId: string | null;
  isMobile: boolean;
  onSelectFolder: (id: string | null) => void;
}

export function GalleryFolderNav({ folders, images, activeFolderId, isMobile, onSelectFolder }: Props) {
  const { t } = useI18n();

  const countFor = (folderId: string) =>
    images.filter((img) => img.folderIds?.includes(folderId)).length;

  if (isMobile) {
    return (
      <div className='flex gap-2 overflow-x-auto pb-2 mb-6 -mx-2 px-2'>
        <button
          onClick={() => onSelectFolder(null)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans transition-colors ${
            activeFolderId === null ? 'font-medium text-white' : 'border font-normal'
          }`}
          style={
            activeFolderId === null
              ? { backgroundColor: 'var(--primary)' }
              : { borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--background)' }
          }
        >
          {t('gallery.folder_all')}
          <span className='text-xs opacity-70'>{images.length}</span>
        </button>
        {folders.map((f) => (
          <button
            key={f._id}
            onClick={() => onSelectFolder(f._id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-sans transition-colors ${
              activeFolderId === f._id ? 'font-medium text-white' : 'border font-normal'
            }`}
            style={
              activeFolderId === f._id
                ? { backgroundColor: 'var(--primary)' }
                : { borderColor: 'var(--border)', color: 'var(--muted-foreground)', backgroundColor: 'var(--background)' }
            }
          >
            {f.name}
            <span className='text-xs opacity-70'>{countFor(f._id)}</span>
          </button>
        ))}
      </div>
    );
  }

  // Desktop sidebar
  return (
    <div
      className='w-48 shrink-0 sticky top-20 rounded-2xl border p-3'
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
    >
      <p className='text-xs font-sans font-medium mb-2 px-2' style={{ color: 'var(--muted-foreground)' }}>
        {t('gallery.folder_all')}
      </p>
      <FolderButton
        label={t('gallery.folder_all')}
        count={images.length}
        active={activeFolderId === null}
        onClick={() => onSelectFolder(null)}
      />
      {folders.map((f) => (
        <FolderButton
          key={f._id}
          label={f.name}
          count={countFor(f._id)}
          active={activeFolderId === f._id}
          onClick={() => onSelectFolder(f._id)}
        />
      ))}
    </div>
  );
}

function FolderButton({ label, count, active, onClick }: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-sans transition-colors mb-1 text-start ${
        active ? 'font-medium border-s-2 border-[color:var(--primary)] ps-[10px]' : ''
      }`}
      style={{
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        backgroundColor: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
      }}
    >
      {active
        ? <FolderOpen size={14} className='shrink-0' style={{ color: 'var(--primary)' }} />
        : <Folder size={14} className='shrink-0' />}
      <span className='flex-1 truncate'>{label}</span>
      <span className='text-xs tabular-nums opacity-60'>{count}</span>
    </button>
  );
}
