import { useState, useCallback } from 'react';

/**
 * Manages the delete-confirmation modal pattern:
 *   1. User clicks trash → setTarget(item)
 *   2. Modal appears → user confirms → onConfirm(item) is called
 *   3. Modal dismisses automatically after onConfirm resolves/rejects
 *
 * onConfirm should throw on failure; the hook resets state regardless.
 */
export function useDeleteConfirmation<T>(onConfirm: (target: T) => Promise<void>) {
  const [target, setTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirm = useCallback(async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await onConfirm(target);
    } finally {
      setDeleting(false);
      setTarget(null);
    }
  }, [target, onConfirm]);

  const cancel = useCallback(() => setTarget(null), []);

  return { target, setTarget, deleting, confirm, cancel };
}
