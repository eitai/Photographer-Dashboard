// Landing page data — exhibition-white redesign.
// All photos are local placeholders; see public/landing/README.md for the
// replacement guide. Keep filenames stable when swapping in real work.

export const SIGNUP_ROUTE = '/get-started';

export const PHOTOS = {
  wedding1: '/landing/wedding-01.jpg',
  wedding2: '/landing/wedding-02.jpg',
  family1: '/landing/family-01.jpg',
  portrait1: '/landing/portrait-01.jpg',
  portrait2: '/landing/portrait-02.jpg',
  couple1: '/landing/couple-01.jpg',
  couple2: '/landing/couple-02.jpg',
  event1: '/landing/event-01.jpg',
  newborn1: '/landing/newborn-01.jpg',
  maternity1: '/landing/maternity-01.jpg',
  landscape1: '/landing/landscape-01.jpg',
  banner1: '/landing/banner-01.jpg',
} as const;

// Hero mini-gallery — the interactive signature element.
// `picked` marks tiles pre-selected on load so the demo starts alive.
export const HERO_GALLERY: { src: string; picked: boolean }[] = [
  { src: PHOTOS.wedding1, picked: true },
  { src: PHOTOS.couple1, picked: false },
  { src: PHOTOS.portrait1, picked: false },
  { src: PHOTOS.family1, picked: true },
  { src: PHOTOS.wedding2, picked: false },
  { src: PHOTOS.couple2, picked: false },
];

// The real gallery status pipeline (matches backend Gallery.js statuses).
export const PIPELINE = [
  { key: 'draft', he: 'טיוטה', en: 'Draft' },
  { key: 'gallery_sent', he: 'נשלחה', en: 'Sent' },
  { key: 'viewed', he: 'נצפתה', en: 'Viewed' },
  { key: 'selection_submitted', he: 'בחירה הוגשה', en: 'Selection in' },
  { key: 'in_editing', he: 'בעריכה', en: 'In editing' },
  { key: 'delivered', he: 'נמסרה', en: 'Delivered' },
] as const;
