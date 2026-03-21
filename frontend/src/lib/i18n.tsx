import React, { createContext, useContext, useState, useCallback } from 'react';

type Lang = 'he' | 'en';

interface I18nContextType {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  toggleLang: () => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<Lang, string>> = {
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
  'contact.send': { he: 'שלח הודעה', en: 'Send Message' },
  'contact.success': { he: 'אחזור אלייך בהקדם 🤍', en: "I'll be in touch very soon 🤍" },
  'contact.session.family': { he: 'צילומי משפחה', en: 'Family Photography' },
  'contact.session.maternity': { he: 'צילומי הריון', en: 'Maternity Photography' },
  'contact.session.newborn': { he: 'צילומי ניו בורן', en: 'Newborn Photography' },
  'contact.session.branding': { he: 'צילומי מיתוג', en: 'Branding Photography' },
  'contact.session.landscape': { he: 'צילומי נוף', en: 'Landscape Photography' },

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
  'gallery.already_submitted': { he: 'הבחירה כבר נשלחה', en: 'Selection already submitted' },
  'gallery.already_submitted_desc': { he: 'כבר שלחת את בחירת התמונות שלך לגלריה זו.', en: 'You have already submitted your photo selection for this gallery.' },
  'gallery.max_reached': { he: 'הגעת למקסימום הבחירות', en: 'Maximum selections reached' },
  'gallery.select_of': { he: 'מתוך', en: 'of' },
  // Delivery gallery (download-only)
  'gallery.delivery_title': { he: 'התמונות המעובדות שלך', en: 'Your Edited Photos' },
  'gallery.download_all': { he: 'הורדת הכל (ZIP)', en: 'Download All (ZIP)' },
  'gallery.download_photo': { he: 'הורדה', en: 'Download' },
  'gallery.preparing_zip': { he: 'מכין ZIP…', en: 'Preparing ZIP…' },
  'gallery.video_section': { he: 'וידאו', en: 'Video' },
  'gallery.download_video': { he: 'הורדת וידאו', en: 'Download Video' },

  // Contact
  'contact.required_fields': { he: 'נא למלא את השדות החובה', en: 'Please fill in required fields' },
  'contact.error': { he: 'משהו השתבש. אנא נסה שנית.', en: 'Something went wrong. Please try again.' },
  'contact.submitting': { he: '…', en: '…' },

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
  'admin.login.email': { he: 'אימייל / שם משתמש', en: 'Email / Username' },
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
  'admin.common.delete': { he: 'מחק', en: 'Delete' },
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
  'admin.client.load_failed': { he: 'טעינת פרטי הלקוח נכשלה', en: 'Failed to load client details' },
  'admin.client.galleries_load_failed': { he: 'טעינת הגלריות נכשלה', en: 'Failed to load galleries' },

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
  'admin.upload.load_failed': { he: 'טעינת הגלריה נכשלה', en: 'Failed to load gallery' },
  'admin.upload.images_load_failed': { he: 'טעינת התמונות נכשלה', en: 'Failed to load images' },
  'admin.upload.status_update_failed': { he: 'עדכון הסטטוס נכשל', en: 'Failed to update status' },
  'admin.upload.selected': { he: 'נבחרו', en: 'selected' },
  'admin.upload.clear_selection': { he: 'נקה בחירה', en: 'Clear selection' },
  'admin.upload.delete_selected': { he: 'מחק נבחרים', en: 'Delete selected' },
  'admin.upload.delete_confirm': { he: 'מחיקת תמונות', en: 'Delete images' },
  'admin.upload.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This cannot be undone.' },
  'admin.upload.deleting': { he: 'מוחק…', en: 'Deleting…' },
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
  'admin.selections.load_failed': { he: 'טעינת הגלריות נכשלה', en: 'Failed to load galleries' },
  'admin.selections.mark_failed': { he: 'עדכון הסטטוס נכשל', en: 'Failed to update status' },

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
  'admin.blog.load_failed': { he: 'טעינת הפוסטים נכשלה', en: 'Failed to load posts' },

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

