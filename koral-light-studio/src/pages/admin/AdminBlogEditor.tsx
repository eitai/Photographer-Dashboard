import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useI18n } from '@/lib/i18n';
import api from '@/lib/api';
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
} from 'lucide-react';

const CATEGORIES = ['Family Photography', 'Maternity', 'Newborn', 'Branding', 'Landscape', 'Behind the Lens'];

export const AdminBlogEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: '',
    seoTitle: '',
    seoDescription: '',
    category: '',
    published: false,
  });
  const [saving, setSaving] = useState(false);
  const [featuredImage, setFeaturedImage] = useState<File | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: t('admin.editor.write_placeholder') }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-charcoal',
      },
    },
  });

  useEffect(() => {
    if (!isEdit || !editor) return;
    const load = async () => {
      try {
        const r = await api.get(`/blog/${id}`);
        const p = r.data;
        setForm({
          title: p.title,
          seoTitle: p.seoTitle || '',
          seoDescription: p.seoDescription || '',
          category: p.category || '',
          published: p.published,
        });
        editor.commands.setContent(p.content || '');
      } catch {
        // ignore
      }
    };
    load();
  }, [id, editor]);

  const save = async (publish?: boolean) => {
    setSaving(true);
    const content = editor?.getHTML() || '';
    const data = new FormData();
    Object.entries({ ...form, content, published: String(publish ?? form.published) }).forEach(([k, v]) => data.append(k, v));
    if (featuredImage) data.append('featuredImage', featuredImage);

    if (isEdit) {
      await api.put(`/blog/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    } else {
      await api.post('/blog', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    setSaving(false);
    navigate('/admin/blog');
  };

  const addImage = () => {
    const url = prompt(t('admin.editor.prompt.image_url'));
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  const addLink = () => {
    const url = prompt(t('admin.editor.prompt.url'));
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  };

  const TOOLBAR = [
    { action: () => editor?.chain().focus().toggleBold().run(), icon: Bold, title: t('admin.editor.toolbar.bold') },
    { action: () => editor?.chain().focus().toggleItalic().run(), icon: Italic, title: t('admin.editor.toolbar.italic') },
    { action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), icon: Heading2, title: t('admin.editor.toolbar.h2') },
    { action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), icon: Heading3, title: t('admin.editor.toolbar.h3') },
    { action: () => editor?.chain().focus().toggleBulletList().run(), icon: List, title: t('admin.editor.toolbar.bullet') },
    { action: () => editor?.chain().focus().toggleOrderedList().run(), icon: ListOrdered, title: t('admin.editor.toolbar.numbered') },
    { action: () => editor?.chain().focus().toggleBlockquote().run(), icon: Quote, title: t('admin.editor.toolbar.quote') },
    { action: addLink, icon: LinkIcon, title: t('admin.editor.toolbar.link') },
    { action: addImage, icon: ImageIcon, title: t('admin.editor.toolbar.image') },
  ];

  return (
    <AdminLayout>
      <button
        onClick={() => navigate('/admin/blog')}
        className='flex items-center gap-1 text-sm text-warm-gray hover:text-charcoal mb-6'
      >
        <ArrowLeft size={14} /> {t('admin.common.back_blog')}
      </button>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Editor */}
        <div className='lg:col-span-2 space-y-4'>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('admin.editor.title_placeholder')}
            className='w-full text-2xl  text-charcoal bg-transparent border-0 border-b border-beige pb-3 focus:outline-none focus:border-blush'
          />

          {/* Rich text toolbar */}
          <div className='bg-card border border-beige rounded-t-lg flex flex-wrap gap-0.5 p-2'>
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

          {/* Editor area */}
          <div className='bg-card border border-t-0 border-beige rounded-b-lg'>
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Sidebar settings */}
        <div className='space-y-4'>
          {/* Actions */}
          <div className='bg-card rounded-xl border border-beige p-4 space-y-3'>
            <button
              onClick={() => save(false)}
              disabled={saving}
              className='w-full py-2 rounded-lg text-sm border border-beige text-charcoal hover:bg-ivory transition-colors disabled:opacity-60'
            >
              {saving ? t('admin.common.saving') : t('admin.editor.save_draft')}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className='w-full py-2 rounded-lg text-sm bg-blush text-charcoal font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
            >
              {saving ? t('admin.editor.publishing') : t('admin.editor.publish')}
            </button>
          </div>

          {/* Category */}
          <div className='bg-card rounded-xl border border-beige p-4'>
            <label className='block text-xs text-warm-gray mb-2'>{t('admin.editor.category')}</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
            >
              <option value=''>{t('admin.editor.select')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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
              <input
                value={form.seoTitle}
                onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                placeholder={form.title}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50'
              />
            </div>
            <div>
              <label className='block text-xs text-warm-gray mb-1'>{t('admin.editor.meta_desc')}</label>
              <textarea
                value={form.seoDescription}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                rows={3}
                placeholder={t('admin.editor.meta_placeholder')}
                className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-xs text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/50 resize-none'
              />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
