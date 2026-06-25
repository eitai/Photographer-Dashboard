import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  ActionSheetIOS,
  Modal,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { getGallery, updateGallery, uploadImages, deleteImage as deleteImageApi, getClients } from '@koral/api';
import type { Gallery, Client, GalleryStatus } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Input, StatusBadge } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

const GALLERY_STATUSES: GalleryStatus[] = [
  'gallery_sent',
  'viewed',
  'selection_submitted',
  'in_editing',
  'delivered',
];

const STATUS_LABELS: Record<GalleryStatus, string> = {
  gallery_sent: 'Gallery Sent',
  viewed: 'Viewed',
  selection_submitted: 'Selection Submitted',
  in_editing: 'In Editing',
  delivered: 'Delivered',
};

const QUERY_KEYS = {
  gallery: (id: string) => ['gallery', id] as const,
  clients: ['clients'] as const,
};

const SCREEN = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  images: { filename: string }[];
  startIndex: number;
  onClose: () => void;
}

function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const uri = `${API_URL}/uploads/${images[index]?.filename}`;

  function prev() { setIndex((i) => Math.max(0, i - 1)); }
  function next() { setIndex((i) => Math.min(images.length - 1, i + 1)); }

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={lb.overlay}>
        {/* Close */}
        <TouchableOpacity style={lb.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <Text style={lb.counter}>{index + 1} / {images.length}</Text>

        {/* Image */}
        <Image source={{ uri }} style={lb.image} resizeMode="contain" />

        {/* Prev */}
        {index > 0 && (
          <TouchableOpacity style={[lb.navBtn, lb.navLeft]} onPress={prev} accessibilityRole="button" accessibilityLabel="Previous">
            <Ionicons name="chevron-back" size={32} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Next */}
        {index < images.length - 1 && (
          <TouchableOpacity style={[lb.navBtn, lb.navRight]} onPress={next} accessibilityRole="button" accessibilityLabel="Next">
            <Ionicons name="chevron-forward" size={32} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const lb = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN.width,
    height: SCREEN.height * 0.8,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  counter: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    zIndex: 10,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
  },
  navLeft: { left: 12 },
  navRight: { right: 12 },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GalleryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [headerMessage, setHeaderMessage] = useState('');
  const [maxSelections, setMaxSelections] = useState('10');
  const [uploading, setUploading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: gallery,
    isLoading,
    isError,
    refetch,
  } = useQuery<Gallery>({
    queryKey: QUERY_KEYS.gallery(id),
    queryFn: () => getGallery(id),
    enabled: !!id,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  useEffect(() => {
    if (gallery) {
      setTitle(gallery.title);
      setHeaderMessage(gallery.headerMessage ?? '');
      setMaxSelections(String(gallery.maxSelections ?? 10));
    }
  }, [gallery]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Gallery>) => updateGallery(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(id) });
      qc.invalidateQueries({ queryKey: ['galleries'] });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => deleteImageApi(id, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(id) });
    },
    onError: () => {
      Alert.alert('', t('admin.galleries.error'));
    },
  });

  const clientName = clients.find((c) => c._id === gallery?.clientId)?.name ?? '—';

  // ---- Status picker -------------------------------------------------------

  function openStatusPicker() {
    if (!gallery) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...GALLERY_STATUSES.map((s) => STATUS_LABELS[s]), t('admin.common.cancel')],
          cancelButtonIndex: GALLERY_STATUSES.length,
          title: t('admin.galleries.select_status'),
        },
        (index) => {
          if (index < GALLERY_STATUSES.length) {
            updateMutation.mutate({ status: GALLERY_STATUSES[index] });
          }
        },
      );
    } else {
      setShowStatusPicker(true);
    }
  }

  // ---- Save title ----------------------------------------------------------

  function handleSave() {
    if (!title.trim()) return;
    const maxSel = parseInt(maxSelections, 10);
    updateMutation.mutate({
      title: title.trim(),
      headerMessage: headerMessage.trim() || undefined,
      maxSelections: !isNaN(maxSel) && maxSel > 0 ? maxSel : undefined,
    });
    Alert.alert('', t('admin.galleries.save_success'));
  }

  // ---- Image upload --------------------------------------------------------

  const handleUpload = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (const asset of result.assets) {
        if (Platform.OS === 'web') {
          // On web, asset.uri is a blob URL (e.g. blob:http://localhost/uuid).
          // Splitting by '/' gives a UUID with no extension, so multer's
          // fileFilter rejects it. Fetch the blob and derive the extension
          // from its MIME type instead.
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          const mimeType = blob.type || 'image/jpeg';
          const ext = mimeType.split('/')[1] ?? 'jpg';
          formData.append('images', blob, `photo.${ext}`);
        } else {
          const filename = asset.uri.split('/').pop() ?? 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('images', { uri: asset.uri, name: filename, type } as unknown as Blob);
        }
      }
      await uploadImages(id, formData);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(id) });
    } catch {
      Alert.alert('', t('admin.galleries.error'));
    } finally {
      setUploading(false);
    }
  }, [id, qc, t]);

  // ---- Selection toggle (bulk mode) ----------------------------------------

  function toggleSelect(imageId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); }

  // ---- Delete image --------------------------------------------------------

  function handleDeleteImage(imageId: string) {
    Alert.alert(
      t('admin.upload.delete_title'),
      t('admin.upload.delete_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.delete'),
          style: 'destructive',
          onPress: () => deleteImageMutation.mutate(imageId),
        },
      ],
    );
  }

  // ---- Bulk delete ---------------------------------------------------------

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t('admin.upload.delete_confirm'),
      t('admin.upload.delete_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.delete'),
          style: 'destructive',
          onPress: async () => {
            for (const imgId of selectedIds) {
              await deleteImage(id, imgId);
            }
            clearSelection();
            qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(id) });
          },
        },
      ],
    );
  }

  // ---- Share link ----------------------------------------------------------

  const handleShare = useCallback(async () => {
    if (!gallery) return;
    const link = gallery.token
      ? `${API_URL}/gallery/${gallery.token}`
      : `${API_URL}/gallery/${gallery._id}`;

    await Clipboard.setStringAsync(link);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(link, { mimeType: 'text/plain', dialogTitle: t('mobileOnly.shareGallery') });
    } else {
      Alert.alert('', t('admin.galleries.link_copied'));
    }
  }, [gallery, t]);

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError || !gallery) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.galleries.error_detail')}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={gallery.title} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Title + client */}
      <Card style={styles.section}>
        <Text style={styles.clientLabel}>
          {t('admin.galleries.client')}: {clientName}
        </Text>
        <Input
          label={t('admin.galleries.title_label')}
          value={title}
          onChangeText={setTitle}
        />
        <Input
          label={t('admin.galleries.header_msg')}
          value={headerMessage}
          onChangeText={setHeaderMessage}
          multiline
          numberOfLines={2}
        />
        <Input
          label={t('admin.client.max_selections')}
          value={maxSelections}
          onChangeText={setMaxSelections}
          keyboardType="number-pad"
        />
        <Button
          title={
            updateMutation.isPending
              ? t('admin.common.saving')
              : t('admin.common.save')
          }
          onPress={handleSave}
          loading={updateMutation.isPending}
          style={styles.saveBtn}
        />
      </Card>

      {/* Status + Actions combined */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.common.status')}</Text>
        <View style={styles.statusRow}>
          <StatusBadge status={gallery.status} />
          <TouchableOpacity
            onPress={openStatusPicker}
            style={styles.changeStatusBtn}
            accessibilityRole="button"
            accessibilityLabel={t('admin.galleries.select_status')}
          >
            <Text style={styles.changeStatusText}>
              {t('admin.galleries.select_status')}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <Button
            title={
              uploading
                ? t('admin.galleries.uploading')
                : t('admin.galleries.upload')
            }
            variant="secondary"
            loading={uploading}
            onPress={handleUpload}
            style={styles.actionBtn}
            iconLeft={<Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />}
          />
          <Button
            title={t('admin.galleries.share_link')}
            variant="secondary"
            onPress={handleShare}
            style={styles.actionBtn}
            iconLeft={<Ionicons name="share-outline" size={18} color={colors.primary} />}
          />
        </View>
      </Card>

      {/* Status picker modal (web + Android) */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusPicker(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('admin.galleries.select_status')}</Text>
            {GALLERY_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.modalOption,
                  gallery.status === s && styles.modalOptionActive,
                ]}
                onPress={() => {
                  updateMutation.mutate({ status: s });
                  setShowStatusPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    gallery.status === s && styles.modalOptionTextActive,
                  ]}
                >
                  {STATUS_LABELS[s]}
                </Text>
                {gallery.status === s && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowStatusPicker(false)}
            >
              <Text style={styles.modalCancelText}>{t('admin.common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {gallery.images.length} {t('admin.galleries.images')}
        </Text>
      </View>

      {gallery.images.length === 0 ? (
        <Text style={styles.emptyText}>{t('admin.galleries.no_images')}</Text>
      ) : (
        <>
          {/* Bulk action bar */}
          {selectedIds.size > 0 ? (
            <View style={styles.bulkBar}>
              <Text style={styles.bulkCount}>{selectedIds.size} {t('admin.upload.selected')}</Text>
              <TouchableOpacity onPress={clearSelection} style={styles.bulkAction}>
                <Ionicons name="close-circle-outline" size={20} color={colors.text} />
                <Text style={styles.bulkActionText}>{t('admin.upload.clear_selection')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBulkDelete} style={styles.bulkAction}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.bulkActionText, { color: colors.error }]}>{t('admin.upload.delete_selected')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.deleteHint}>Tap to view · Long press to select</Text>
          )}

          <FlatList
            data={gallery.images}
            keyExtractor={(item) => item._id}
            numColumns={3}
            scrollEnabled={false}
            renderItem={({ item, index }) => {
              const isSelected = selectedIds.has(item._id);
              const isSelecting = selectedIds.size > 0;
              return (
                <TouchableOpacity
                  onPress={() => isSelecting ? toggleSelect(item._id) : setLightboxIndex(index)}
                  onLongPress={() => toggleSelect(item._id)}
                  delayLongPress={400}
                  activeOpacity={0.8}
                  style={[styles.imageCell, isSelected && styles.imageCellSelected]}
                  accessibilityLabel={item.filename}
                >
                  <Image
                    source={{ uri: `${API_URL}/uploads/${item.filename}` }}
                    style={styles.imageCellInner}
                    resizeMode="cover"
                  />
                  {isSelected && (
                    <View style={styles.selectedOverlay}>
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.imageGrid}
          />
        </>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={gallery.images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  backText: {
    fontSize: typography.md,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  clientLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  saveBtn: {
    marginTop: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  changeStatusText: {
    fontSize: typography.sm,
    color: colors.primary,
    fontWeight: typography.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  modalOptionActive: {
    backgroundColor: '#F9EFEE',
  },
  modalOptionText: {
    fontSize: typography.md,
    color: colors.text,
  },
  modalOptionTextActive: {
    color: colors.primary,
    fontWeight: typography.semibold,
  },
  modalCancel: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCancelText: {
    fontSize: typography.md,
    color: colors.textMuted,
  },
  imageGrid: {
    paddingBottom: spacing.xs,
  },
  imageRow: {
    marginBottom: spacing.xs,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkCount: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    flex: 1,
  },
  bulkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bulkActionText: {
    fontSize: typography.xs,
    color: colors.text,
    fontWeight: typography.medium,
  },
  imageCellSelected: {
    opacity: 0.75,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
  },
  imageCell: {
    flex: 1,
    aspectRatio: 1,
    margin: spacing.xs / 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  imageCellInner: {
    width: '100%',
    height: '100%',
  },
  deleteHint: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  errorText: {
    fontSize: typography.md,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: typography.md,
    color: colors.textOnPrimary,
    fontWeight: typography.semibold,
  },
});
