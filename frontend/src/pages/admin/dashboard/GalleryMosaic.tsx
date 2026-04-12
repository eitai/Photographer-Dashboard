const MOSAIC_PALETTES: [string, string, string, string][] = [
  ['bg-rose-100', 'bg-rose-200', 'bg-pink-100', 'bg-pink-200'],
  ['bg-blue-100', 'bg-blue-200', 'bg-sky-100', 'bg-sky-200'],
  ['bg-purple-100', 'bg-purple-200', 'bg-violet-100', 'bg-violet-200'],
  ['bg-amber-100', 'bg-amber-200', 'bg-yellow-100', 'bg-yellow-200'],
  ['bg-emerald-100', 'bg-emerald-200', 'bg-teal-100', 'bg-teal-200'],
  ['bg-orange-100', 'bg-orange-200', 'bg-red-100', 'bg-red-200'],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getPalette(name: string): [string, string, string, string] {
  return MOSAIC_PALETTES[hashName(name) % MOSAIC_PALETTES.length];
}

export const GalleryMosaic = ({ name }: { name: string }) => {
  const [tl, tr, bl, br] = getPalette(name);
  return (
    <div className='w-10 h-10 rounded-md overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0'>
      <div className={tl} />
      <div className={tr} />
      <div className={bl} />
      <div className={br} />
    </div>
  );
};
