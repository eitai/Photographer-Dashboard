import { useRef, useState } from 'react';
import api from '@/lib/api';

export const useBeforeImageUpload = (id: string | undefined, onSuccess: () => void) => {
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const [beforeTargetId, setBeforeTargetId] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState<string | null>(null);

  const triggerUpload = (imgId: string) => {
    setBeforeTargetId(imgId);
    beforeInputRef.current?.click();
  };

  const handleBeforeUpload = async (file: File) => {
    if (!beforeTargetId) return;
    setUploadingBefore(beforeTargetId);
    const formData = new FormData();
    formData.append('before', file);
    try {
      await api.patch(`/galleries/${id}/images/${beforeTargetId}/before`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } finally {
      setUploadingBefore(null);
      setBeforeTargetId(null);
    }
  };

  return { beforeInputRef, uploadingBefore, triggerUpload, handleBeforeUpload };
};
