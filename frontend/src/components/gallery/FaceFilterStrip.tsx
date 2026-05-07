import {
  User, ScanFace, LayoutGrid,
  RotateCcw, CheckCircle2, XCircle, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getGalleryFaceGroups,
  getGalleryFaceGroupsPublic,
  getImageUrl,
  getFaceRecognitionStatus,
  runFaceRecognition,
} from '@/lib/api';
import type { FaceGroup, FaceRecognitionJob } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface FaceFilterStripProps {
  galleryId: string;
  showNames?: boolean;
  selectedGroupKey: string | null;
  onSelect: (groupKey: string | null, imageIds: string[]) => void;
  galleryToken?: string;
}

const STATUS_KEY = (galleryId: string) => ['faceRecognitionStatus', galleryId] as const;
const ACTIVE_STATUSES = new Set<FaceRecognitionJob['status']>(['queued', 'running']);

const FaceAvatar = ({ face, selected }: { face: FaceGroup; selected: boolean }) => {
  if (face.referencePhotoPath) {
    return (
      <img src={getImageUrl(face.referencePhotoPath)} className='w-full h-full object-cover' alt='' />
    );
  }
  if (face.faceCropPath) {
    return (
      <img src={getImageUrl(face.faceCropPath)} className='w-full h-full object-cover' alt='' />
    );
  }
  if (face.repThumbnailPath && face.repBoundingBox) {
    const bb = face.repBoundingBox;
    const cx = (bb.x + bb.width / 2) * 100;
    const cy = (bb.y + bb.height / 2) * 100;
    return (
      <img
        src={getImageUrl(face.repThumbnailPath)}
        className='w-full h-full'
        style={{ objectFit: 'cover', objectPosition: `${cx}% ${cy}%` }}
        alt=''
      />
    );
  }
  return (
    <div className={cn('w-full h-full flex items-center justify-center bg-beige', selected && 'bg-blush/20')}>
      <User size={22} className='text-warm-gray' />
    </div>
  );
};

