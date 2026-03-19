import { useRef, useEffect, useState } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import type { GalleryImage } from '@/types/gallery';

interface Props {
  images: GalleryImage[];
  columnCount: number;
  rowHeight?: number;
  stickyTop?: number;
  renderItem: (img: GalleryImage, index: number) => React.ReactNode;
}

export function VirtualizedGalleryGrid({
  images,
  columnCount,
  rowHeight = 280,
  stickyTop = 64,
  renderItem,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight - stickyTop : 600
  );

  const rowCount = Math.ceil(images.length / columnCount);
  const totalHeight = rowCount * rowHeight;

  // Measure container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Track viewport height on resize
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight - stickyTop);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [stickyTop]);

  // Sync window scroll → list scroll (sticky grid pattern)
  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el || !listRef.current) return;
      const top = el.getBoundingClientRect().top;
      const scrolled = Math.max(0, -(top - stickyTop));
      listRef.current.scrollTo(scrolled);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [stickyTop]);

  function Row({ index, style }: ListChildComponentProps) {
    const startIdx = index * columnCount;
    return (
      <div style={{ ...style, display: 'flex', gap: 12, paddingBottom: 12 }}>
        {Array.from({ length: columnCount }, (_, col) => {
          const imgIdx = startIdx + col;
          if (imgIdx >= images.length) {
            return <div key={col} style={{ flex: 1 }} />;
          }
          const img = images[imgIdx];
          return (
            <div key={img._id} style={{ flex: 1, minWidth: 0 }}>
              {renderItem(img, imgIdx)}
            </div>
          );
        })}
      </div>
    );
  }

  if (!containerWidth) {
    return <div ref={containerRef} style={{ minHeight: '200px' }} />;
  }

  return (
    <div ref={containerRef} style={{ height: totalHeight }}>
      <FixedSizeList
        ref={listRef}
        height={Math.min(viewportHeight, totalHeight)}
        itemCount={rowCount}
        itemSize={rowHeight}
        width={containerWidth}
        style={{ position: 'sticky', top: stickyTop, overflow: 'hidden' }}
        overscanCount={3}
      >
        {Row}
      </FixedSizeList>
    </div>
  );
}