  // ── Admin: Contact Inbox ────────────────────────────────────────────────────
  'admin.contact.title': { he: 'פניות', en: 'Contact Inbox' },
  'admin.contact.no_messages': { he: 'אין פניות עדיין.', en: 'No messages yet.' },
  'admin.contact.delete_title': { he: 'מחיקת פנייה', en: 'Delete Message' },
  'admin.contact.delete_body': { he: 'פעולה זו לא ניתנת לביטול.', en: 'This action cannot be undone.' },
  'admin.contact.delete_btn': { he: 'מחק', en: 'Delete' },
  'admin.contact.deleting': { he: 'מוחק…', en: 'Deleting…' },
  'admin.contact.load_failed': { he: 'טעינת הפניות נכשלה', en: 'Failed to load messages' },
  'admin.contact.delete_failed': { he: 'מחיקת הפנייה נכשלה', en: 'Failed to delete message' },
  'admin.nav.contact': { he: 'פניות', en: 'Contact' },

  // ── Admin: Gallery in-editing action ────────────────────────────────────────
  'admin.gallery.mark_in_editing': { he: 'סמן כבעריכה', en: 'Mark as In Editing' },
  'admin.gallery.marking': { he: 'מעדכן…', en: 'Updating…' },
  'admin.gallery.upload_video': { he: 'העלה וידאו', en: 'Upload Video' },
  'admin.gallery.uploading_video': { he: 'מעלה…', en: 'Uploading…' },
  'admin.gallery.delete_video': { he: 'מחק וידאו', en: 'Delete Video' },
  'admin.gallery.video_uploaded': { he: 'הוידאו הועלה בהצלחה', en: 'Video uploaded successfully' },
  'admin.gallery.video_deleted': { he: 'הוידאו נמחק', en: 'Video deleted' },
  'admin.gallery.video_error': { he: 'שגיאה בהעלאת הוידאו', en: 'Video upload failed' },
  'admin.gallery.upload_video_multi': { he: 'ניתן לבחור מספר קבצים', en: 'select multiple files' },

  // ── Admin: Studio Profile ────────────────────────────────────────────────────
  'admin.settings.studio_profile': { he: 'פרופיל סטודיו', en: 'Studio Profile' },
  'admin.settings.display_name': { he: 'שם תצוגה', en: 'Display Name' },
  'admin.settings.studio_name': { he: 'שם סטודיו', en: 'Studio Name' },
  'admin.settings.username': { he: 'שם משתמש (כתובת URL ציבורית)', en: 'Username (public URL slug)' },
  'admin.settings.username_hint': { he: 'משמש ככתובת הדף הציבורי שלך', en: 'Used as your public page URL' },
  'admin.settings.profile_saved': { he: 'הפרופיל עודכן בהצלחה', en: 'Profile updated successfully' },
  'admin.settings.profile_failed': { he: 'עדכון הפרופיל נכשל', en: 'Failed to update profile' },
  'admin.settings.save_profile': { he: 'שמור פרופיל', en: 'Save Profile' },

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

