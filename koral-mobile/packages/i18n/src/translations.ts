// SupportedLocale is intentionally redeclared here (not imported from index)
// to break the circular dependency: index.tsx -> translations.ts -> index.tsx.
// The canonical export lives in index.tsx; this local alias keeps the type
// consistent without introducing a cycle that Metro cannot resolve at runtime.
type SupportedLocale = 'he' | 'en';

export const translations: Record<string, Record<SupportedLocale, string>> = {
  // Nav
  'nav.home': { he: 'בית', en: 'Home' },
  'nav.portfolio': { he: 'גלריה', en: 'Portfolio' },
  'nav.contact': { he: 'צרו קשר', en: 'Contact' },
  'nav.blog': { he: 'בלוג', en: 'Blog' },

  // Hero
  'hero.title': { he: 'רגעים שחיים באור', en: 'Moments that live in the light.' },
  'hero.subtitle': {
    he: 'צילומי משפחה, הריון וניו בורן בצפון הארץ',
    en: 'Family, maternity & newborn photography in Northern Israel.',
  },
  'hero.cta.gallery': { he: 'צפי בגלריה שלך', en: 'View Your Gallery' },
  'hero.cta.book': { he: 'לתיאום צילום', en: 'Book a Session' },

  // About
  'about.title': { he: 'קצת עליי', en: 'About Me' },
  'about.text': {
    he: 'שלום, אני קורל. צלמת משפחות, הריון וניו בורן בצפון הארץ. אני מאמינה שהרגעים הכי יפים הם אלה שקורים כשלא שמים לב — חיבוק ספונטני, מבט חטוף, צחוק של ילד. אני כאן כדי לתפוס את האור שבתוך המשפחה שלכם.',
    en: "Hi, I'm Koral. A family, maternity, and newborn photographer in Northern Israel. I believe the most beautiful moments are the ones that happen when no one is watching — a spontaneous hug, a stolen glance, a child's laughter. I'm here to capture the light within your family.",
  },

  // Portfolio
  'portfolio.title': { he: 'הגלריה', en: 'Portfolio' },
  'portfolio.families': { he: 'משפחות', en: 'Families' },
  'portfolio.maternity': { he: 'הריון', en: 'Maternity' },
  'portfolio.newborn': { he: 'ניו בורן', en: 'Newborn' },
  'portfolio.branding': { he: 'מיתוג אישי', en: 'Branding' },
  'portfolio.landscape': { he: 'נוף', en: 'Landscape' },

  // Showcase & Users
  'admin.nav.showcase': { he: 'גלריה בדף נחיתה', en: 'Showcase' },
  'admin.nav.users': { he: 'משתמשים', en: 'Users' },
  'showcase.title': { he: 'מבחר עבודות', en: 'Selected Work' },

  // Testimonials
  'testimonials.title': { he: 'מה אומרים עליי', en: 'Kind Words' },
  'testimonial.1.text': {
    he: 'קורל יצרה אווירה כל כך נעימה שהילדים פשוט היו טבעיים. התמונות יצאו מדהימות.',
    en: 'Koral created such a warm atmosphere that the kids were completely natural. The photos came out amazing.',
  },
  'testimonial.1.name': { he: 'מיכל ודני', en: 'Michal & Danny' },
  'testimonial.2.text': {
    he: 'הצילומים של ההריון היו חוויה מרגשת. קורל ידעה בדיוק איך לגרום לי להרגיש יפה ונינוחה.',
    en: 'The maternity shoot was such an emotional experience. Koral knew exactly how to make me feel beautiful and relaxed.',
  },
  'testimonial.2.name': { he: 'שירה כ.', en: 'Shira K.' },
  'testimonial.3.text': {
    he: 'הגלריה הפרטית הייתה חוויה בפני עצמה. הכל כל כך מאורגן ויפה. ממליצה בחום!',
    en: 'The private gallery was an experience in itself. Everything so organized and beautiful. Highly recommend!',
  },
  'testimonial.3.name': { he: 'נועה ר.', en: 'Noa R.' },

  // Contact
  'contact.title': { he: 'בואי נדבר', en: "Let's Talk" },
  'contact.subtitle': {
    he: 'אשמח לשמוע ממך ולתכנן יחד את הצילום המושלם',
    en: "I'd love to hear from you and plan the perfect session together",
  },
  'contact.name': { he: 'שם', en: 'Name' },
  'contact.phone': { he: 'טלפון', en: 'Phone' },
  'contact.email': { he: 'אימייל', en: 'Email' },
  'contact.session': { he: 'סוג צילום', en: 'Session Type' },
  'contact.message': { he: 'הודעה', en: 'Message' },
  'contact.send': { he: 'שלחי הודעה', en: 'Send Message' },
  'contact.success': { he: 'אחזור אלייך בהקדם 🤍', en: "I'll be in touch very soon 🤍" },
  'contact.session.family': { he: 'צילומי משפחה', en: 'Family Photography' },
  'contact.session.maternity': { he: 'צילומי הריון', en: 'Maternity Photography' },
  'contact.session.newborn': { he: 'צילומי ניו בורן', en: 'Newborn Photography' },
  'contact.session.branding': { he: 'צילומי מיתוג', en: 'Branding Photography' },
  'contact.session.landscape': { he: 'צילומי נוף', en: 'Landscape Photography' },
  'contact.required_fields': { he: 'נא למלא את השדות החובה', en: 'Please fill in required fields' },
  'contact.error': { he: 'משהו השתבש. אנא נסה שנית.', en: 'Something went wrong. Please try again.' },
  'contact.submitting': { he: '…', en: '…' },

  // Blog
  'blog.title': { he: 'מאחורי העדשה', en: 'Behind the Lens' },
  'blog.subtitle': { he: 'סיפורים, טיפים ורגעים מתוך הסטודיו', en: 'Stories, tips and moments from the studio' },
  'blog.preview.title': { he: 'מהבלוג שלי', en: 'From My Blog' },
  'blog.preview.cta': { he: 'לכל הפוסטים', en: 'See all posts' },
  'blog.no_posts': { he: 'אין פוסטים עדיין.', en: 'No posts yet.' },
  'blog.post_not_found': { he: 'הפוסט לא נמצא', en: 'Post not found' },
  'blog.back': { he: 'חזרה לבלוג', en: 'Back to blog' },

  // Client Gallery (public)
  'gallery.not_found': { he: 'הגלריה לא נמצאה', en: 'Gallery not found' },
  'gallery.link_expired': { he: 'הקישור עשוי להיות פג תוקף או לא תקין.', en: 'This link may have expired or is invalid.' },
  'gallery.thank_you': { he: 'תודה 🤍', en: 'Thank you 🤍' },
  'gallery.review_choices': { he: 'אסקור את בחירותייך בקפידה.', en: "I'll review your choices with care." },
  'gallery.images_selected': { he: 'תמונות נבחרו', en: 'images selected' },
  'gallery.send_selection': { he: 'שלחי את הבחירה', en: 'Send My Selection' },
  'gallery.no_images': { he: 'אין תמונות בגלריה זו עדיין.', en: 'No images in this gallery yet.' },
  'gallery.select_photo': { he: 'בחרי תמונה', en: 'Select photo' },
  'gallery.photo_selected': { he: 'נבחרה', en: 'Selected' },
  'gallery.choose_more': { he: 'בחרי עוד', en: 'Choose more' },
  'gallery.close_window': { he: 'סגרי חלון', en: 'Close window' },
  'gallery.max_reached': { he: 'הגעת למקסימום הבחירות', en: 'Maximum selections reached' },
  'gallery.select_of': { he: 'מתוך', en: 'of' },
  // Delivery gallery (download-only)
  'gallery.delivery_title': { he: 'התמונות המעובדות שלך', en: 'Your Edited Photos' },
  'gallery.download_all': { he: 'הורדת הכל (ZIP)', en: 'Download All (ZIP)' },
  'gallery.download_photo': { he: 'הורדה', en: 'Download' },
  'gallery.preparing_zip': { he: 'מכין ZIP…', en: 'Preparing ZIP…' },

  // Footer
  'footer.rights': { he: 'כל הזכויות שמורות', en: 'All rights reserved' },
  'footer.tagline': { he: 'כל תמונה מספרת סיפור קטן', en: 'Every image holds a little story' },

  // ── Admin: Sidebar ──────────────────────────────────────────────────────────
  'admin.sidebar.studio': { he: 'סטודיו לצילום', en: 'Photography Studio' },
  'admin.nav.dashboard': { he: 'לוח בקרה', en: 'Dashboard' },
  'admin.nav.clients': { he: 'לקוחות', en: 'Clients' },
  'admin.nav.galleries': { he: 'גלריות', en: 'Galleries' },
  'admin.nav.selections': { he: 'בחירות', en: 'Selections' },
  'admin.nav.blog': { he: 'בלוג', en: 'Blog' },
  'admin.nav.settings': { he: 'הגדרות', en: 'Settings' },
  'admin.nav.logout': { he: 'התנתקות', en: 'Logout' },

  // ── Admin: Login ────────────────────────────────────────────────────────────
  'admin.login.subtitle': { he: 'ממשק ניהול', en: 'Photographer Admin' },
  'admin.login.email': { he: 'אימייל', en: 'Email' },
  'admin.login.password': { he: 'סיסמה', en: 'Password' },
  'admin.login.error': { he: 'אימייל או סיסמה שגויים', en: 'Invalid email or password' },
  'admin.login.signing_in': { he: 'מתחבר…', en: 'Signing in…' },
  'admin.login.sign_in': { he: 'כניסה', en: 'Sign in' },

  // ── Admin: Dashboard ────────────────────────────────────────────────────────
  'admin.dashboard.greeting': { he: 'בוקר טוב', en: 'Good morning' },
  'admin.dashboard.clients': { he: 'לקוחות', en: 'Clients' },
  'admin.dashboard.galleries': { he: 'גלריות', en: 'Galleries' },
  'admin.dashboard.pending': { he: 'בחירות ממתינות', en: 'Pending Selections' },
  'admin.dashboard.blog_posts': { he: 'פוסטים', en: 'Blog Posts' },
  'admin.dashboard.recent_clients': { he: 'לקוחות אחרונים', en: 'Recent Clients' },
  'admin.dashboard.view_all': { he: 'הצג הכל', en: 'View all' },
  'admin.dashboard.no_clients': { he: 'אין לקוחות עדיין.', en: 'No clients yet.' },

  // ── Admin: Common ───────────────────────────────────────────────────────────
  'admin.common.loading': { he: 'טוען…', en: 'Loading…' },
  'admin.common.saving': { he: 'שומר…', en: 'Saving…' },
  'admin.common.deleting': { he: 'מוחק…', en: 'Deleting…' },
  'admin.common.cancel': { he: 'ביטול', en: 'Cancel' },
  'admin.common.name': { he: 'שם', en: 'Name' },
  'admin.common.phone': { he: 'טלפון', en: 'Phone' },
  'admin.common.email': { he: 'אימייל', en: 'Email' },
  'admin.common.notes': { he: 'הערות', en: 'Notes' },
  'admin.common.status': { he: 'סטטוס', en: 'Status' },
  'admin.common.session_type': { he: 'סוג צילום', en: 'Session Type' },
  'admin.common.back_clients': { he: 'חזרה ללקוחות', en: 'Back to clients' },
  'admin.common.back_galleries': { he: 'חזרה לגלריות', en: 'Back to galleries' },
  'admin.common.back_blog': { he: 'חזרה לבלוג', en: 'Back to blog' },

  // ── Admin: Clients ──────────────────────────────────────────────────────────
  'admin.clients.title': { he: 'לקוחות', en: 'Clients' },
  'admin.clients.search': { he: 'חיפוש לקוחות…', en: 'Search clients…' },
  'admin.clients.new': { he: 'לקוח חדש', en: 'New Client' },
  'admin.clients.create': { he: 'יצירת לקוח', en: 'Create Client' },
  'admin.clients.no_clients': { he: 'לא נמצאו לקוחות.', en: 'No clients found.' },
  'admin.clients.col_session': { he: 'צילום', en: 'Session' },
  'admin.clients.view': { he: 'צפה', en: 'View →' },
  'admin.clients.delete_title': { he: 'מחיקת לקוח', en: 'Delete Client' },
  'admin.clients.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This action cannot be undone.' },
  'admin.clients.delete_btn': { he: 'מחק', en: 'Delete' },
  'admin.clients.deleting': { he: 'מוחק…', en: 'Deleting…' },

  // ── Admin: Client Detail ────────────────────────────────────────────────────
  'admin.client.session_label': { he: 'צילום', en: 'session' },
  'admin.client.edit': { he: 'עריכה', en: 'Edit' },
  'admin.client.save': { he: 'שמור שינויים', en: 'Save changes' },
  'admin.client.created': { he: 'נוצר', en: 'Created' },
  'admin.client.galleries': { he: 'גלריות', en: 'Galleries' },
  'admin.client.new_gallery': { he: '+ גלריה חדשה', en: '+ New gallery' },
  'admin.client.no_galleries': { he: 'אין גלריות מקושרות.', en: 'No galleries linked.' },
  'admin.client.copy_link': { he: 'העתק קישור', en: 'Copy link' },
  'admin.client.delivery_suffix': { he: 'ערוך', en: 'Edited' },
  'admin.client.create_delivery': { he: 'צור גלריית מסירה', en: 'Create Delivery Gallery' },
  'admin.client.delivery_badge': { he: 'מסירה', en: 'Delivery' },
  'admin.client.delivery_header_ph': {
    he: 'הודעה ללקוחה (למשל: "התמונות המעובדות שלך מוכנות 🤍")',
    en: 'Message to client (e.g. "Your edited photos are ready 🤍")',
  },
  'admin.client.creating_delivery': { he: 'יוצר…', en: 'Creating…' },
  'admin.client.max_selections': { he: 'מקסימום בחירות', en: 'Max selections' },
  'admin.client.delete_gallery': { he: 'מחק גלריה', en: 'Delete gallery' },
  'admin.client.delete_gallery_confirm': { he: 'מחיקת גלריה', en: 'Delete Gallery' },
  'admin.client.delete_gallery_body': {
    he: 'הגלריה וכל התמונות שבה יימחקו לצמיתות. פעולה זו לא ניתנת לביטול.',
    en: 'The gallery and all its images will be permanently deleted. This cannot be undone.',
  },

  // ── Admin: Galleries ────────────────────────────────────────────────────────
  'admin.galleries.title': { he: 'גלריות', en: 'Galleries' },
  'admin.galleries.new': { he: 'גלריה חדשה', en: 'New Gallery' },
  'admin.galleries.name_label': { he: 'שם גלריה *', en: 'Gallery Name *' },
  'admin.galleries.client_label': { he: 'לקוח', en: 'Client' },
  'admin.galleries.select_client': { he: '— בחר לקוח —', en: '— Select client —' },
  'admin.galleries.header_msg': { he: 'הודעת כותרת (תוצג ללקוח)', en: 'Header Message (shown to client)' },
  'admin.galleries.creating': { he: 'יוצר…', en: 'Creating…' },
  'admin.galleries.create': { he: 'יצירת גלריה', en: 'Create Gallery' },
  'admin.galleries.manage': { he: 'ניהול', en: 'Manage' },
  'admin.galleries.no_galleries': { he: 'אין גלריות עדיין.', en: 'No galleries yet.' },
  'admin.galleries.email_sent': { he: 'מייל נשלח ללקוח', en: 'Email sent to client' },
  'admin.galleries.no_email': { he: 'אין מייל — לא נשלח', en: 'No email on file — not sent' },
  'admin.galleries.resend_email': { he: 'שלח שוב', en: 'Resend Email' },
  'admin.galleries.link_sent': { he: 'נשלח', en: 'Sent' },
  'admin.galleries.sending': { he: 'שולח…', en: 'Sending…' },
  'admin.galleries.resent': { he: 'נשלח!', en: 'Sent!' },
  'admin.galleries.whatsapp_send': { he: 'שלח בוואטסאפ', en: 'Send via WhatsApp' },
  'admin.galleries.whatsapp_msg': {
    he: 'שלום {name}, הגלריה שלך מוכנה לצפייה 🤍\n{url}',
    en: 'Hi {name}, your gallery is ready to view 🤍\n{url}',
  },

  // ── Admin: Gallery Upload ───────────────────────────────────────────────────
  'admin.upload.images': { he: 'תמונות', en: 'images' },
  'admin.upload.drag': { he: 'גרור ושחרר תמונות כאן', en: 'Drag & drop images here' },
  'admin.upload.browse': {
    he: 'או לחץ לעיון — עד 1000 תמונות, 20MB לכל תמונה',
    en: 'or click to browse — up to 1000 images, 20MB each',
  },
  'admin.upload.error': { he: 'שגיאה', en: 'Error' },
  'admin.upload.done': { he: 'הושלם', en: 'Done' },
  'admin.upload.no_images': { he: 'טרם הועלו תמונות.', en: 'No images uploaded yet.' },
  'admin.upload.selected': { he: 'נבחרו', en: 'selected' },
  'admin.upload.clear_selection': { he: 'נקה בחירה', en: 'Clear selection' },
  'admin.upload.delete_selected': { he: 'מחק נבחרים', en: 'Delete selected' },
  'admin.upload.delete_confirm': { he: 'מחיקת תמונות', en: 'Delete images' },
  'admin.upload.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This cannot be undone.' },
  'admin.upload.select': { he: 'בחר תמונה', en: 'Select image' },
  'admin.upload.selected_one': { he: 'נבחרה', en: 'Selected' },
  'admin.upload.delete_title': { he: 'מחיקה', en: 'Delete' },
  'admin.upload.open_title': { he: 'פתיחה', en: 'Open' },

  // ── Admin: Selections ───────────────────────────────────────────────────────
  'admin.selections.title': { he: 'בחירות לקוחות', en: 'Client Selections' },
  'admin.selections.galleries': { he: 'גלריות עם בחירות', en: 'Galleries with Submissions' },
  'admin.selections.no_galleries': { he: 'טרם נשלחו בחירות.', en: 'No submitted selections yet.' },
  'admin.selections.select_gallery': { he: 'בחר גלריה לצפייה בבחירות', en: 'Select a gallery to view submissions' },
  'admin.selections.no_submissions': { he: 'אין הגשות לגלריה זו', en: 'No submissions for this gallery' },
  'admin.selections.images_selected': { he: 'תמונות נבחרו', en: 'images selected' },
  'admin.selections.submitted': { he: 'נשלח', en: 'Submitted' },
  'admin.selections.preparing': { he: 'מכין…', en: 'Preparing…' },
  'admin.selections.download': { he: 'הורדת ZIP', en: 'Download ZIP' },
  'admin.selections.delete_submission': { he: 'מחק בחירה', en: 'Delete selection' },
  'admin.selections.delete_sub_confirm': { he: 'מחיקת כל הבחירות', en: 'Delete all selected photos' },
  'admin.selections.delete_sub_body': {
    he: 'כל הבחירות שנשלחו על ידי הלקוחה יימחקו. התמונות המקוריות לא יימחקו.',
    en: "All photos chosen by the client will be removed. The original files won't be deleted.",
  },
  'admin.selections.delete_image': { he: 'הסר תמונה', en: 'Remove image' },
  'admin.selections.delete_confirm': { he: 'הסרת תמונה מהבחירה', en: 'Remove image from selection' },
  'admin.selections.delete_body': {
    he: 'התמונה תוסר מבחירת הלקוחה. הקובץ המקורי לא יימחק.',
    en: "This photo will be removed from the client's selection. The original file won't be deleted.",
  },
  'admin.selections.deleting': { he: 'מסיר…', en: 'Removing…' },

  // ── Admin: Blog ─────────────────────────────────────────────────────────────
  'admin.blog.title': { he: 'בלוג', en: 'Blog' },
  'admin.blog.new_post': { he: 'פוסט חדש', en: 'New Post' },
  'admin.blog.no_posts': { he: 'אין פוסטים עדיין.', en: 'No blog posts yet.' },
  'admin.blog.col_title': { he: 'כותרת', en: 'Title' },
  'admin.blog.col_category': { he: 'קטגוריה', en: 'Category' },
  'admin.blog.col_status': { he: 'סטטוס', en: 'Status' },
  'admin.blog.col_date': { he: 'תאריך', en: 'Date' },
  'admin.blog.published': { he: 'פורסם', en: 'Published' },
  'admin.blog.draft': { he: 'טיוטה', en: 'Draft' },
  'admin.blog.delete_confirm': { he: 'למחוק את הפוסט?', en: 'Delete this post?' },

  // ── Admin: Blog Editor ──────────────────────────────────────────────────────
  'admin.editor.title_placeholder': { he: 'כותרת הפוסט…', en: 'Post title…' },
  'admin.editor.write_placeholder': { he: 'כתוב את הסיפור שלך כאן…', en: 'Write your story here…' },
  'admin.editor.save_draft': { he: 'שמור טיוטה', en: 'Save Draft' },
  'admin.editor.publishing': { he: 'מפרסם…', en: 'Publishing…' },
  'admin.editor.publish': { he: 'פרסם', en: 'Publish' },
  'admin.editor.category': { he: 'קטגוריה', en: 'Category' },
  'admin.editor.select': { he: '— בחר —', en: '— Select —' },
  'admin.editor.featured_image': { he: 'תמונה ראשית', en: 'Featured Image' },
  'admin.editor.seo_title': { he: 'כותרת SEO', en: 'SEO Title' },
  'admin.editor.meta_desc': { he: 'תיאור מטא', en: 'Meta Description' },
  'admin.editor.meta_placeholder': { he: 'תיאור קצר למנועי חיפוש…', en: 'Brief description for search engines…' },
  'admin.editor.seo': { he: 'SEO', en: 'SEO' },
  'admin.editor.prompt.image_url': { he: ':כתובת תמונה', en: 'Image URL:' },
  'admin.editor.prompt.url': { he: ':כתובת URL', en: 'URL:' },
  'admin.editor.toolbar.bold': { he: 'מודגש', en: 'Bold' },
  'admin.editor.toolbar.italic': { he: 'נטוי', en: 'Italic' },
  'admin.editor.toolbar.h2': { he: 'כותרת 2', en: 'H2' },
  'admin.editor.toolbar.h3': { he: 'כותרת 3', en: 'H3' },
  'admin.editor.toolbar.bullet': { he: 'רשימת נקודות', en: 'Bullet list' },
  'admin.editor.toolbar.numbered': { he: 'רשימה ממוספרת', en: 'Numbered list' },
  'admin.editor.toolbar.quote': { he: 'ציטוט', en: 'Blockquote' },
  'admin.editor.toolbar.link': { he: 'קישור', en: 'Link' },
  'admin.editor.toolbar.image': { he: 'תמונה', en: 'Image' },

  // ── Admin: Settings ─────────────────────────────────────────────────────────
  'admin.settings.title': { he: 'הגדרות', en: 'Settings' },
  'admin.settings.account': { he: 'חשבון', en: 'Account' },
  'admin.settings.change_password': { he: 'שינוי סיסמה', en: 'Change Password' },
  'admin.settings.current_password': { he: 'סיסמה נוכחית', en: 'Current Password' },
  'admin.settings.new_password': { he: 'סיסמה חדשה', en: 'New Password' },
  'admin.settings.confirm_password': { he: 'אישור סיסמה חדשה', en: 'Confirm New Password' },
  'admin.settings.passwords_mismatch': { he: 'הסיסמאות אינן תואמות', en: 'Passwords do not match' },
  'admin.settings.password_updated': { he: 'הסיסמה עודכנה בהצלחה', en: 'Password updated successfully' },
  'admin.settings.password_failed': { he: 'עדכון הסיסמה נכשל', en: 'Failed to update password' },
  'admin.settings.updating': { he: 'מעדכן…', en: 'Updating…' },
  'admin.settings.update_password': { he: 'עדכון סיסמה', en: 'Update Password' },
  'admin.settings.system': { he: 'מערכת', en: 'System' },
  'admin.settings.api_server': { he: 'שרת API', en: 'API Server' },

  // ── Admin: Status labels ────────────────────────────────────────────────────
  'admin.status.gallery_sent': { he: 'גלריה נשלחה', en: 'Gallery Sent' },
  'admin.status.viewed': { he: 'נצפה', en: 'Viewed' },
  'admin.status.selection_submitted': { he: 'בחירה הוגשה', en: 'Selection Submitted' },
  'admin.status.in_editing': { he: 'בעריכה', en: 'In Editing' },
  'admin.status.delivered': { he: 'נמסר', en: 'Delivered' },

  // ── Mobile-only ─────────────────────────────────────────────────────────────
  'mobileOnly.tapToSelect': { he: 'לחץ לבחירה', en: 'Tap to select' },
  'mobileOnly.swipeToView': { he: 'החלק לצפייה', en: 'Swipe to view' },
  'mobileOnly.saveToGallery': { he: 'נשמר לגלריה', en: 'Saved to gallery' },
  'mobileOnly.uploadPhotos': { he: 'העלה תמונות', en: 'Upload photos' },
  'mobileOnly.shareGallery': { he: 'שתף גלריה', en: 'Share gallery' },

  // ── Client app: Landing ──────────────────────────────────────────────────
  'client.landing.tagline': {
    he: 'הגלריה שלך מחכה לך',
    en: 'Your gallery is waiting',
  },
  'client.landing.instruction': {
    he: 'פתחי את הקישור שהצלמת שלחה לך',
    en: 'Open the link your photographer sent you',
  },

  // ── Client app: In editing status ────────────────────────────────────────
  'client.editing.title': { he: 'התמונות שלך בעריכה', en: 'Your photos are being edited' },
  'client.editing.body': {
    he: 'אנחנו עובדים על התמונות שלך. נעדכן אותך כשהן מוכנות.',
    en: "We're working on your photos. We'll notify you when they're ready.",
  },

  // ── Client app: Delivery ────────────────────────────────────────────────
  'client.delivery.save_all': { he: 'שמירת הכל לגלריה', en: 'Save All to Camera Roll' },
  'client.delivery.permission_denied': {
    he: 'נדרשת הרשאה לגישה לגלריה כדי לשמור תמונות',
    en: 'Media library permission is required to save photos',
  },

  // ── Client app: Selection message ────────────────────────────────────────
  'client.selection.message_placeholder': {
    he: 'הוספת הודעה (לא חובה)…',
    en: 'Add a message (optional)…',
  },

  // ── Admin: Phase 2 — Tab bar ────────────────────────────────────────────────
  'admin.tab.dashboard': { he: 'בקרה', en: 'Dashboard' },
  'admin.tab.clients': { he: 'לקוחות', en: 'Clients' },
  'admin.tab.galleries': { he: 'גלריות', en: 'Galleries' },
  'admin.tab.selections': { he: 'בחירות', en: 'Selections' },

  // ── Admin: Phase 2 — Dashboard ──────────────────────────────────────────────
  'admin.dashboard.hello': { he: 'שלום', en: 'Hello' },
  'admin.dashboard.delivered': { he: 'נמסרו', en: 'Delivered' },
  'admin.dashboard.total': { he: 'סה״כ', en: 'Total' },
  'admin.dashboard.stats_error': { he: 'שגיאה בטעינת נתונים', en: 'Failed to load stats' },

  // ── Admin: Session types ─────────────────────────────────────────────────────
  'admin.session.family': { he: 'משפחה', en: 'Family' },
  'admin.session.maternity': { he: 'הריון', en: 'Maternity' },
  'admin.session.newborn': { he: 'ניו בורן', en: 'Newborn' },
  'admin.session.branding': { he: 'מיתוג', en: 'Branding' },
  'admin.session.landscape': { he: 'נוף', en: 'Landscape' },
  'admin.session.none': { he: '— ללא —', en: '— None —' },

  // ── Admin: Phase 2 — Clients ────────────────────────────────────────────────
  'admin.clients.error': { he: 'שגיאה בטעינת לקוחות', en: 'Failed to load clients' },

  // ── Admin: Phase 2 — Client detail ─────────────────────────────────────────
  'admin.client.error': { he: 'שגיאה בטעינת לקוח', en: 'Failed to load client' },
  'admin.client.delete': { he: 'מחיקת לקוח', en: 'Delete client' },
  'admin.client.delete_confirm': { he: 'האם למחוק את הלקוח?', en: 'Delete this client?' },
  'admin.client.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This cannot be undone.' },
  'admin.client.save_success': { he: 'נשמר בהצלחה', en: 'Saved successfully' },

  // ── Admin: Phase 2 — Galleries ──────────────────────────────────────────────
  'admin.galleries.error': { he: 'שגיאה בטעינת גלריות', en: 'Failed to load galleries' },
  'admin.galleries.images': { he: 'תמונות', en: 'images' },
  'admin.galleries.upload': { he: 'העלאת תמונות', en: 'Upload Images' },
  'admin.galleries.share_link': { he: 'שתף קישור', en: 'Share Link' },
  'admin.galleries.link_copied': { he: 'הקישור הועתק!', en: 'Link copied!' },
  'admin.galleries.status_updated': { he: 'הסטטוס עודכן', en: 'Status updated' },
  'admin.galleries.save_success': { he: 'נשמר בהצלחה', en: 'Saved successfully' },
  'admin.galleries.upload_pick': { he: 'בחר תמונות', en: 'Pick Images' },
  'admin.galleries.uploading': { he: 'מעלה…', en: 'Uploading…' },
  'admin.galleries.error_detail': { he: 'שגיאה בטעינת גלריה', en: 'Failed to load gallery' },
  'admin.galleries.no_images': { he: 'אין תמונות בגלריה זו עדיין.', en: 'No images yet.' },
  'admin.galleries.select_status': { he: 'שנה סטטוס', en: 'Change Status' },
  'admin.galleries.client': { he: 'לקוח', en: 'Client' },
  'admin.galleries.title_label': { he: 'שם הגלריה', en: 'Gallery Title' },

  // ── Admin: Phase 2 — Selections ─────────────────────────────────────────────
  'admin.selections.error': { he: 'שגיאה בטעינת בחירות', en: 'Failed to load selections' },
  'admin.selections.mark_editing': { he: 'העבר לעריכה', en: 'Mark as In Editing' },
  'admin.selections.marking': { he: 'מעדכן…', en: 'Updating…' },
  'admin.selections.share_list': { he: 'שתף רשימת קבצים', en: 'Share File List' },
  'admin.selections.client': { he: 'לקוח', en: 'Client' },
  'admin.selections.hero': { he: 'תמונה ראשית', en: 'Hero image' },
  'admin.selections.comment': { he: 'הערת לקוח', en: 'Client comment' },
  'admin.selections.no_selection': { he: 'אין בחירות לגלריה זו.', en: 'No selection for this gallery.' },
  'admin.selections.error_detail': { he: 'שגיאה בטעינת בחירה', en: 'Failed to load selection' },

  // ── Admin: Phase 2 — Common ─────────────────────────────────────────────────
  'admin.common.error_retry': { he: 'נסה שוב', en: 'Retry' },
  'admin.common.save': { he: 'שמור', en: 'Save' },
  'admin.common.delete': { he: 'מחק', en: 'Delete' },
  'admin.common.confirm': { he: 'אישור', en: 'Confirm' },
  'admin.common.title': { he: 'כותרת', en: 'Title' },
  'admin.common.select_client': { he: 'בחר לקוח', en: 'Select client' },
  'admin.common.required': { he: 'שדה חובה', en: 'Required' },
  'admin.common.create': { he: 'יצירה', en: 'Create' },
  'admin.common.creating': { he: 'יוצר…', en: 'Creating…' },

  // ── Admin: Phase 4 — Tab bar ────────────────────────────────────────────────
  'admin.tab.blog': { he: 'בלוג', en: 'Blog' },
  'admin.tab.settings': { he: 'הגדרות', en: 'Settings' },

  // ── Admin: Phase 4 — Blog list ──────────────────────────────────────────────
  'admin.blog.error': { he: 'שגיאה בטעינת פוסטים', en: 'Failed to load posts' },
  'admin.blog.published_badge': { he: 'פורסם', en: 'Published' },
  'admin.blog.draft_badge': { he: 'טיוטה', en: 'Draft' },
  'admin.blog.toggle_error': { he: 'שגיאה בעדכון סטטוס', en: 'Failed to update status' },

  // ── Admin: Phase 4 — Blog detail ────────────────────────────────────────────
  'admin.blog.error_detail': { he: 'שגיאה בטעינת פוסט', en: 'Failed to load post' },
  'admin.blog.save_success': { he: 'נשמר בהצלחה', en: 'Saved successfully' },
  'admin.blog.save_error': { he: 'שגיאה בשמירה', en: 'Failed to save' },
  'admin.blog.delete_error': { he: 'שגיאה במחיקה', en: 'Failed to delete' },
  'admin.blog.rich_text_note': {
    he: 'עריכת טקסט עשיר זמינה באפליקציית הווב בלבד.',
    en: 'For full rich text editing, use the web app.',
  },
  'admin.blog.content_label': { he: 'תוכן', en: 'Content' },
  'admin.blog.published_toggle': { he: 'מפורסם', en: 'Published' },
  'admin.blog.delete_confirm': { he: 'האם למחוק את הפוסט?', en: 'Delete this post?' },
  'admin.blog.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This cannot be undone.' },
  'admin.blog.back': { he: 'חזרה לבלוג', en: 'Back to blog' },

  // ── Admin: Phase 4 — New Blog Post ──────────────────────────────────────────
  'admin.blog.create': { he: 'פוסט חדש', en: 'New Post' },
  'admin.blog.create_error': { he: 'שגיאה ביצירת הפוסט', en: 'Failed to create post' },

  // ── Admin: Phase 4 — Settings ───────────────────────────────────────────────
  'admin.settings.error': { he: 'שגיאה בטעינת הגדרות', en: 'Failed to load settings' },
  'admin.settings.studio_section': { he: 'פרטי הסטודיו', en: 'Studio Info' },
  'admin.settings.studio_name': { he: 'שם הסטודיו', en: 'Studio Name' },
  'admin.settings.about': { he: 'אודות', en: 'About' },
  'admin.settings.contact_email': { he: 'אימייל ליצירת קשר', en: 'Contact Email' },
  'admin.settings.phone': { he: 'טלפון', en: 'Phone' },
  'admin.settings.save_success': { he: 'ההגדרות נשמרו', en: 'Settings saved' },
  'admin.settings.save_error': { he: 'שגיאה בשמירה', en: 'Failed to save' },
  'admin.settings.saving': { he: 'שומר…', en: 'Saving…' },
  'admin.settings.save': { he: 'שמור הגדרות', en: 'Save Settings' },
  'admin.settings.account_section': { he: 'חשבון', en: 'Account' },
  'admin.settings.app_section': { he: 'אפליקציה', en: 'App Info' },
  'admin.settings.app_version': { he: 'גרסה', en: 'Version' },
  'admin.settings.api_url': { he: 'כתובת שרת', en: 'API URL' },
  'admin.settings.sign_out': { he: 'התנתקות', en: 'Sign Out' },
  'admin.settings.sign_out_confirm': { he: 'האם להתנתק?', en: 'Sign out?' },
  'admin.settings.sign_out_body': { he: 'תצטרך להתחבר שוב.', en: 'You will need to sign in again.' },
  'admin.settings.features_section': { he: 'תכונות', en: 'Features' },
  'admin.settings.showcase': { he: 'תמונות בדף נחיתה', en: 'Showcase Images' },
  'admin.settings.users': { he: 'ניהול משתמשים', en: 'Manage Users' },
  'admin.settings.public_page': { he: 'דף ציבורי', en: 'Public Page' },
  'admin.settings.public_url_copied': { he: 'הקישור הועתק', en: 'Link copied' },
  'admin.settings.open_public_page': { he: 'פתח דף ציבורי', en: 'Open Public Page' },

  // ── Admin: Phase 4 — Change Password ────────────────────────────────────────
  'admin.settings.change_pw_title': { he: 'שינוי סיסמה', en: 'Change Password' },
  'admin.settings.password_min': { he: 'הסיסמה חייבת להכיל לפחות 8 תווים', en: 'Password must be at least 8 characters' },

  // ── Admin: Phase 4 — Showcase ───────────────────────────────────────────────
  'admin.showcase.title': { he: 'תמונות בדף נחיתה', en: 'Showcase Images' },
  'admin.showcase.loading': { he: 'טוען תמונות…', en: 'Loading images…' },
  'admin.showcase.error': { he: 'שגיאה בטעינה', en: 'Failed to load' },
  'admin.showcase.no_images': { he: 'אין תמונות בגלריות.', en: 'No images in any gallery.' },
  'admin.showcase.featured': { he: 'מוצג בדף הנחיתה', en: 'Shown on landing page' },
  'admin.showcase.tap_to_toggle': { he: 'לחץ להוספה / הסרה', en: 'Tap to add / remove' },
  'admin.showcase.save': { he: 'שמור רשימה', en: 'Save List' },
  'admin.showcase.save_success': { he: 'נשמר בהצלחה', en: 'Saved successfully' },
  'admin.showcase.save_error': { he: 'שגיאה בשמירה', en: 'Failed to save' },
  'admin.showcase.saving': { he: 'שומר…', en: 'Saving…' },
  'admin.showcase.back': { he: 'חזרה להגדרות', en: 'Back to Settings' },
  'admin.showcase.search_placeholder': { he: 'חיפוש לפי שם גלריה…', en: 'Filter by gallery name…' },

  // ── Admin: Phase 4 — Users (superadmin) ─────────────────────────────────────
  'admin.users.title': { he: 'ניהול משתמשים', en: 'Manage Users' },
  'admin.users.error': { he: 'שגיאה בטעינת משתמשים', en: 'Failed to load users' },
  'admin.users.no_users': { he: 'אין משתמשים.', en: 'No users.' },
  'admin.users.role_admin': { he: 'מנהל', en: 'Admin' },
  'admin.users.role_superadmin': { he: 'סופר-מנהל', en: 'Superadmin' },
  'admin.users.new': { he: 'משתמש חדש', en: 'New User' },
  'admin.users.back': { he: 'חזרה למשתמשים', en: 'Back to Users' },
  'admin.users.create': { he: 'יצירת משתמש', en: 'Create User' },
  'admin.users.create_error': { he: 'שגיאה ביצירת משתמש', en: 'Failed to create user' },
  'admin.users.username': { he: 'שם משתמש (URL)', en: 'Username (URL slug)' },
  'admin.users.studio_name': { he: 'שם הסטודיו', en: 'Studio Name' },
  'admin.users.password': { he: 'סיסמה', en: 'Password' },
  'admin.users.role': { he: 'תפקיד', en: 'Role' },
  'admin.users.role_select_admin': { he: 'מנהל רגיל', en: 'Admin' },
  'admin.users.role_select_superadmin': { he: 'סופר-מנהל', en: 'Superadmin' },
  'admin.users.delete_confirm': { he: 'האם למחוק את המשתמש?', en: 'Delete this user?' },
  'admin.users.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This cannot be undone.' },
  'admin.users.delete_error': { he: 'שגיאה במחיקה', en: 'Failed to delete user' },
  'admin.tab.users': { he: 'משתמשים', en: 'Users' },
};
