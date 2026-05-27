import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
import { toast } from 'sonner';
import { InputField, TextareaField, SelectField } from '@/components/admin/InputField';
import { Button } from '@/components/admin/Button';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  ArrowLeft,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CATEGORY_OPTIONS = [
  { value: 'Family Photography', labelKey: 'admin.editor.categories.family' },
  { value: 'Maternity', labelKey: 'admin.editor.categories.maternity' },
  { value: 'Newborn', labelKey: 'admin.editor.categories.newborn' },
  { value: 'Branding', labelKey: 'admin.editor.categories.branding' },
  { value: 'Landscape', labelKey: 'admin.editor.categories.landscape' },
  { value: 'Behind the Lens', labelKey: 'admin.editor.categories.behind_lens' },
] as const;

type BlogFormValues = { title: string; category?: string; seoTitle?: string; seoDescription?: string };

export const AdminBlogEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isEdit = Boolean(id);

  const blogSchema = useMemo(() => z.object({
    title: z.string().min(1, t('admin.editor.title_required')),
    category: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().max(160, t('admin.editor.meta_max_chars')).optional(),
  }), [t]);

  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);

  // I4 — inline URL inputs replacing window.prompt()
  const [pendingLinkUrl, setPendingLinkUrl] = useState('');
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // I5 — unsaved-changes guard
  const initialContentRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BlogFormValues>({
    resolver: zodResolver(blogSchema),
    defaultValues: { title: '', category: '', seoTitle: '', seoDescription: '' },
  });

  const titleValue = watch('title');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: t('admin.editor.write_placeholder') }),
    ],
    content: '',
    // I5 — track dirty state on every content change
    onUpdate: ({ editor: e }) => {
      setIsDirty(e.getHTML() !== initialContentRef.current);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-charcoal',
      },
    },
  });

  // C2 — `editor` removed from dep array; guard against destroyed instance on re-mount
  useEffect(() => {
    if (!isEdit || !editor || editor.isDestroyed) return;
    const load = async () => {
      try {
        const r = await api.get(`/blog/${id}`);
        const p = r.data;
        reset({
          title: p.title,
          seoTitle: p.seoTitle || '',
          seoDescription: p.seoDescription || '',
          category: p.category || '',
        });
        setPublished(p.published);
        const content = p.content || '';
        editor.commands.setContent(content);
        // I5 — record initial content so dirty tracking has a baseline
        initialContentRef.current = editor.getHTML();
        setIsDirty(false);
      } catch {
        toast.error(t('admin.blog.load_failed'));
      }
    };
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // I5 — warn on browser/tab close when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // C1 — try/catch/finally so setSaving(false) always runs on failure
  const save = async (formValues: BlogFormValues, publish?: boolean) => {
    setSaving(true);
    try {
      const content = editor?.getHTML() || '';
      const data = new FormData();
      Object.entries({ ...formValues, content, published: String(publish ?? published) }).forEach(([k, v]) =>
        data.append(k, v as string),
      );
      if (featuredImage) data.append('featuredImage', featuredImage);

      if (isEdit) {
        await api.put(`/blog/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/blog', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      // I5 — clear dirty flag so beforeunload guard doesn't fire after a successful save
      setIsDirty(false);
      navigate('/admin/blog');
    } catch {
      toast.error(t('admin.blog.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  // I4 — inline link input handlers (replaces window.prompt)
  const openLinkInput = () => {
    setShowImageInput(false);
    setPendingImageUrl('');
    setShowLinkInput(true);
    setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  const commitLink = () => {
    const url = pendingLinkUrl.trim();
    if (url) editor?.chain().focus().setLink({ href: url }).run();
    setShowLinkInput(false);
    setPendingLinkUrl('');
  };

  const cancelLink = () => {
    setShowLinkInput(false);
    setPendingLinkUrl('');
  };

  // I4 — inline image input handlers (replaces window.prompt)
  const openImageInput = () => {
    setShowLinkInput(false);
    setPendingLinkUrl('');
    setShowImageInput(true);
    setTimeout(() => imageInputRef.current?.focus(), 0);
  };

  const commitImage = () => {
    const url = pendingImageUrl.trim();
    if (url) editor?.chain().focus().setImage({ src: url }).run();
    setShowImageInput(false);
    setPendingImageUrl('');
  };

  const cancelImage = () => {
    setShowImageInput(false);
    setPendingImageUrl('');
  };

  const TOOLBAR = [
    { action: () => editor?.chain().focus().toggleBold().run(), icon: Bold, title: t('admin.editor.toolbar.bold') },
    { action: () => editor?.chain().focus().toggleItalic().run(), icon: Italic, title: t('admin.editor.toolbar.italic') },
    { action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), icon: Heading2, title: t('admin.editor.toolbar.h2') },
    { action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), icon: Heading3, title: t('admin.editor.toolbar.h3') },
    { action: () => editor?.chain().focus().toggleBulletList().run(), icon: List, title: t('admin.editor.toolbar.bullet') },
    { action: () => editor?.chain().focus().toggleOrderedList().run(), icon: ListOrdered, title: t('admin.editor.toolbar.numbered') },
    { action: () => editor?.chain().focus().toggleBlockquote().run(), icon: Quote, title: t('admin.editor.toolbar.quote') },
    { action: openLinkInput, icon: LinkIcon, title: t('admin.editor.toolbar.link') },
    { action: openImageInput, icon: ImageIcon, title: t('admin.editor.toolbar.image') },
  ];

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/admin/blog')}
        className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'
      >
        <ArrowRight size={14} /> {t('admin.common.back_blog')}
      </button>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Editor */}
        <div className='lg:col-span-2 space-y-4'>
          <div>
            <input
              {...register('title')}
              placeholder={t('admin.editor.title_placeholder')}
              className='w-full text-2xl  text-charcoal bg-transparent border-0 border-b border-beige pb-3 focus:outline-none focus:border-blush'
            />
            {errors.title && <p className='text-xs text-rose-500 mt-1'>{errors.title.message}</p>}
          </div>

          {/* Rich text toolbar */}
          <div className='bg-card border border-beige rounded-t-lg'>
            <div className='flex flex-wrap gap-0.5 p-2'>
              {TOOLBAR.map(({ action, icon: Icon, title }) => (
                <button
                  key={title}
                  type='button'
                  onClick={action}
                  title={title}
                  className='p-2 rounded hover:bg-ivory text-warm-gray hover:text-charcoal transition-colors'
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>

            {/* I4 — inline link URL input */}
            {showLinkInput && (
              <div className='flex items-center gap-2 px-3 pb-2'>
                <input
                  ref={linkInputRef}
                  type='url'
                  value={pendingLinkUrl}
                  onChange={(e) => setPendingLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitLink();
                    }
                    if (e.key === 'Escape') cancelLink();
                  }}
                  placeholder='https://'
                  className='flex-1 text-xs border border-beige rounded px-2 py-1 bg-ivory focus:outline-none focus:border-blush'
                />
                <button type='button' onClick={commitLink} className='text-blush hover:text-charcoal' title={t('admin.editor.apply')}>
                  <Check size={14} />
                </button>
                <button type='button' onClick={cancelLink} className='text-warm-gray hover:text-charcoal' title={t('admin.common.cancel')}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* I4 — inline image URL input */}
            {showImageInput && (
              <div className='flex items-center gap-2 px-3 pb-2'>
                <input
                  ref={imageInputRef}
                  type='url'
                  value={pendingImageUrl}
                  onChange={(e) => setPendingImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitImage();
                    }
                    if (e.key === 'Escape') cancelImage();
                  }}
                  placeholder='https://'
                  className='flex-1 text-xs border border-beige rounded px-2 py-1 bg-ivory focus:outline-none focus:border-blush'
                />
                <button type='button' onClick={commitImage} className='text-blush hover:text-charcoal' title={t('admin.editor.apply')}>
                  <Check size={14} />
                </button>
                <button type='button' onClick={cancelImage} className='text-warm-gray hover:text-charcoal' title={t('admin.common.cancel')}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Editor area */}
          <div className='bg-card border border-t-0 border-beige rounded-b-lg'>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Sidebar settings */}
        <div className='space-y-4'>
          {/* Actions */}
          <div className='bg-card rounded-xl border border-beige p-4 space-y-3'>
            <Button variant='ghost' className='w-full' onClick={handleSubmit((data) => save(data, false))} disabled={saving}>
              {saving ? t('admin.common.saving') : t('admin.editor.save_draft')}
            </Button>
            <Button variant='primary' className='w-full' onClick={handleSubmit((data) => save(data, true))} disabled={saving}>
              {saving ? t('admin.editor.publishing') : t('admin.editor.publish')}
            </Button>
          </div>

          {/* Category */}
          <div className='bg-card rounded-xl border border-beige p-4'>
            <label className='block text-xs text-warm-gray mb-2'>{t('admin.editor.category')}</label>
            <SelectField {...register('category')}>
              <option value=''>{t('admin.editor.select')}</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </SelectField>
          </div>

          {/* Featured image */}
          <div className='bg-card rounded-xl border border-beige p-4'>
            <label className='block text-xs text-warm-gray mb-2'>{t('admin.editor.featured_image')}</label>
            <input
              type='file'
              accept='image/*'
              onChange={(e) => setFeaturedImage(e.target.files?.[0] || null)}
              className='w-full text-xs text-warm-gray file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blush/20 file:text-charcoal file:text-xs hover:file:bg-blush/30 cursor-pointer'
            />
          </div>

          {/* SEO */}
          <div className='bg-card rounded-xl border border-beige p-4 space-y-3'>
            <p className='text-xs font-medium font-sans text-charcoal'>{t('admin.editor.seo')}</p>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.editor.seo_title')}</label>
              <InputField {...register('seoTitle')} placeholder={titleValue} className='text-xs' />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.editor.meta_desc')}</label>
              <TextareaField
                {...register('seoDescription')}
                rows={3}
                placeholder={t('admin.editor.meta_placeholder')}
                className='text-xs'
              />
              {errors.seoDescription && <p className='text-xs text-rose-500 mt-1'>{errors.seoDescription.message}</p>}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