  // ── Admin: Product Orders ───────────────────────────────────────────────────
  'admin.products.title': { he: 'מוצרים / הזמנות', en: 'Products / Orders' },
  'admin.products.add': { he: '+ הוסף מוצר', en: '+ Add Product' },
  'admin.products.no_orders': { he: 'אין מוצרים מוקצים עדיין.', en: 'No products assigned yet.' },
  'admin.products.type_album': { he: 'אלבום', en: 'Album' },
  'admin.products.type_print': { he: 'תמונת קנבס / הדפסה גדולה', en: 'Large Print / Canvas' },
  'admin.products.name_label': { he: 'שם המוצר', en: 'Product name' },
  'admin.products.name_ph': { he: 'למשל: אלבום חתונה 30×30', en: 'e.g. Wedding Album 30×30' },
  'admin.products.type_label': { he: 'סוג', en: 'Type' },
  'admin.products.max_photos': { he: 'מקסימום תמונות', en: 'Max photos' },
  'admin.products.galleries_label': { he: 'גלריות מורשות', en: 'Allowed galleries' },
  'admin.products.no_galleries': { he: 'לא נמצאו גלריות ללקוח זה.', en: 'No galleries found for this client.' },
  'admin.products.create': { he: 'יצירת מוצר', en: 'Create product' },
  'admin.products.creating': { he: 'יוצר…', en: 'Creating…' },
  'admin.products.delete': { he: 'מחק', en: 'Delete' },
  'admin.products.status_pending': { he: 'ממתין לבחירה', en: 'Pending selection' },
  'admin.products.status_submitted': { he: 'בחירה הוגשה', en: 'Selection submitted' },
  'admin.products.photos_chosen': { he: 'תמונות נבחרו', en: 'photos chosen' },
  'admin.products.delivery_badge': { he: 'מסירה', en: 'Delivery' },
  // ── Client: Product Orders ──────────────────────────────────────────────────
  'products.section_title': { he: 'המוצרים שלך', en: 'Your Products' },
  'products.album': { he: 'אלבום', en: 'Album' },
  'products.print': { he: 'הדפסה', en: 'Print' },
  'products.pick_photos': { he: 'בחרי תמונות', en: 'Pick photos' },
  'products.pick_from': { he: 'בחרי מתוך', en: 'Pick from' },
  'products.submitted': { he: 'בחירה הוגשה', en: 'Selection submitted' },
  'products.submit': { he: 'שלחי בחירה', en: 'Submit selection' },
  'products.submitting': { he: 'שולח…', en: 'Submitting…' },
  'products.selected_of': { he: 'מתוך', en: 'of' },
  'products.max_reached': { he: 'הגעת למקסימום', en: 'Maximum reached' },
  'products.choose_gallery': { he: 'בחרי גלריה להצגה', en: 'Choose a gallery to browse' },
  'products.no_images': { he: 'אין תמונות בגלריה זו.', en: 'No images in this gallery.' },
  'products.loading': { he: 'טוען…', en: 'Loading…' },
  'products.max_label': { he: 'תמונות לבחירה', en: 'photos to select' },

  // ── Admin: Common (additions) ────────────────────────────────────────────────
  'admin.common.uploading': { he: 'מעלה...', en: 'Uploading...' },