export const FaceFilterStrip = ({
  galleryId,
  showNames = false,
  selectedGroupKey,
  onSelect,
  galleryToken,
}: FaceFilterStripProps) => {
  const { t, dir } = useI18n();
  const queryClient = useQueryClient();
  const isAdmin = !galleryToken;

  const scrollRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenFinishedAtRef = useRef<string | undefined>(undefined);

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // ── Face groups ────────────────────────────────────────────────────────────
  const { data, refetch } = useQuery<FaceGroup[]>({
    queryKey: ['faceGroups', galleryId],
    queryFn: () =>
      galleryToken
        ? getGalleryFaceGroupsPublic(galleryId, galleryToken)
        : getGalleryFaceGroups(galleryId),
    staleTime: 0,
    refetchInterval: (query) => (!query.state.data || query.state.data.length === 0 ? 5_000 : false),
  });

  // ── Job status — admin only ────────────────────────────────────────────────
  const { data: job } = useQuery<FaceRecognitionJob>({
    queryKey: STATUS_KEY(galleryId),
    queryFn: () => getFaceRecognitionStatus(galleryId),
    enabled: isAdmin,
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      return status !== 404 && failureCount < 1;
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s && ACTIVE_STATUSES.has(s)) return 3_000;
      if (!query.state.data) return 5_000;
      return false;
    },
    staleTime: 0,
  });

  // ── Re-run mutation — admin only ───────────────────────────────────────────
  const retryMutation = useMutation({
    mutationFn: () => runFaceRecognition(galleryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY(galleryId) });
      queryClient.setQueryData(['faceGroups', galleryId], []);
      toast.success(t('admin.face.restarted'));
    },
    onError: () => toast.error(t('admin.face.start_failed')),
  });

  // ── Carousel scroll state ──────────────────────────────────────────────────
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const absLeft = Math.abs(el.scrollLeft);
    setCanScrollPrev(absLeft > 2);
    setCanScrollNext(absLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [data, updateScrollState]);

  // In RTL the scroll direction is inverted (negative scrollLeft)
  const scrollStep = dir === 'rtl' ? 220 : -220;
  const scrollPrev = () => scrollRef.current?.scrollBy({ left: scrollStep, behavior: 'smooth' });
  const scrollNext = () => scrollRef.current?.scrollBy({ left: -scrollStep, behavior: 'smooth' });

  // ── Cleanup hide timer on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  // ── When job completes: refetch faces + auto-remove status after 5 s ───────
  useEffect(() => {
    const curr = job?.finishedAt;
    if (!curr || curr === seenFinishedAtRef.current || job?.status !== 'done') return;
    seenFinishedAtRef.current = curr;
    refetch();
    queryClient.refetchQueries({ queryKey: ['faceGroups', galleryId] });
    hideTimerRef.current = setTimeout(() => {
      queryClient.removeQueries({ queryKey: STATUS_KEY(galleryId) });
    }, 5_000);
  }, [job?.finishedAt, job?.status, galleryId, queryClient, refetch]);

  const hasFaces = !!data && data.length > 0;
  const hasJob = isAdmin && !!job;

  if (!hasFaces && !hasJob) return null;

  const isActive = hasJob && ACTIVE_STATUSES.has(job!.status);
  const progressPct =
    job && job.totalImages > 0 ? Math.round((job.processed / job.totalImages) * 100) : 0;

  const headerHasContent = isActive || hasFaces;

  return (
    <div className='rounded-2xl bg-card border border-beige px-4 py-3'>
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className={cn('flex items-center gap-1.5', headerHasContent && 'mb-3')}>
        <ScanFace size={14} className='text-warm-gray' />
        <span className='text-xs text-warm-gray font-medium'>{t('gallery.face_filter_title')}</span>

        {isAdmin && job && (
          <div className='ms-auto flex items-center gap-2'>
            {isActive && (
              <span className='text-xs text-warm-gray tabular-nums'>
                {job.processed}&thinsp;/&thinsp;{job.totalImages}
                {job.matched > 0 && <> &middot; {job.matched} {t('admin.face.matched_label')}</>}
              </span>
            )}
            {job.status === 'done' && (
              <>
                <CheckCircle2 size={12} className='text-green-600 shrink-0' />
                <span className='text-xs text-green-700 font-medium'>
                  {job.matched === 1
                    ? t('admin.face.status_done_one')
                    : t('admin.face.status_done').replace('{n}', String(job.matched))}
                </span>
              </>
            )}
            {job.status === 'failed' && (
              <>
                <XCircle size={12} className='text-rose-500 shrink-0' />
                <span className='text-xs text-rose-600 font-medium'>{t('admin.face.status_failed')}</span>
              </>
            )}
            {(job.status === 'done' || job.status === 'failed') && (
              <button
                type='button'
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate()}
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-beige text-warm-gray hover:bg-beige/60 transition-colors',
                  retryMutation.isPending && 'opacity-50 pointer-events-none',
                )}
              >
                {retryMutation.isPending ? <Loader2 size={10} className='animate-spin' /> : <RotateCcw size={10} />}
                {t('admin.face.retry')}
              </button>
            )}
            {isActive && <Loader2 size={12} className='animate-spin text-blush shrink-0' />}
          </div>
        )}
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {isActive && (
        <div dir='ltr' className='w-full h-1 rounded-full bg-beige overflow-hidden mb-3'>
          <div
            role='progressbar'
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className='h-full rounded-full bg-blush transition-all duration-500'
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* ── Carousel ───────────────────────────────────────────────────────── */}
      {hasFaces && (
        <div className='flex items-center gap-1'>
          {/* Prev arrow */}
          <button
            type='button'
            onClick={scrollPrev}
            aria-label='Previous'
            className={cn(
              'shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-beige bg-card text-warm-gray hover:bg-beige transition-all duration-200',
              !canScrollPrev && 'opacity-0 pointer-events-none',
            )}
          >
            {dir === 'rtl' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Scroll viewport */}
          <div className='relative flex-1 overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-6 before:bg-gradient-to-r before:from-card before:to-transparent before:z-10 before:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-6 after:bg-gradient-to-l after:from-card after:to-transparent after:z-10 after:pointer-events-none'>
            <div
              ref={scrollRef}
              className='flex items-center gap-3 overflow-x-auto pb-1 px-2 scrollbar-hide'
            >
              {/* "All" button */}
              <button
                type='button'
                onClick={() => onSelect(null, [])}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium shrink-0 transition-colors',
                  selectedGroupKey === null
                    ? 'bg-charcoal text-white'
                    : 'bg-beige text-charcoal hover:bg-blush/30',
                )}
              >
                <LayoutGrid size={13} />
                {t('gallery.face_filter_all')}
              </button>

              {data!.map((face) => {
                const isSelected = selectedGroupKey === face.groupKey;
                return (
                  <div
                    key={face.groupKey}
                    role='button'
                    tabIndex={0}
                    onClick={() => onSelect(face.groupKey, face.imageIds)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(face.groupKey, face.imageIds);
                      }
                    }}
                    className='shrink-0 cursor-pointer transition-all duration-200'
                  >
                    <div
                      className={cn(
                        'w-16 h-16 rounded-full overflow-hidden ring-[3px] ring-offset-2 transition-all duration-200',
                        isSelected ? 'ring-blush' : 'ring-transparent hover:ring-blush/40',
                      )}
                    >
                      <FaceAvatar face={face} selected={isSelected} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next arrow */}
          <button
            type='button'
            onClick={scrollNext}
            aria-label='Next'
            className={cn(
              'shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-beige bg-card text-warm-gray hover:bg-beige transition-all duration-200',
              !canScrollNext && 'opacity-0 pointer-events-none',
            )}
          >
            {dir === 'rtl' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      )}
    </div>
  );
};
