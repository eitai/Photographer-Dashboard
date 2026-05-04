import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFolders, createFolder, renameFolder, deleteFolder } from '@/services/galleryService';

export function useFolders(galleryId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['galleries', galleryId, 'folders'];

  const query = useQuery({
    queryKey: key,
    queryFn: () => listFolders(galleryId!),
    enabled: !!galleryId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (name: string) => createFolder(galleryId!, name),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      renameFolder(galleryId!, folderId, name),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (folderId: string) => deleteFolder(galleryId!, folderId),
    onSuccess: invalidate,
  });

  return { folders: query.data ?? [], isLoading: query.isLoading, create, rename, remove };
}
