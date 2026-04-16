import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/hooks/useQueries';

export const useImageDeletion = (id: string | undefined, onSuccess: () => void) => {
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null);
  const queryClient = useQueryClient();

  const confirmDelete = async () => {
    setBulkDeleting(true);
    setDeleteProgress({ done: 0, total: toDelete.length });
    try {
      for (let i = 0; i < toDelete.length; i++) {
        await api.delete(`/galleries/${id}/images/${toDelete[i]}`);
        setDeleteProgress({ done: i + 1, total: toDelete.length });
      }
      setToDelete([]);
      queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
      onSuccess();
    } finally {
      setBulkDeleting(false);
      setDeleteProgress(null);
    }
  };

  return { toDelete, setToDelete, bulkDeleting, deleteProgress, confirmDelete };
};
