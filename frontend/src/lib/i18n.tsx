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
  'gallery.already_submitted_desc': {
    he: 'כבר שלחת את בחירת התמונות שלך לגלריה זו.',
    en: 'You have already submitted your photo selection for this gallery.',
  },
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
  'admin.common.save': { he: 'שמור', en: 'Save' },
  'admin.common.cancel': { he: 'ביטול', en: 'Cancel' },
  'admin.common.delete': { he: 'מחק', en: 'Delete' },
  'admin.common.error': { he: 'אירעה שגיאה', en: 'Something went wrong' },
  'admin.common.action_irreversible': { he: 'פעולה זו אינה ניתנת לביטול.', en: 'This action cannot be undone.' },
  'admin.common.name': { he: 'שם', en: 'Name' },
  'admin.common.phone': { he: 'טלפון', en: 'Phone' },
  'admin.common.no_phone': { he: 'אין מספר טלפון ללקוח', en: 'Client has no phone number' },
  'admin.common.no_email': { he: 'אין כתובת אימייל ללקוח', en: 'Client has no email address' },
  'admin.common.email': { he: 'אימייל', en: 'Email' },
  'admin.common.notes': { he: 'הערות', en: 'Notes' },
  'admin.common.status': { he: 'סטטוס', en: 'Status' },
  'admin.common.session_type': { he: 'סוג צילום', en: 'Session Type' },
  'admin.common.back_clients': { he: 'חזרה ללקוחות', en: 'Back to clients' },
  'admin.common.back_client': { he: 'חזרה ללקוח', en: 'Back to client' },
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
  'admin.client.new_gallery': { he: 'גלריה חדשה', en: 'New gallery' },
  'admin.client.no_galleries': { he: 'אין גלריות מקושרות.', en: 'No galleries linked.' },
  'admin.client.copy_link': { he: 'העתק קישור', en: 'Copy link' },
  'admin.client.link_copied': { he: 'הקישור הועתק!', en: 'Link copied!' },
  'admin.client.delivery_suffix': { he: 'ערוך', en: 'Edited' },
  'admin.client.create_delivery': { he: 'צור גלריית מסירה', en: 'Create Delivery Gallery' },
  'admin.gallery.reactivate': { he: 'פתח מחדש לבחירה', en: 'Reopen for Selection' },
  'admin.gallery.reactivating': { he: 'פותח...', en: 'Reopening...' },
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
  'admin.galleries.email_sent_success': { he: 'המייל נשלח בהצלחה ל{name}', en: 'Email sent successfully to {name}' },
  'admin.galleries.email_sent_error': { he: 'שגיאה בשליחת המייל ל{name}', en: 'Failed to send email to {name}' },
  'admin.galleries.whatsapp_send': { he: 'שלח בוואטסאפ', en: 'Send via WhatsApp' },
  'admin.galleries.send_sms': { he: 'שלח SMS', en: 'Send SMS' },
  'admin.galleries.sms_sent_success': { he: 'SMS נשלח בהצלחה ל{name}', en: 'SMS sent successfully to {name}' },
  'admin.galleries.sms_sent_error': { he: 'שגיאה בשליחת SMS ל{name}', en: 'Failed to send SMS to {name}' },
  'admin.galleries.email_subject': { he: 'הגלריה שלך מוכנה, {name}', en: 'Your gallery is ready, {name}' },
  'admin.galleries.whatsapp_msg': {
    he: 'שלום {name}, הגלריה שלך מוכנה לצפייה 🤍\n{url}',
    en: 'Hi {name}, your gallery is ready to view 🤍\n{url}',
  },

  // ── Admin: Gallery Upload ───────────────────────────────────────────────────
  'admin.upload.images': { he: 'תמונות', en: 'images' },
  'admin.upload.drag': { he: 'גרור ושחרר תמונות כאן', en: 'Drag & drop images here' },
  'admin.upload.browse': {
    he: 'או לחץ לעיון — עד 5000 תמונות, 40MB לכל תמונה',
    en: 'or click to browse — up to 5000 images, 40MB each',
  },
  'admin.upload.error': { he: 'שגיאה', en: 'Error' },
  'admin.upload.done': { he: 'הושלם', en: 'Done' },
  'admin.upload.cancel': { he: 'בטל העלאה', en: 'Cancel upload' },
  'admin.upload.cancelled': { he: 'בוטל', en: 'Cancelled' },
  'admin.upload.no_images': { he: 'טרם הועלו תמונות.', en: 'No images uploaded yet.' },
  'admin.upload.load_failed': { he: 'טעינת הגלריה נכשלה', en: 'Failed to load gallery' },
  'admin.upload.images_load_failed': { he: 'טעינת התמונות נכשלה', en: 'Failed to load images' },
  'admin.upload.status_update_failed': { he: 'עדכון הסטטוס נכשל', en: 'Failed to update status' },
  'admin.upload.file_too_large': { he: 'הקובץ "{{name}}" גדול מדי (מקסימום 40MB)', en: 'File "{{name}}" exceeds the 40MB limit' },
  'admin.upload.invalid_type': { he: 'הקובץ "{{name}}" אינו תמונה נתמכת', en: 'File "{{name}}" is not a supported image type' },
  'admin.upload.drop_images_label': {
    he: 'גרור ושחרר תמונות כאן, או לחץ לבחירה',
    en: 'Drag and drop images here, or press to browse',
  },
  'admin.upload.selected': { he: 'נבחרו', en: 'selected' },
  'admin.upload.select_all': { he: 'בחר הכל', en: 'Select all' },
  'admin.upload.deselect_all': { he: 'בטל בחירת הכל', en: 'Deselect all' },
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
  'admin.blog.save_failed': { he: 'שמירת הפוסט נכשלה', en: 'Failed to save post' },

  // ── Admin: Showcase ─────────────────────────────────────────────────────────
  'admin.showcase.title': { he: 'תמונות ראווה', en: 'Showcase Images' },
  'admin.showcase.search_label': { he: 'חיפוש לפי שם לקוח, אימייל או שם גלריה', en: 'Search by client name, email, or gallery name' },
  'admin.showcase.search_placeholder': { he: 'חפש…', en: 'Search…' },
  'admin.showcase.no_galleries': { he: 'לא נמצאו גלריות', en: 'No galleries found' },
  'admin.showcase.select_images': { he: 'בחר תמונות', en: 'Select images' },
  'admin.showcase.no_images': { he: 'אין תמונות בגלריה זו', en: 'No images in this gallery' },
  'admin.showcase.selected_title': { he: 'תמונות שנבחרו לדף הבית', en: 'Selected for homepage' },
  'admin.showcase.no_featured': { he: 'טרם נבחרו תמונות', en: 'No images selected yet' },
  'admin.showcase.save': { he: 'שמור', en: 'Save' },
  'admin.showcase.saved': { he: 'נשמר בהצלחה', en: 'Saved successfully' },
  'admin.showcase.load_error': { he: 'שגיאה בטעינת הנתונים', en: 'Failed to load data' },
  'admin.showcase.save_error': { he: 'שגיאה בשמירה', en: 'Failed to save' },

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
  'admin.gallery.tab_images': { he: 'תמונות', en: 'Images' },
  'admin.gallery.tab_videos': { he: 'וידאו', en: 'Videos' },
  'admin.gallery.upload_video': { he: 'העלה וידאו', en: 'Upload Video' },
  'admin.gallery.uploading_video': { he: 'מעלה…', en: 'Uploading…' },
  'admin.gallery.delete_video': { he: 'מחק וידאו', en: 'Delete Video' },
  'admin.gallery.video_uploaded': { he: 'הוידאו הועלה בהצלחה', en: 'Video uploaded successfully' },
  'admin.gallery.video_deleted': { he: 'הוידאו נמחק', en: 'Video deleted' },
  'admin.gallery.video_error': { he: 'שגיאה בהעלאת הוידאו', en: 'Video upload failed' },
  'admin.gallery.video_cancelled': { he: 'ההעלאה בוטלה', en: 'Upload cancelled' },
  'admin.gallery.cancel_upload': { he: 'בטל העלאה', en: 'Cancel' },
  'admin.gallery.upload_video_multi': { he: 'ניתן לבחור מספר קבצים', en: 'select multiple files' },
  'admin.gallery.video_too_large': { he: 'הקובץ "{{name}}" גדול מדי (מקסימום 2GB)', en: 'File "{{name}}" exceeds the 2GB limit' },
  'admin.gallery.video_invalid_type': {
    he: 'הקובץ "{{name}}" אינו קובץ וידאו נתמך',
    en: 'File "{{name}}" is not a supported video type',
  },
  'admin.gallery.drop_video_label': { he: 'גרור ושחרר וידאו כאן, או לחץ לבחירה', en: 'Drag and drop video here, or press to browse' },

  // ── Admin: Studio Profile ────────────────────────────────────────────────────
  'admin.settings.studio_profile': { he: 'פרופיל סטודיו', en: 'Studio Profile' },
  'admin.settings.display_name': { he: 'שם תצוגה', en: 'Display Name' },
  'admin.settings.studio_name': { he: 'שם סטודיו', en: 'Studio Name' },
  'admin.settings.logo_image': { he: 'לוגו (מחליף את שם הסטודיו בניווט)', en: 'Logo (replaces studio name in navbar)' },
  'admin.settings.logo_upload': { he: 'העלה לוגו', en: 'Upload Logo' },
  'admin.settings.logo_replace': { he: 'החלף לוגו', en: 'Replace Logo' },
  'admin.settings.logo_remove': { he: 'הסר לוגו', en: 'Remove Logo' },
  'admin.settings.logo_upload_failed': { he: 'העלאת הלוגו נכשלה', en: 'Logo upload failed' },
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
  'admin.settings.notifications': { he: 'הגדרות התראות', en: 'Notification Settings' },
  'admin.settings.auto_send_email': { he: 'שליחת מייל אוטומטית בעת יצירת גלריה', en: 'Auto-send email when gallery is created' },
  'admin.settings.auto_send_email_desc': {
    he: 'כאשר מופעל, מייל נשלח אוטומטית ללקוח עם קישור לגלריה עם יצירת גלריה חדשה.',
    en: 'When enabled, an email is automatically sent to the client with their gallery link upon gallery creation.',
  },
  'admin.settings.auto_send_sms': { he: 'שליחת SMS אוטומטית בעת יצירת גלריה', en: 'Auto-send SMS when gallery is created' },
  'admin.settings.auto_send_sms_desc': {
    he: 'כאשר מופעל, SMS נשלח אוטומטית ללקוח עם קישור לגלריה.',
    en: 'When enabled, an SMS is automatically sent to the client with their gallery link. Requires Twilio credentials.',
  },

  // ── Admin: Product Orders ───────────────────────────────────────────────────
  'admin.products.title': { he: 'מוצרים / הזמנות', en: 'Products / Orders' },
  'admin.products.add': { he: 'הוסף מוצר', en: 'Add Product' },
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

  // Product catalog (settings page)
  'admin.products.catalog_title': { he: 'קטלוג מוצרים', en: 'Product Catalog' },
  'admin.products.catalog_subtitle': {
    he: 'המוצרים שיהיו זמינים בעת יצירת הזמנה ללקוח',
    en: 'Products available when creating an order for a client',
  },
  'admin.products.catalog_add': { he: 'מוצר חדש', en: 'New product' },
  'admin.products.catalog_empty': { he: 'אין מוצרים בקטלוג עדיין.', en: 'No products in catalog yet.' },
  'admin.products.catalog_save': { he: 'הוסף לקטלוג', en: 'Add to catalog' },
  'admin.products.catalog_pick': { he: 'בחר מוצר מהקטלוג…', en: 'Pick from catalog…' },
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
  'products.no_products_title': { he: 'אין מוצרים עדיין', en: 'No products yet' },
  'products.no_products_desc': {
    he: 'הצלמ/ת שלך טרם הגדיר/ה מוצרים עבורך.',
    en: "Your photographer hasn't set up any products for you yet.",
  },

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

  // ── Admin: Settings — tabs & new sections ───────────────────────────────────
  'admin.settings.tab.identity': { he: 'פרופיל הסטודיו', en: 'Studio Identity' },
  'admin.settings.tab.hero': { he: 'Hero', en: 'Hero' },
  'admin.settings.tab.about': { he: 'אודות', en: 'About' },
  'admin.settings.tab.sections': { he: 'אזורים', en: 'Sections' },
  'admin.settings.tab.system': { he: 'מערכת', en: 'System' },
  'admin.settings.hero_overlay': { he: 'כיסוי תמונה', en: 'Hero Overlay' },
  'admin.settings.hero_overlay.light': { he: 'בהיר', en: 'Light' },
  'admin.settings.hero_overlay.medium': { he: 'בינוני', en: 'Medium' },
  'admin.settings.hero_overlay.dark': { he: 'כהה', en: 'Dark' },
  'admin.settings.hero_cta_primary': { he: 'טקסט כפתור ראשי', en: 'Primary Button Label' },
  'admin.settings.hero_cta_secondary': { he: 'טקסט כפתור משני', en: 'Secondary Button Label' },
  'admin.settings.about_section_title': { he: 'כותרת אזור אודות', en: 'About Section Title' },
  'admin.settings.tiktok': { he: 'TikTok URL', en: 'TikTok URL' },
  'admin.settings.save_hero': { he: 'שמור הגדרות Hero', en: 'Save Hero Settings' },
  'admin.settings.save_about': { he: 'שמור הגדרות אודות', en: 'Save About Settings' },
  'admin.settings.sections.services': { he: 'שירותים', en: 'Services' },
  'admin.settings.sections.testimonials': { he: 'המלצות', en: 'Testimonials' },
  'admin.settings.sections.packages': { he: 'חבילות', en: 'Packages' },
  'admin.settings.sections.video': { he: 'סרטון', en: 'Video Reel' },
  'admin.settings.sections.cta_banner': { he: 'באנר קריאה לפעולה', en: 'CTA Banner' },
  'admin.settings.sections.enabled': { he: 'הצג בדף ציבורי', en: 'Show on public page' },
  'admin.settings.sections.add_service': { he: 'הוסף שירות', en: 'Add Service' },
  'admin.settings.sections.add_testimonial': { he: 'הוסף המלצה', en: 'Add Testimonial' },
  'admin.settings.sections.add_package': { he: 'הוסף חבילה', en: 'Add Package' },
  'admin.settings.sections.icon': { he: 'אייקון', en: 'Icon' },
  'admin.settings.sections.title': { he: 'כותרת', en: 'Title' },
  'admin.settings.sections.description': { he: 'תיאור', en: 'Description' },
  'admin.settings.sections.starting_price': { he: 'מחיר מינימום (אופציונלי)', en: 'Starting Price (optional)' },
  'admin.settings.sections.client_name': { he: 'שם לקוח', en: 'Client Name' },
  'admin.settings.sections.session_type': { he: 'סוג צילום', en: 'Session Type' },
  'admin.settings.sections.rating': { he: 'דירוג (אופציונלי)', en: 'Rating (optional)' },
  'admin.settings.sections.package_name': { he: 'שם חבילה', en: 'Package Name' },
  'admin.settings.sections.price': { he: 'מחיר', en: 'Price' },
  'admin.settings.sections.inclusions': { he: 'כולל (שורה אחת לפריט)', en: 'Inclusions (one per line)' },
  'admin.settings.sections.highlight': { he: 'סמן כפופולרי', en: 'Mark as Popular' },
  'admin.settings.sections.cta_label': { he: 'טקסט כפתור (אופציונלי)', en: 'Button Label (optional)' },
  'admin.settings.sections.disclaimer': { he: 'הערת מחיר (אופציונלי)', en: 'Pricing Disclaimer (optional)' },
  'admin.settings.sections.video_url': { he: 'קישור YouTube או Vimeo', en: 'YouTube or Vimeo URL' },
  'admin.settings.sections.section_heading': { he: 'כותרת אזור', en: 'Section Heading' },
  'admin.settings.sections.section_subheading': { he: 'תת-כותרת', en: 'Section Subheading' },
  'admin.settings.sections.banner_heading': { he: 'כותרת באנר', en: 'Banner Heading' },
  'admin.settings.sections.banner_subtext': { he: 'טקסט באנר', en: 'Banner Subtext' },
  'admin.settings.sections.banner_button': { he: 'טקסט כפתור', en: 'Banner Button Label' },
  'admin.settings.sections.save_services': { he: 'שמור שירותים', en: 'Save Services' },
  'admin.settings.sections.save_testimonials': { he: 'שמור המלצות', en: 'Save Testimonials' },
  'admin.settings.sections.save_packages': { he: 'שמור חבילות', en: 'Save Packages' },
  'admin.settings.sections.save_video': { he: 'שמור סרטון', en: 'Save Video' },
  'admin.settings.sections.save_cta': { he: 'שמור באנר', en: 'Save Banner' },
  'admin.settings.sections.instagram_feed': { he: 'פיד אינסטגרם', en: 'Instagram Feed' },
  'admin.settings.sections.save_instagram_feed': { he: 'שמור פיד', en: 'Save Instagram Feed' },
  'admin.settings.sections.add_instagram_image': { he: 'הוסף תמונה', en: 'Add Photo' },
  'admin.settings.sections.instagram_feed_max': {
    he: 'עד 9 תמונות. רחף מעל תמונה להסרתה.',
    en: 'Up to 9 photos. Hover a photo to remove it.',
  },

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
  'admin.dashboard.add_gallery': { he: 'הוסף גלריה', en: 'Add Gallery' },
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
  'admin.dashboard.quick_add_title': { he: 'הוספת לקוח', en: 'Quick Add Client' },
  'admin.dashboard.search_placeholder': { he: 'חיפוש לקוחות, גלריות...', en: 'Search clients, galleries...' },
  'admin.dashboard.new_client_btn': { he: 'לקוח חדש', en: 'New Client' },
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
  'admin.users.search_placeholder': { he: 'חיפוש משתמשים...', en: 'Search users...' },
  'admin.users.password_hint_full': { he: 'לפחות 8 תווים, אות ומספר אחד', en: 'At least 8 characters, one letter and one number' },
  'admin.users.landing_hero_subtitle': { he: 'כותרת משנה (hero)', en: 'Hero subtitle' },
  'admin.users.landing_bio': { he: 'ביו', en: 'Bio' },
  'admin.users.landing_phone': { he: 'טלפון', en: 'Phone' },
  'admin.users.landing_contact_email': { he: 'אימייל ליצירת קשר', en: 'Contact email' },
  'admin.sidebar.main_section': { he: 'ראשי', en: 'Main' },
  'admin.common.full_name_ph': { he: 'שם מלא', en: 'Full name' },
  'admin.users.replace_image': { he: 'החלף תמונה', en: 'Replace image' },
  'admin.users.upload_image': { he: 'העלה תמונה', en: 'Upload image' },
  'admin.users.add_new': { he: 'הוסף משתמש חדש', en: 'Add New User' },
  'admin.users.password': { he: 'סיסמה', en: 'Password' },
  'admin.users.password_hint': { he: 'לפחות 8 תווים', en: 'At least 8 characters' },
  'admin.users.new_password': { he: 'סיסמה חדשה', en: 'New Password' },
  'admin.users.password_unchanged': { he: 'השאר ריק לאי-שינוי', en: 'Leave blank to keep unchanged' },
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

  // ── Landing Page (SaaS Marketing Page) ─────────────────────────────────────
  // Nav
  'landing.nav.features': { he: 'יכולות', en: 'Features' },
  'landing.nav.how_it_works': { he: 'איך זה עובד', en: 'How It Works' },
  'landing.nav.galleries': { he: 'גלריות', en: 'Galleries' },
  'landing.nav.products': { he: 'מוצרים', en: 'Products' },
  'landing.nav.login': { he: 'כניסה', en: 'Log in' },
  'landing.nav.get_started': { he: 'להתחלה', en: 'Get Started' },

  // Hero
  'landing.hero.badge': { he: 'הכלי שצלמים ישראלים חיכו לו', en: 'Photography studio management — simplified' },
  'landing.hero.h1_line1': { he: 'ניהול גלריות', en: 'Gallery management' },
  'landing.hero.h1_mid': { he: 'שהפך ל', en: 'made' },
  'landing.hero.h1_accent': { he: 'ביופי', en: 'beautifully' },
  'landing.hero.h1_post': { he: 'פשוט', en: 'simple' },
  'landing.hero.subtitle': {
    he: 'מעלים גלריות, שולחים קישורים פרטיים ללקוחות, עוקבים אחרי בחירות בזמן אמת ומוכרים מוצרים — הכל ממקום אחד, בלי בלגן.',
    en: 'Upload galleries, share private client links, track selections in real time, and sell prints — all without leaving your dashboard.',
  },
  'landing.hero.cta_trial': { he: 'התחילו בחינם', en: 'Start Free Trial' },
  'landing.hero.cta_how': { he: 'ראו איך זה עובד', en: 'See How It Works' },

  // Browser mockup demo labels
  'landing.mockup.client': { he: 'שרה ודוד', en: 'Sarah & David' },
  'landing.mockup.session': { he: 'חתונה · יוני 2026', en: 'Wedding · Jun 2026' },
  'landing.mockup.total': { he: 'סה"כ תמונות', en: 'Total photos' },
  'landing.mockup.selected': { he: 'נבחרו', en: 'Selected' },
  'landing.mockup.status': { he: 'סטטוס', en: 'Status' },
  'landing.mockup.in_editing': { he: 'בעריכה', en: 'In Editing' },
  'landing.mockup.progress_label': { he: 'התקדמות בחירה', en: 'Selection Progress' },
  'landing.mockup.progress_count': { he: '23 / 34 נדרשות', en: '23 / 34 needed' },

  // Stats bar
  'landing.stats.galleries': { he: 'גלריות שנמסרו', en: 'galleries delivered' },
  'landing.stats.satisfaction': { he: 'שביעות רצון', en: 'client satisfaction' },
  'landing.stats.rating': { he: 'דירוג ממוצע', en: 'photographer rating' },

  // Photographer tags marquee
  'landing.tags.wedding': { he: 'חתונות', en: 'Wedding' },
  'landing.tags.portrait': { he: 'פורטרט', en: 'Portrait' },
  'landing.tags.family': { he: 'משפחות', en: 'Family' },
  'landing.tags.newborn': { he: 'ניו בורן', en: 'Newborn' },
  'landing.tags.events': { he: 'אירועים', en: 'Events' },
  'landing.tags.commercial': { he: 'מסחרי', en: 'Commercial' },
  'landing.tags.boudoir': { he: 'בודואר', en: 'Boudoir' },
  'landing.tags.maternity': { he: 'הריון', en: 'Maternity' },
  'landing.tags.realestate': { he: 'נדל"ן', en: 'Real Estate' },
  'landing.tags.fashion': { he: 'אופנה', en: 'Fashion' },
  'landing.tags.editorial': { he: 'עיתונאי', en: 'Editorial' },
  'landing.tags.brand': { he: 'מיתוג', en: 'Brand' },

  // Features section
  'landing.features.label': { he: 'יכולות', en: 'Features' },
  'landing.features.heading_pre': { he: 'בנוי בדיוק לצרכים של', en: 'Built for how photographers' },
  'landing.features.heading_accent': { he: 'באמת', en: 'actually' },
  'landing.features.heading_post': { he: 'צלמים', en: 'work' },

  'landing.feature.upload.title': { he: 'העלאת גלריה חכמה', en: 'Smart Gallery Upload' },
  'landing.feature.upload.desc': {
    he: 'מעלים עד 1,000 תמונות בבת אחת — המערכת מבצעת אופטימיזציה אוטומטית. הלקוח מקבל קישור פרטי, לא קישור WeTransfer.',
    en: 'Bulk-upload 1,000 photos with auto-optimization. Clients get a private link, not a zip file.',
  },
  'landing.feature.alerts.title': { he: 'עדכונים בזמן אמת', en: 'Instant Client Alerts' },
  'landing.feature.alerts.desc': {
    he: 'מקבלים התראה ברגע שלקוח פתח את הגלריה או שלח בחירות. לא צריך לרדוף אחרי אף אחד.',
    en: 'Get notified the second a client views their gallery or submits a selection. Zero chasing.',
  },
  'landing.feature.pipeline.title': { he: 'Pipeline מעקב עבודות', en: 'Selection Pipeline' },
  'landing.feature.pipeline.desc': {
    he: 'כל עבודה בסטטוס ברור: נשלחה ← נצפתה ← בחירות התקבלו ← בעריכה ← נמסרה. שום עבודה לא נופלת בין הכיסאות.',
    en: 'Track every job: Gallery Sent → Viewed → Selections In → Editing → Delivered. Nothing falls through.',
  },
  'landing.feature.store.title': { he: 'חנות מוצרים מובנית', en: 'Built-in Product Store' },
  'landing.feature.store.desc': {
    he: 'מוכרים אלבומים, הדפסים וקנבסים ישירות בתוך הגלריה. ההזמנות מגיעות לדשבורד — בלי אינטגרציות חיצוניות.',
    en: 'Sell albums, prints, and canvases without a third-party cart. Orders land right in your dashboard.',
  },
  'landing.feature.themes.title': { he: '11 תבניות לתיק העבודות', en: '11 Portfolio Themes' },
  'landing.feature.themes.desc': {
    he: 'דף תיק עבודות ציבורי, 11 תבניות מעוצבות, מיתוג מלא. עולה לאוויר תוך 5 דקות.',
    en: 'Your public portfolio, 11 themes, fully brandable. Live in 5 minutes.',
  },
  'landing.feature.bilingual.title': { he: 'עברית ואנגלית — ילידים', en: 'Hebrew & English' },
  'landing.feature.bilingual.desc': {
    he: 'תמיכה מלאה ב-RTL/LTR — ממשק, גלריות, התראות וחוויית הלקוח בשתי השפות, ללא פשרות.',
    en: 'Full RTL/LTR — galleries, notifications, and the client experience, in both languages.',
  },

  // Workflow section
  'landing.workflow.label': { he: 'איך זה עובד', en: 'How It Works' },
  'landing.workflow.heading_l1': { he: 'מהעלאה למסירה', en: 'From upload to delivery' },
  'landing.workflow.heading_in': { he: 'רק ב', en: 'in' },
  'landing.workflow.heading_num': { he: 'ארבעה', en: 'four' },
  'landing.workflow.heading_end': { he: 'שלבים פשוטים', en: 'simple steps' },

  'landing.step.1.title': { he: 'העלאה', en: 'Upload' },
  'landing.step.1.desc': {
    he: 'בוחרים את התמונות, גוררים פנימה. המערכת מטפלת בשינוי גודל, דחיסה ואחסון — הכל אוטומטי.',
    en: 'Select your exported images and drag them in. We resize, compress, and store everything automatically.',
  },
  'landing.step.2.title': { he: 'שיתוף', en: 'Share' },
  'landing.step.2.desc': {
    he: 'בלחיצה אחת נוצר קישור גלריה פרטי ללקוח — עובד על כל טלפון, טאבלט ומחשב, ללא הורדת אפליקציה.',
    en: 'One click generates a private gallery link for your client — works on any phone, tablet, or desktop.',
  },
  'landing.step.3.title': { he: 'בחירה', en: 'Select' },
  'landing.step.3.desc': {
    he: 'הלקוחות גולשים, מסמנים מועדפות ושולחים — הכל בתוך הגלריה הפרטית שלהם. ללא אפליקציה, ללא הרשמה.',
    en: 'Clients browse, heart their favourites, and submit — all inside their private gallery. No app needed.',
  },
  'landing.step.4.title': { he: 'מסירה', en: 'Deliver' },
  'landing.step.4.desc': {
    he: 'עוברים על הבחירות, מטפלים בהזמנות מוצרים, מסמנים את העבודה כנמסרה. ה-pipeline מתקדם מעצמו.',
    en: 'Review selections, process product orders, mark the job Delivered. The pipeline moves itself.',
  },

  // Real-time tracking split
  'landing.tracking.label': { he: 'מעקב בזמן אמת', en: 'Real-time Tracking' },
  'landing.tracking.heading_pre': { he: 'תמיד תדעו בדיוק איפה כל פרויקט', en: 'Know exactly where every project' },
  'landing.tracking.heading_accent': { he: 'עומד', en: 'stands' },
  'landing.tracking.p1': {
    he: 'רואים בדיוק איפה עומדת גלריית החתונה של שרה ודוד — בלי לשלוח ולו מייל מעקב אחד.',
    en: "Know exactly where Sarah's wedding gallery stands — without sending a single follow-up email.",
  },
  'landing.tracking.p2': {
    he: 'התראות חיות מגיעות ברגע שלקוח פתח את הגלריה, סימן מועדפת, או הזמין מוצר. ה-pipeline מתעדכן אוטומטית — בלי עבודה ידנית.',
    en: 'Live notifications fire the moment a client views their gallery, marks a favourite, or places a product order. Your pipeline updates itself.',
  },
  'landing.tracking.cta': { he: '← כנסו לדשבורד', en: 'See the dashboard →' },
  'landing.tracking.live_activity': { he: 'פעילות חיה', en: 'Live Activity' },
  'landing.tracking.live': { he: 'חי', en: 'Live' },
  'landing.tracking.status_pill': { he: 'סטטוס', en: 'Status' },

  // Notification demo items
  'landing.notif.1.title': { he: 'שרה שלחה 23 בחירות', en: 'Sarah submitted 23 selections' },
  'landing.notif.1.sub': { he: 'גלריית חתונה · חתונת שרה · לפני 2 דקות', en: "Wedding gallery · Sarah's wedding · 2 min ago" },
  'landing.notif.2.title': { he: 'תום פתח את הגלריה', en: 'Tom viewed the gallery' },
  'landing.notif.2.sub': {
    he: 'פורטרט עסקי · תמונות לינקדאין · לפני 18 דקות',
    en: 'Portrait session · Corporate headshots · 18 min ago',
  },
  'landing.notif.3.title': { he: 'אנה הזמינה קנבס 30×40', en: 'Anna ordered a 30×40 canvas' },
  'landing.notif.3.sub': { he: 'צילום משפחה · אביב 2026 · לפני שעה', en: 'Family shoot · Spring 2026 · 1 hr ago' },
  'landing.notif.4.title': { he: 'גלריה סומנה כנמסרה', en: 'Gallery marked Delivered' },
  'landing.notif.4.sub': { he: 'מיכל ר. · בת מצווה · לפני 3 שעות', en: 'Michal R. · Bat Mitzvah · 3 hr ago' },

  // Client experience section
  'landing.client.label': { he: 'חוויית לקוח', en: 'Client Experience' },
  'landing.client.heading_pre': { he: 'גלריה שהלקוחות שלכם', en: 'A gallery your clients will' },
  'landing.client.heading_accent': { he: 'יאהבו', en: 'love' },
  'landing.client.heading_post': { he: 'לגלוש בה', en: 'to browse' },
  'landing.client.bullet1': { he: 'ללא הורדת אפליקציה — עובד בדפדפן', en: 'No app download required' },
  'landing.client.bullet2': { he: 'מותאם לכל מכשיר ולכל מסך', en: 'Works on any device, any screen size' },
  'landing.client.bullet3': { he: 'שליחת בחירות בכמה שניות', en: 'Selections submitted in seconds' },
  'landing.client.cta': { he: 'לדמו הגלריה', en: 'Try the gallery demo' },
  'landing.phone.gallery': { he: 'גלריית קורל', en: 'Koral Gallery' },
  'landing.phone.session': { he: 'שרה ודוד · חתונה', en: 'Sarah & David · Wedding' },
  'landing.phone.submit': { he: 'שליחת הבחירות שלי', en: 'Submit My Selections' },

  // Brand / Portfolio themes split
  'landing.brand.label': { he: 'המותג שלכם', en: 'Your Brand' },
  'landing.brand.heading_pre': { he: 'דף תיק עבודות שמרגיש', en: 'A portfolio page that feels' },
  'landing.brand.heading_accent': { he: 'שלכם באמת', en: 'truly yours' },
  'landing.brand.desc': {
    he: 'בוחרים מאחת-עשרה תבניות מעוצבות — Soft, Luxury, Midnight, Bold ועוד. מתאימים צבעים, גופנים וטקסטים. דף תיק העבודות שלכם עולה לאוויר תוך דקות. ללא מעצבים. ללא קוד.',
    en: 'Pick from eleven hand-crafted themes — Soft, Luxury, Midnight, Bold, and more. Customise colours, fonts, and copy. Your public portfolio is live in minutes. No designers. No code.',
  },
  'landing.brand.cta': { he: '← לגלריית התבניות', en: 'Explore themes →' },
  'landing.brand.theme_suffix': { he: 'ערכת נושא', en: 'Theme' },

  // Products split
  'landing.products.label': { he: 'מכירת מוצרים', en: 'Sell Products' },
  'landing.products.heading_pre': { he: 'אלבומים, הדפסים וקנבסים —', en: 'Albums, prints & canvases —' },
  'landing.products.heading_accent': { he: 'כבר בפנים', en: 'built in' },
  'landing.products.desc': {
    he: 'מציעים מוצרים פיזיים ישירות בתוך גלריית הלקוח. הלקוחות בוחרים, אתם מממשים — ללא אינטגרציות חיצוניות, ללא עמלות לצד שלישי.',
    en: 'Offer physical products directly inside the client gallery. Clients choose, you fulfil — no third-party integrations, no extra subscriptions.',
  },
  'landing.products.cta': { he: '← לאפשרויות המוצרים', en: 'See product options →' },
  'landing.products.albums': { he: 'אלבומים', en: 'Albums' },
  'landing.products.prints': { he: 'הדפסים', en: 'Prints' },
  'landing.products.canvas': { he: 'קנבס', en: 'Canvas' },

  // Bilingual section
  'landing.bilingual.label': { he: 'תמיכת שפות', en: 'Language Support' },
  'landing.bilingual.en': { he: 'English', en: 'English' },
  'landing.bilingual.he': { he: 'עברית', en: 'עברית' },
  'landing.bilingual.desc': {
    he: 'תמיכה ילידית מלאה ב-RTL וב-LTR — ממשק הניהול, הגלריות, ההתראות ודפי הלקוח — הכל זמין בעברית ובאנגלית, ללא תוספות.',
    en: 'Full native RTL/LTR support — interface, galleries, notifications, and client pages in both languages.',
  },

  // Testimonials
  'landing.testimonials.label': { he: 'מה אומרים עלינו', en: 'Testimonials' },
  'landing.testimonials.heading_pre': { he: 'צלמים כבר מכורים', en: 'Photographers love' },
  'landing.testimonial.1.quote': {
    he: 'סוף סוף מערכת שמבינה איך צלמים עובדים בפועל. לא עוד גוגל שיטס ו-WeTransfer.',
    en: 'Finally, a tool that understands how photographers actually work.',
  },
  'landing.testimonial.1.name': { he: 'מיכל ר.', en: 'Michal R.' },
  'landing.testimonial.1.role': { he: 'צלמת חתונות, תל אביב', en: 'Wedding Photographer' },
  'landing.testimonial.2.quote': {
    he: 'הלקוחות שלי מתאהבים בחוויית הגלריה. בחירות שנהגו לקחת שבועות — היום מסתיימות תוך יומיים.',
    en: "My clients love their private gallery experience. Selections used to take weeks — now it's days.",
  },
  'landing.testimonial.2.name': { he: 'אמיר ק.', en: 'Amir K.' },
  'landing.testimonial.2.role': { he: 'צלם פורטרט ועסקי, חיפה', en: 'Portrait Photographer' },
  'landing.testimonial.3.quote': {
    he: 'ה-pipeline הוא המשחק-מחליף בשבילי. אני רואה בדיוק באיזה שלב כל עבודה, בלי לחפש בוואטסאפ.',
    en: 'The pipeline view is everything. I know exactly where every job stands at a glance.',
  },
  'landing.testimonial.3.name': { he: 'לירון ס.', en: 'Liron S.' },
  'landing.testimonial.3.role': { he: 'צלם משפחות וניו בורן, ירושלים', en: 'Family Photographer' },

  // CTA
  'landing.cta.heading_pre': { he: 'מוכנים לשדרג את', en: 'Ready to simplify your' },
  'landing.cta.heading_accent': { he: 'תהליך העבודה שלכם?', en: 'gallery workflow?' },
  'landing.cta.desc': {
    he: 'הצטרפו לצלמים שמעניקים ללקוחותיהם חוויה שאי אפשר לשכוח — עם Koral Light Studio.',
    en: 'Join photographers delivering better client experiences with Koral Light Studio.',
  },
  'landing.cta.primary': { he: 'התחילו בחינם', en: 'Get Started Free' },
  'landing.cta.secondary': { he: 'לדמו חי', en: 'Book a Demo' },
  'landing.cta.footnote': { he: 'חינמי לצמיתות. ללא כרטיס אשראי.', en: 'Free forever. No credit card required.' },

  // Footer
  'landing.footer.pricing': { he: 'מחירים', en: 'Pricing' },
  'landing.footer.support': { he: 'תמיכה', en: 'Support' },
  'landing.footer.privacy': { he: 'מדיניות פרטיות', en: 'Privacy' },
  'landing.footer.copyright': { he: '© 2026 Koral Light Studio', en: '© 2026 Koral Light Studio' },

  // ── Public: Services section ─────────────────────────────────────────────────
  'services.title': { he: 'השירותים שלי', en: 'My Services' },
  'services.starting_from': { he: 'החל מ-', en: 'Starting from' },
  'services.book_session': { he: 'הזמן צילום', en: 'Book This Session' },

  // ── Public: Packages / Pricing section ──────────────────────────────────────
  'packages.title': { he: 'חבילות ומחירים', en: 'Investment' },
  'packages.popular': { he: 'הכי פופולרי', en: 'Most Popular' },
  'packages.book_now': { he: 'בואו נדבר', en: "Let's Talk" },

  // ── Public: Video Reel section ───────────────────────────────────────────────
  'video.title': { he: 'צפו בעבודות שלי', en: 'See My Work' },
  'instagram.feed.title': { he: 'עקבו אחרי', en: 'Follow Along' },
  'instagram.feed.follow': { he: 'עקבו באינסטגרם', en: 'Follow on Instagram' },

  // ── Admin: Storage ──────────────────────────────────────────────────────────
  'storage.used': { he: 'שימוש באחסון', en: 'Storage Used' },
  'storage.of': { he: 'מתוך', en: 'of' },
  'storage.quota': { he: 'מכסה', en: 'Quota' },
  'storage.nearLimit': { he: 'האחסון שלך עומד להתמלא', en: 'Storage is almost full' },
  'storage.quotaExceeded': {
    he: 'מכסת האחסון חורגה. מחק תמונות כדי להמשיך להעלות.',
    en: 'Storage quota exceeded. Delete images to continue uploading.',
  },
  'admin.users.storage_section': { he: 'מכסת אחסון', en: 'Storage Quota' },
  'admin.users.storage_quota_label': { he: 'מכסה (GB)', en: 'Quota (GB)' },
  'admin.users.storage_quota_hint': {
    he: 'הגדר את כמות האחסון המרבית לצלם זה',
    en: 'Set the maximum storage this photographer may use',
  },
  'admin.users.quota_saved': { he: 'מכסת האחסון עודכנה', en: 'Storage quota updated' },
  'admin.users.storage_unlimited_hint': { he: 'ללא הגבלת אחסון לצלם זה', en: 'No storage limit for this photographer' },
  'admin.users.unlimited_label': { he: 'ללא הגבלה', en: 'Unlimited' },

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
