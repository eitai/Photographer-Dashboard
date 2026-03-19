import { useRef, useState } from 'react';

interface Props {
  beforeSrc: string;
  afterSrc: string;
  alt?: string;
}

export const BeforeAfterSlider = ({ beforeSrc, afterSrc, alt = '' }: Props) => {
  const [position, setPosition] = useState(50);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-col-resize overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => updatePosition(e.clientX)}
      onTouchMove={(e) => {
        e.preventDefault();
        updatePosition(e.touches[0].clientX);
      }}
    >
      {/* After (edited) — base layer */}
      <img src={afterSrc} alt={alt} className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* Before (original) — clipped, only visible on hover */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
          opacity: hovered ? 1 : 0,
        }}
      >
        <img src={beforeSrc} alt={alt} className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider line + handle — only visible on hover */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.4)] pointer-events-none transition-opacity duration-300"
        style={{ left: `${position}%`, transform: 'translateX(-50%)', opacity: hovered ? 1 : 0 }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white shadow-md flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H1M11 6H8M3 3.5L1 6l2 2.5M9 3.5L11 6 9 8.5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Labels — only visible on hover */}
      <span
        className="absolute bottom-2 left-2 text-[10px] font-semibold tracking-wide text-white bg-black/40 px-1.5 py-0.5 rounded pointer-events-none transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        לפני
      </span>
      <span
        className="absolute bottom-2 right-2 text-[10px] font-semibold tracking-wide text-white bg-black/40 px-1.5 py-0.5 rounded pointer-events-none transition-opacity duration-300"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        אחרי
      </span>
    </div>
  );
};
