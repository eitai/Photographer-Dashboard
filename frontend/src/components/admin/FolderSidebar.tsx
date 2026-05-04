import { useState, useRef, useEffect } from 'react';
import { FolderOpen, Folder, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { GalleryFolder } from '@/types/gallery';

interface FolderSidebarProps {
  folders: GalleryFolder[];
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string) => Promise<unknown>;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  imageCounts: Record<string, number>;
  totalCount: number;
}

export function FolderSidebar({
  folders,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  imageCounts,
  totalCount,
}: FolderSidebarProps) {
  const { t } = useI18n();
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showNew) newInputRef.current?.focus();
  }, [showNew]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      await onCreateFolder(name);
      setNewName('');
      setShowNew(false);
    } finally {
      setIsCreating(false);
    }
  };

  const startRename = (folder: GalleryFolder) => {
    setRenamingId(folder._id);
    setRenameValue(folder.name);
  };

  const commitRename = () => {
    const name = renameValue.trim();
    if (renamingId && name) onRenameFolder(renamingId, name);
    setRenamingId(null);
  };

  const isActive = (id: string | null) => activeFolderId === id;

  const itemBase = 'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm transition-colors text-start';
  const activeStyle = 'bg-blush/15 text-charcoal font-medium border-s-2 border-blush ps-[10px]';
  const inactiveStyle = 'text-warm-gray hover:bg-beige/60 hover:text-charcoal';

  return (
    <div className='flex flex-col gap-1 h-full'>
      {/* All */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`${itemBase} ${isActive(null) ? activeStyle : inactiveStyle}`}
      >
        {isActive(null) ? <FolderOpen size={14} className='shrink-0 text-blush' /> : <Folder size={14} className='shrink-0' />}
        <span className='flex-1 truncate'>{t('admin.gallery.folder_all')}</span>
        <span className='text-xs tabular-nums opacity-60'>{totalCount}</span>
      </button>

      {/* Folders */}
      {folders.map((folder) => (
        <div key={folder._id} className='group relative'>
          {renamingId === folder._id ? (
            <div className='flex items-center gap-1 px-2 py-1'>
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className='flex-1 px-2 py-1 text-sm rounded-lg border border-blush/50 bg-card focus:outline-none focus:ring-2 focus:ring-blush/40'
              />
              <button onClick={commitRename} className='p-1 text-blush hover:bg-blush/10 rounded-lg'>
                <Check size={13} />
              </button>
              <button onClick={() => setRenamingId(null)} className='p-1 text-warm-gray hover:bg-beige rounded-lg'>
                <X size={13} />
              </button>
            </div>
          ) : confirmDeleteId === folder._id ? (
            <div className='px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700'>
              <p className='mb-2'>{t('admin.gallery.folder_delete_confirm')}</p>
              <div className='flex gap-2'>
                <button
                  onClick={() => { onDeleteFolder(folder._id); setConfirmDeleteId(null); }}
                  className='px-2 py-1 rounded-lg bg-rose-500 text-white text-xs hover:bg-rose-600'
                >
                  {t('admin.gallery.folder_delete')}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className='px-2 py-1 rounded-lg border border-rose-200 text-rose-600 text-xs hover:bg-rose-100'
                >
                  {t('admin.common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onSelectFolder(folder._id)}
              className={`${itemBase} ${isActive(folder._id) ? activeStyle : inactiveStyle} pe-8`}
            >
              {isActive(folder._id) ? <FolderOpen size={14} className='shrink-0 text-blush' /> : <Folder size={14} className='shrink-0' />}
              <span className='flex-1 truncate'>{folder.name}</span>
              <span className='text-xs tabular-nums opacity-60'>{imageCounts[folder._id] ?? 0}</span>
            </button>
          )}

          {/* Action icons shown on hover */}
          {renamingId !== folder._id && confirmDeleteId !== folder._id && (
            <div className='absolute end-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5'>
              <button
                onClick={(e) => { e.stopPropagation(); startRename(folder); }}
                className='p-1 rounded-lg text-warm-gray hover:text-charcoal hover:bg-beige transition-colors'
                title={t('admin.gallery.folder_rename')}
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(folder._id); }}
                className='p-1 rounded-lg text-warm-gray hover:text-rose-500 hover:bg-rose-50 transition-colors'
                title={t('admin.gallery.folder_delete')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* New folder input */}
      {showNew ? (
        <div className='flex items-center gap-1 px-2 py-1 mt-1'>
          <input
            ref={newInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape' && !isCreating) { setShowNew(false); setNewName(''); }
            }}
            disabled={isCreating}
            placeholder={t('admin.gallery.folder_name_placeholder')}
            className='flex-1 px-2 py-1 text-sm rounded-lg border border-blush/50 bg-card focus:outline-none focus:ring-2 focus:ring-blush/40 disabled:opacity-60'
          />
          <button onClick={handleCreate} disabled={isCreating} className='p-1 text-blush hover:bg-blush/10 rounded-lg disabled:opacity-60'>
            {isCreating ? <Loader2 size={13} className='animate-spin' /> : <Check size={13} />}
          </button>
          <button onClick={() => { setShowNew(false); setNewName(''); }} disabled={isCreating} className='p-1 text-warm-gray hover:bg-beige rounded-lg disabled:opacity-40'>
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className='flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-warm-gray hover:text-blush hover:bg-blush/5 transition-colors mt-1 border border-dashed border-beige hover:border-blush/40'
        >
          <Plus size={13} />
          {t('admin.gallery.folder_new')}
        </button>
      )}
    </div>
  );
}
