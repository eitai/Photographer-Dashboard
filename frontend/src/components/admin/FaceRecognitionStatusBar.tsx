import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getFaceRecognitionStatus,
  runFaceRecognition,
  type FaceRecognitionJob,
} from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ScanFace, RotateCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface FaceRecognitionStatusBarProps {
  galleryId: string;
}

const QUERY_KEY = (galleryId: string) => ['faceRecognitionStatus', galleryId] as const;

const ACTIVE_STATUSES = new Set<FaceRecognitionJob['status']>(['queued', 'running']);

export const FaceRecognitionStatusBar = ({ galleryId }: FaceRecognitionStatusBarProps) => {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Poll job status — only while active
  // -------------------------------------------------------------------------
  const { data: job, isLoading, isError } = useQuery<FaceRecognitionJob>({
    queryKey: QUERY_KEY(galleryId),
    queryFn: () => getFaceRecognitionStatus(galleryId),
    // Retry once on error; suppress 404 (no job yet)
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failureCount < 1;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && ACTIVE_STATUSES.has(status)) return 3_000;
      // No job found yet (404 or undefined) — keep checking every 5 s so the bar
      // wakes up automatically once the backend creates the job after upload.
      if (!query.state.data) return 5_000;
      return false;
    },
    staleTime: 0,
  });

  // -------------------------------------------------------------------------
  // Auto-hide the success banner after 5 s
  // Use job?.finishedAt (not status) as the dep so re-runs that complete
  // without the status polling catching 'queued'/'running' still trigger.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (job?.status === 'done') {
      // Force-refetch the face strip immediately now that recognition is complete
      queryClient.refetchQueries({ queryKey: ['faceGroups', galleryId] });
      hideTimerRef.current = setTimeout(() => {
        queryClient.removeQueries({ queryKey: QUERY_KEY(galleryId) });
      }, 5_000);
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [job?.finishedAt, galleryId, queryClient]);

  // -------------------------------------------------------------------------
  // Retry mutation
  // -------------------------------------------------------------------------
  const retryMutation = useMutation({
    mutationFn: () => runFaceRecognition(galleryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY(galleryId) });
      // Clear the face strip immediately — tags were deleted server-side, so the old
      // bubbles should disappear right away and reappear when the new run finishes.
      queryClient.setQueryData(['faceGroups', galleryId], []);
      toast.success(t('admin.face.restarted'));
    },
    onError: () => {
      toast.error(t('admin.face.start_failed'));
    },
  });

  // -------------------------------------------------------------------------
  // Render nothing while fetching / no job
  // -------------------------------------------------------------------------
  if (isLoading || isError || !job) return null;
  if (!ACTIVE_STATUSES.has(job.status) && job.status !== 'done' && job.status !== 'failed') {
    return null;
  }

  const progressPct =
    job.totalImages > 0 ? Math.round((job.processed / job.totalImages) * 100) : 0;

  // ── Queued / Running ──────────────────────────────────────────────────────
  if (ACTIVE_STATUSES.has(job.status)) {
    return (
      <div className='mt-4 rounded-xl border border-beige bg-card px-4 py-3 space-y-2'>
        <div className='flex items-center gap-2'>
          <Loader2 size={14} className='animate-spin text-blush shrink-0' />
          <p className='text-xs text-charcoal font-medium'>
            {job.status === 'queued' ? t('admin.face.status_queued') : t('admin.face.status_running')}
          </p>
          <span className='ms-auto text-xs text-warm-gray tabular-nums'>
            {job.processed} / {job.totalImages} &nbsp;·&nbsp; {job.matched} {t('admin.face.matched_label')}
          </span>
        </div>

        {/* Progress bar — always LTR so fill goes left-to-right */}
        <div dir='ltr' className='w-full h-1.5 rounded-full bg-beige overflow-hidden'>
          <div
            role='progressbar'
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className='h-full rounded-full bg-blush transition-all duration-500'
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (job.status === 'done') {
    return (
      <div className='mt-4 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex-wrap'>
        <CheckCircle2 size={15} className='text-green-600 shrink-0' />
        <p className='text-xs text-green-800 font-medium flex-1'>
          {job.matched === 1
            ? t('admin.face.status_done_one')
            : t('admin.face.status_done').replace('{n}', String(job.matched))}
        </p>
        <button
          type='button'
          disabled={retryMutation.isPending}
          onClick={() => retryMutation.mutate()}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-100 transition-colors',
            retryMutation.isPending && 'opacity-50 pointer-events-none',
          )}
        >
          {retryMutation.isPending ? <Loader2 size={11} className='animate-spin' /> : <RotateCcw size={11} />}
          Re-run
        </button>
      </div>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  return (
    <div className='mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex-wrap'>
      <XCircle size={15} className='text-rose-500 shrink-0' />
      <p className='text-xs text-rose-700 font-medium flex-1'>
        {t('admin.face.status_failed')}{job.errorMessage ? `: ${job.errorMessage}` : ''}
      </p>
      <button
        type='button'
        disabled={retryMutation.isPending}
        onClick={() => retryMutation.mutate()}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-100 transition-colors',
          retryMutation.isPending && 'opacity-50 pointer-events-none',
        )}
      >
        {retryMutation.isPending ? (
          <Loader2 size={11} className='animate-spin' />
        ) : (
          <RotateCcw size={11} />
        )}
        {t('admin.face.retry')}
      </button>
    </div>
  );
};