  // ── Admin: Settings — Landing Page ──────────────────────────────────────────
  'admin.settings.landing_title': { he: 'התאמת דף הנחיתה', en: 'Landing Page Customization' },
  'admin.settings.hero_image': { he: 'תמונת רקע (Hero)', en: 'Hero Background Image' },
  'admin.settings.hero_image_upload': { he: 'העלה תמונת רקע', en: 'Upload Hero Image' },
  'admin.settings.hero_image_replace': { he: 'החלף תמונת רקע', en: 'Replace Hero Image' },
  'admin.settings.profile_image': { he: 'תמונת פרופיל (סקציית About)', en: 'Profile Photo (About section)' },
  'admin.settings.profile_image_upload': { he: 'העלה תמונת פרופיל', en: 'Upload Profile Photo' },
  'admin.settings.profile_image_replace': { he: 'החלף תמונת פרופיל', en: 'Replace Profile Photo' },
  'admin.settings.hero_subtitle': { he: 'תת-כותרת Hero', en: 'Hero Subtitle' },
  'admin.settings.bio': { he: 'ביוגרפיה (About Me)', en: 'Biography (About Me)' },
  'admin.settings.bio_placeholder': { he: 'ספר/י על עצמך, על הסגנון שלך...', en: 'Tell us about yourself, your style...' },
  'admin.settings.contact_email': { he: 'אימייל ליצירת קשר', en: 'Contact Email' },
  'admin.settings.instagram': { he: 'אינסטגרם', en: 'Instagram' },
  'admin.settings.facebook': { he: 'פייסבוק', en: 'Facebook' },
  'admin.settings.landing_saved': { he: 'נשמר בהצלחה!', en: 'Saved successfully!' },
  'admin.settings.landing_failed': { he: 'שמירה נכשלה.', en: 'Save failed.' },
  'admin.settings.save_landing': { he: 'שמור דף נחיתה', en: 'Save Public Page' },
  'admin.settings.theme_title': { he: 'ערכת עיצוב לדף הציבורי', en: 'Public Page Theme' },
  'admin.settings.theme_label': { he: 'בחר ערכת עיצוב', en: 'Select a theme' },
  'theme.soft': { he: 'עדין', en: 'Soft' },
  'theme.luxury': { he: 'יוקרה', en: 'Luxury' },
  'theme.bold': { he: 'נועז', en: 'Bold' },
  'theme.minimal': { he: 'מינימליסטי', en: 'Minimal' },
  'theme.warm': { he: 'חמים', en: 'Warm' },
  'theme.soft.desc': { he: 'פסטל, אוורירי, עדין', en: 'Pastel, airy, delicate' },
  'theme.luxury.desc': { he: 'כהה, זהב, אלגנטי', en: 'Dark, gold, elegant' },
  'theme.bold.desc': { he: 'ניגוד חזק, מודרני', en: 'High contrast, modern' },
  'theme.minimal.desc': { he: 'נקי, שחור-לבן, מרווח', en: 'Clean, B&W, spacious' },
  'theme.warm.desc': { he: 'גוונים חמים, ארצי', en: 'Earthy tones, warm' },
  'theme.ocean': { he: 'אוקיינוס', en: 'Ocean' },
  'theme.forest': { he: 'יער', en: 'Forest' },
  'theme.rose': { he: 'ורד', en: 'Rose' },
  'theme.vintage': { he: "וינטאג'", en: 'Vintage' },
  'theme.midnight': { he: 'חצות', en: 'Midnight' },
  'theme.ocean.desc': { he: 'כחול, שקט, ימי', en: 'Blue, calm, coastal' },
  'theme.forest.desc': { he: 'ירוק, טבעי, אורגני', en: 'Green, natural, organic' },
  'theme.rose.desc': { he: 'ורדרד, רומנטי, עדין', en: 'Rosy, romantic, soft' },
  'theme.vintage.desc': { he: 'נוסטלגי, סיפיה, רטרו', en: 'Nostalgic, sepia, retro' },
  'theme.midnight.desc': { he: 'כחול עמוק, לילי, מסתורי', en: 'Deep blue, night, mysterious' },
  'theme.bw': { he: 'שחור-לבן', en: 'Black & White' },
  'theme.bw.desc': { he: 'נקי, קלאסי, ניגודיות גבוהה', en: 'Clean, classic, high contrast' },
  'admin.settings.public_page_title': { he: 'הדף הציבורי שלך', en: 'Your Public Page' },
  'admin.settings.public_page_label': { he: 'כתובת הדף הציבורי שלך:', en: 'Your public page URL:' },
  'admin.settings.load_failed': { he: 'טעינת ההגדרות נכשלה', en: 'Failed to load settings' },
  'admin.settings.hero_upload_failed': { he: 'העלאת תמונת הרקע נכשלה', en: 'Failed to upload hero image' },
  'admin.settings.profile_upload_failed': { he: 'העלאת תמונת הפרופיל נכשלה', en: 'Failed to upload profile image' },

  // ── Admin: Dashboard (addition) ──────────────────────────────────────────────
  'admin.dashboard.view_landing': { he: 'צפה בדף הנחיתה שלך', en: 'View Your Landing Page' },

