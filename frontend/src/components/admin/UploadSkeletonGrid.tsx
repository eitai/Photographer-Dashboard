const MAX_VISIBLE_SKELETONS = 48;

export const UploadSkeletonGrid = ({ count }: { count: number }) => {
  if (count === 0) return null;
  const visible = Math.min(count, MAX_VISIBLE_SKELETONS);
  return (
    <>
      {Array.from({ length: visible }).map((_, i) => (
        <div key={i} className='relative aspect-square rounded-lg overflow-hidden bg-beige animate-pulse' />
      ))}
    </>
  );
};
