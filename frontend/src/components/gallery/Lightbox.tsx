import { useEffect, useRef, useState } from "react";
import { X, Download, ChevronLeft, ChevronRight, Check, Star, MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export interface LightboxImage {
  _id: string;
  path: string;
  previewPath?: string;
  filename?: string;
  originalName?: string;
  thumbnailPath?: string;
  beforePath?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  getImageUrl: (path: string) => string;

  // Download
  showDownload?: boolean;
  onDownload?: (path: string, filename: string) => void;

  // Client selection mode
  isSelected?: boolean;
  isBlocked?: boolean;
  onToggleSelect?: () => void;

  // Hero photo (only relevant when selected)
  isHero?: boolean;
  onToggleHero?: () => void;

  // Per-image comment (only relevant when selected)
  comment?: string;
  onCommentChange?: (val: string) => void;

  // Admin showcase — mark as featured
  isFeatured?: boolean;
  onToggleFeatured?: () => void;
}

export const Lightbox = ({
  images, index, onClose, onPrev, onNext,
  getImageUrl,
  showDownload = true, onDownload,
  isSelected, isBlocked, onToggleSelect,
  isHero, onToggleHero,
  comment, onCommentChange,
  isFeatured, onToggleFeatured,
}: LightboxProps) => {
  const { t } = useI18n();
  const img = images[index];
  const touchStartX = useRef<number | null>(null);
  const [showComment, setShowComment] = useState(false);

  useEffect(() => {
    setShowComment(false);
  }, [index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNext, onPrev, onClose]);

  const filename = img.filename || img.path.split("/").pop() || "photo";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-label="Image preview"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (diff > 50 && index < images.length - 1) onNext();
        else if (diff < -50 && index > 0) onPrev();
        touchStartX.current = null;
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
      >
        <X size={18} />
      </button>

      {/* Download — only shown when the original path is available */}
      {showDownload && onDownload && img.path && (
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(img.path, filename); }}
          className="absolute top-4 right-16 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
          aria-label={t("gallery.download_photo")}
        >
          <Download size={16} />
        </button>
      )}

      {/* Counter */}
      <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm select-none">
        {index + 1} / {images.length}
      </p>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Next */}
      {index < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Main image / before-after — use previewPath (compressed WebP) for display;
          fall back to path for images that predate the preview generation */}
      {img.beforePath ? (
        <div
          className="relative w-[min(85vw,900px)] aspect-[3/2] rounded-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <BeforeAfterSlider
            beforeSrc={getImageUrl(img.beforePath)}
            afterSrc={getImageUrl(img.previewPath ?? img.path)}
            alt={img.originalName || filename}
          />
        </div>
      ) : (
        <img
          src={getImageUrl(img.previewPath ?? img.path)}
          alt={img.originalName || filename}
          className="max-w-full max-h-[85vh] rounded-xl object-contain px-16"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Bottom action bar */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 flex-wrap justify-center"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Selection toggle */}
        {onToggleSelect && (
          isSelected ? (
            <button
              onClick={onToggleSelect}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#E7B8B5] text-charcoal transition-colors"
            >
              <Check size={14} /> {t("gallery.photo_selected")}
            </button>
          ) : !isBlocked ? (
            <button
              onClick={onToggleSelect}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Check size={14} /> {t("gallery.select_photo")}
            </button>
          ) : (
            <p className="text-white/60 text-sm">{t("gallery.max_reached")}</p>
          )
        )}

        {/* Hero toggle — only when selected */}
        {isSelected && onToggleHero && (
          <button
            onClick={onToggleHero}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              isHero
                ? "bg-amber-400 text-white"
                : "text-white bg-white/10 hover:bg-white/20"
            }`}
            title="Mark as hero photo"
          >
            <Star size={14} fill={isHero ? "currentColor" : "none"} />
            {isHero ? "תמונת ראשית" : "סמן כראשית"}
          </button>
        )}

        {/* Comment — only when selected */}
        {isSelected && onCommentChange && (
          <button
            onClick={() => setShowComment((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              comment?.trim()
                ? "bg-[#E7B8B5] text-charcoal"
                : "text-white bg-white/10 hover:bg-white/20"
            }`}
          >
            <MessageCircle size={14} />
            {comment?.trim() ? "ערוך הערה" : "הוסף הערה"}
          </button>
        )}

        {/* Featured toggle (admin showcase) */}
        {onToggleFeatured && (
          isFeatured ? (
            <button
              onClick={onToggleFeatured}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-[#E7B8B5] text-charcoal transition-colors"
            >
              <Check size={14} /> בגלריית ראווה
            </button>
          ) : (
            <button
              onClick={onToggleFeatured}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Check size={14} /> הוסף לראווה
            </button>
          )
        )}
      </div>

      {/* Comment textarea overlay */}
      {isSelected && onCommentChange && showComment && (
        <div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-80 bg-black/80 backdrop-blur-sm rounded-xl p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            value={comment || ""}
            onChange={(e) => onCommentChange(e.target.value)}
            placeholder="הוסף הערה לתמונה..."
            rows={3}
            className="w-full bg-white/10 text-white text-sm placeholder-white/50 border border-white/20 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-white/40"
          />
          <button
            onClick={() => setShowComment(false)}
            className="mt-2 text-xs text-white/70 hover:text-white"
          >
            סגור
          </button>
        </div>
      )}
    </div>
  );
};