  // ── Admin: Dashboard — redesigned sections ───────────────────────────────────
  'admin.dashboard.stat_clients_sub': { he: 'סה״כ לקוחות', en: 'Total clients' },
  'admin.dashboard.stat_galleries_sub': { he: 'גלריות פעילות', en: 'Active galleries' },
  'admin.dashboard.stat_pending_sub': { he: 'ממתין לאישור', en: 'Awaiting review' },
  'admin.dashboard.panel_title': { he: 'לקוחות וגלריות', en: 'Clients & Galleries' },
  'admin.dashboard.export': { he: 'ייצוא', en: 'Export' },
  'admin.dashboard.filter_all': { he: 'הכל', en: 'All' },
  'admin.dashboard.filter_active': { he: 'פעיל', en: 'Active' },
  'admin.dashboard.filter_pending': { he: 'ממתין', en: 'Pending' },
  'admin.dashboard.filter_delivered': { he: 'נמסר', en: 'Delivered' },
  'admin.dashboard.add_gallery': { he: '+ הוסף גלריה', en: '+ Add Gallery' },
  'admin.dashboard.no_galleries_client': { he: 'אין גלריות עדיין.', en: 'No galleries yet.' },
  'admin.dashboard.badge_pending': { he: 'ממתין', en: 'Pending' },
  'admin.dashboard.badge_active': { he: 'פעיל', en: 'Active' },
  'admin.dashboard.badge_delivered': { he: 'נמסר', en: 'Delivered' },
  'admin.dashboard.activity_title': { he: 'פעילות', en: 'Activity' },
  'admin.dashboard.no_activity': { he: 'אין פעילות אחרונה.', en: 'No recent activity.' },
  'admin.dashboard.activity_new_client': { he: 'לקוח חדש נוסף', en: 'New client added' },
  'admin.dashboard.time_just_now': { he: 'עכשיו', en: 'Just now' },
  'admin.dashboard.time_minutes_ago': { he: 'לפני {n} דקות', en: '{n} min ago' },
  'admin.dashboard.time_hours_ago': { he: 'לפני {n} שעות', en: '{n} hr ago' },
  'admin.dashboard.time_days_ago': { he: 'לפני {n} ימים', en: '{n} days ago' },
  'admin.dashboard.quick_add_title': { he: 'הוספת לקוח מהירה', en: 'Quick Add Client' },
  'admin.dashboard.client_name_ph': { he: 'שם הלקוח', en: 'Client name' },
  'admin.dashboard.create_client_btn': { he: 'יצירת לקוח', en: 'Create Client' },
  'admin.dashboard.creating_client': { he: 'יוצר…', en: 'Creating…' },
  'admin.dashboard.client_created_title': { he: 'הלקוח נוצר', en: 'Client created' },
  'admin.dashboard.client_created_desc': { he: '{name} נוסף בהצלחה.', en: '{name} was added successfully.' },
  'admin.dashboard.client_create_error': { he: 'יצירת הלקוח נכשלה.', en: 'Failed to create client.' },
  'admin.dashboard.client_singular': { he: 'לקוח', en: 'client' },
  'admin.dashboard.client_plural': { he: 'לקוחות', en: 'clients' },
  'admin.dashboard.gallery_singular': { he: 'גלריה', en: 'gallery' },
  'admin.dashboard.gallery_plural': { he: 'גלריות', en: 'galleries' },

  // ── Admin: Session type labels ────────────────────────────────────────────────
  'admin.session.family': { he: 'משפחה', en: 'Family' },
  'admin.session.maternity': { he: 'הריון', en: 'Maternity' },
  'admin.session.newborn': { he: 'ניו בורן', en: 'Newborn' },
  'admin.session.branding': { he: 'מיתוג', en: 'Branding' },
  'admin.session.landscape': { he: 'נוף', en: 'Landscape' },

