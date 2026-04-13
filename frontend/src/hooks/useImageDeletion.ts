import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/hooks/useQueries';

export const useImageDeletion = (id: string | undefined, onSuccess: () => void) => {
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const queryClient = useQueryClient();

  const confirmDelete = async () => {
    setBulkDeleting(true);
    await Promise.all(toDelete.map((imgId) => api.delete(`/galleries/${id}/images/${imgId}`)));
    setBulkDeleting(false);
    setToDelete([]);
    queryClient.invalidateQueries({ queryKey: queryKeys.storageMe });
    onSuccess();
  };

  return { toDelete, setToDelete, bulkDeleting, confirmDelete };
};
