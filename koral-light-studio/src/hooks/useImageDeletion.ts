import { useState } from 'react';
import api from '@/lib/api';

export const useImageDeletion = (id: string | undefined, onSuccess: () => void) => {
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const confirmDelete = async () => {
    setBulkDeleting(true);
    await Promise.all(toDelete.map((imgId) => api.delete(`/galleries/${id}/images/${imgId}`)));
    setBulkDeleting(false);
    setToDelete([]);
    onSuccess();
  };

  return { toDelete, setToDelete, bulkDeleting, confirmDelete };
};