  // ── Admin: Users ──────────────────────────────────────────────────────────────
  'admin.users.title': { he: 'ניהול משתמשים', en: 'User Management' },
  'admin.users.existing': { he: 'משתמשים קיימים', en: 'Existing Users' },
  'admin.users.you': { he: 'אתה', en: 'You' },
  'admin.users.superadmin_label': { he: 'Super Admin', en: 'Super Admin' },
  'admin.users.admin_label': { he: 'Admin', en: 'Admin' },
  'admin.users.view_landing': { he: 'צפה בדף נחיתה', en: 'View landing page' },
  'admin.users.edit': { he: 'ערוך', en: 'Edit' },
  'admin.users.delete_confirm': { he: 'למחוק את האדמין הזה?', en: 'Delete this admin?' },
  'admin.users.created': { he: 'Admin נוצר בהצלחה', en: 'Admin created successfully' },
  'admin.users.create_error': { he: 'שגיאה ביצירה', en: 'Error creating admin' },
  'admin.users.delete_error': { he: 'שגיאה במחיקה', en: 'Error deleting admin' },
  'admin.users.profile_saved': { he: 'פרופיל נשמר', en: 'Profile saved' },
  'admin.users.landing_saved': { he: 'דף נחיתה נשמר', en: 'Landing page saved' },
  'admin.users.image_uploaded': { he: 'תמונה הועלתה', en: 'Image uploaded' },
  'admin.users.save_error': { he: 'שגיאה בשמירה', en: 'Error saving' },
  'admin.users.load_failed': { he: 'טעינת המשתמשים נכשלה', en: 'Failed to load users' },
  'admin.users.upload_error': { he: 'שגיאה בהעלאה', en: 'Error uploading' },
  'admin.users.section_profile': { he: 'פרופיל', en: 'Profile' },
  'admin.users.section_landing': { he: 'דף נחיתה', en: 'Landing Page' },
  'admin.users.section_images': { he: 'תמונות', en: 'Images' },
  'admin.users.save_profile': { he: 'שמור פרופיל', en: 'Save Profile' },
  'admin.users.save_landing': { he: 'שמור דף נחיתה', en: 'Save Landing Page' },
  'admin.users.replace_image': { he: 'החלף תמונה', en: 'Replace image' },
  'admin.users.upload_image': { he: 'העלה תמונה', en: 'Upload image' },
  'admin.users.add_new': { he: 'הוסף משתמש חדש', en: 'Add New User' },
  'admin.users.password': { he: 'סיסמה', en: 'Password' },
  'admin.users.password_hint': { he: 'לפחות 8 תווים', en: 'At least 8 characters' },
  'admin.users.role': { he: 'תפקיד', en: 'Role' },
  'admin.users.username_url': { he: 'שם משתמש (URL)', en: 'Username (URL)' },
  'admin.users.username_hint': { he: 'רק אנגלית, מספרים וקו תחתון', en: 'Letters, numbers & underscore only' },
  'admin.users.create': { he: 'צור משתמש', en: 'Create User' },
  'admin.users.creating': { he: 'יוצר...', en: 'Creating...' },
  'admin.users.no_users': { he: 'אין משתמשים', en: 'No users' },
  'admin.users.hero_image_label': { he: 'תמונת רקע (Hero)', en: 'Hero Background Image' },
  'admin.users.profile_image_label': { he: 'תמונת פרופיל', en: 'Profile Photo' },

  // ── 404 Page ──────────────────────────────────────────────────────────────────
  'notfound.title': { he: 'הדף לא נמצא', en: 'Page Not Found' },
  'notfound.body': {
    he: 'הכתובת שחיפשת אינה קיימת או שהוסרה.',
    en: 'The page you were looking for does not exist or has been removed.',
  },
  'notfound.cta': { he: 'כניסה לניהול', en: 'Admin Login' },

  // ── Admin: Status labels ────────────────────────────────────────────────────
  'admin.status.gallery_sent': { he: 'גלריה נשלחה', en: 'Gallery Sent' },
  'admin.status.viewed': { he: 'נצפה', en: 'Viewed' },
  'admin.status.selection_submitted': { he: 'בחירה הוגשה', en: 'Selection Submitted' },
  'admin.status.in_editing': { he: 'בעריכה', en: 'In Editing' },
  'admin.status.delivered': { he: 'נמסר', en: 'Delivered' },
};

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('he');
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'he' ? 'en' : 'he'));
  }, []);

  const t = useCallback((key: string) => translations[key]?.[lang] || key, [lang]);

  return (
    <I18nContext.Provider value={{ lang, dir, toggleLang, t }}>
      <div dir={dir} lang={lang}>
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
