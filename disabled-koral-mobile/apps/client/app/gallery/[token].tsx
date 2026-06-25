/**
 * Gallery screen — the core of the client app.
 *
 * Fetches a gallery by its public access token (no auth required).
 * Renders different UI depending on gallery status:
 *
 *   gallery_sent / viewed  → SelectionUI  (browse + select + submit)
 *   selection_submitted    → ThankYouView (already submitted)
 *   in_editing             → EditingView  (in progress message)
 *   delivered              → DeliveryUI  (download photos)
 *
 * API endpoints confirmed from backend routes:
 *   GET  /api/galleries/token/:token          — fetch gallery (marks viewed on first open)
 *   GET  /api/galleries/:galleryId/images     — fetch images (public)
 *   POST /api/galleries/:galleryId/submit     — submit selection (public)
 *   (save to camera roll via expo-media-library — no API needed)
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { useLanguage } from '@koral/i18n';
import type { GalleryStatus } from '@koral/types';

import { PhotoGrid, type PhotoGridImage } from '../../components/ui/PhotoGrid';
import { PhotoLightbox } from '../../components/ui/PhotoLightbox';
import { colors, spacing, typography, radius, shadows } from '../../theme';

// ---------------------------------------------------------------------------
// API types (matching backend models)
// ---------------------------------------------------------------------------

interface GalleryData {
  _id: string;
  name: string;
  headerMessage?: string;
  status: GalleryStatus;
  maxSelections?: number;
  isDelivery?: boolean;
  clientName?: string;
  adminId: string;
}

interface ImagesResponse {
  images?: PhotoGridImage[];
  total?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

const QUERY_KEYS = {
  gallery: (token: string) => ['gallery', token] as const,
  images: (galleryId: string) => ['gallery-images', galleryId] as const,
};

// ---------------------------------------------------------------------------
// API helpers (public — no auth token needed)
// ---------------------------------------------------------------------------

async function fetchGalleryByToken(token: string): Promise<GalleryData> {
  const res = await axios.get<GalleryData>(`${API_BASE}/api/galleries/token/${token}`);
  return res.data;
}

async function fetchImages(galleryId: string): Promise<PhotoGridImage[]> {
  const res = await axios.get<ImagesResponse | PhotoGridImage[]>(
    `${API_BASE}/api/galleries/${galleryId}/images`,
  );
  // Handle both response shapes: plain array or { images, total }
  if (Array.isArray(res.data)) return res.data;
  return res.data.images ?? [];
}

interface SubmitPayload {
  galleryId: string;
  sessionId: string;
  selectedImageIds: string[];
  heroImageId?: string;
  clientMessage?: string;
}

async function submitSelection(payload: SubmitPayload): Promise<unknown> {
  const res = await axios.post(
    `${API_BASE}/api/galleries/${payload.galleryId}/submit`,
    {
      sessionId: payload.sessionId,
      selectedImageIds: payload.selectedImageIds,
      heroImageId: payload.heroImageId,
      clientMessage: payload.clientMessage,
    },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Stable session ID (per app session, not persisted — sufficient for dedup)
// ---------------------------------------------------------------------------

const SESSION_ID = `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

function LoadingView() {
  return (
    <View style={styles.centeredFill}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function ErrorView({ message }: { message: string }) {
  const { t } = useLanguage();
  return (
    <View style={styles.centeredFill}>
      <Text style={styles.errorIcon}>⚠</Text>
      <Text style={styles.errorTitle}>{t('gallery.not_found')}</Text>
      <Text style={styles.errorBody}>{message}</Text>
    </View>
  );
}

function ThankYouView() {
  const { t } = useLanguage();
  return (
    <View style={styles.centeredFill}>
      <Text style={styles.statusIcon}>🤍</Text>
      <Text style={styles.statusTitle}>{t('gallery.thank_you')}</Text>
      <Text style={styles.statusBody}>{t('gallery.review_choices')}</Text>
    </View>
  );
}

function EditingView() {
  const { t } = useLanguage();
  return (
    <View style={styles.centeredFill}>
      <Text style={styles.statusIcon}>✦</Text>
      <Text style={styles.statusTitle}>{t('client.editing.title')}</Text>
      <Text style={styles.statusBody}>{t('client.editing.body')}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Selection submitted confirmation screen (shown after successful submit)
// ---------------------------------------------------------------------------

function SelectionConfirmedView() {
  const { t } = useLanguage();
  return (
    <View style={styles.centeredFill}>
      <Text style={styles.statusIcon}>🤍</Text>
      <Text style={styles.statusTitle}>{t('gallery.thank_you')}</Text>
      <Text style={styles.statusBody}>{t('gallery.review_choices')}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SelectionUI
// ---------------------------------------------------------------------------

interface SelectionUIProps {
  gallery: GalleryData;
  images: PhotoGridImage[];
  onSubmitted: () => void;
}

function SelectionUI({ gallery, images, onSubmitted }: SelectionUIProps) {
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clientMessage, setClientMessage] = useState('');

  const maxSelections = gallery.maxSelections ?? Infinity;
  const selectedCount = selectedIds.size;
  const hasMax = gallery.maxSelections != null && gallery.maxSelections > 0;

  const mutation = useMutation({
    mutationFn: submitSelection,
    onSuccess: () => {
      setShowConfirm(false);
      onSubmitted();
    },
    onError: (err: unknown) => {
      setShowConfirm(false);
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : t('contact.error');
      Alert.alert(t('gallery.not_found'), message);
    },
  });

  const handleToggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (hasMax && next.size >= maxSelections) {
            Alert.alert('', t('gallery.max_reached'));
            return prev;
          }
          next.add(id);
        }
        return next;
      });
    },
    [hasMax, maxSelections, t],
  );

  const handlePressImage = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedCount === 0) {
      Alert.alert('', t('gallery.select_photo'));
      return;
    }
    setShowConfirm(true);
  }, [selectedCount, t]);

  const handleConfirmSubmit = useCallback(() => {
    mutation.mutate({
      galleryId: gallery._id,
      sessionId: SESSION_ID,
      selectedImageIds: Array.from(selectedIds),
      heroImageId: selectedIds.size > 0 ? Array.from(selectedIds)[0] : undefined,
      clientMessage: clientMessage.trim() || undefined,
    });
  }, [mutation, gallery._id, selectedIds, clientMessage]);

  const counterLabel = useMemo(() => {
    if (hasMax) {
      return `${selectedCount} ${t('gallery.select_of')} ${maxSelections} ${t('gallery.images_selected')}`;
    }
    return `${selectedCount} ${t('gallery.images_selected')}`;
  }, [selectedCount, hasMax, maxSelections, t]);

  return (
    <View style={styles.fill}>
      {/* Image grid */}
      {images.length === 0 ? (
        <View style={styles.centeredFill}>
          <Text style={styles.emptyText}>{t('gallery.no_images')}</Text>
        </View>
      ) : (
        <PhotoGrid
          images={images}
          selectedIds={selectedIds}
          selectable
          onSelect={handleToggleSelect}
          onPressImage={handlePressImage}
        />
      )}

      {/* Sticky bottom bar */}
      {images.length > 0 && (
        <View style={styles.bottomBar}>
          <Text style={styles.counterText}>{counterLabel}</Text>
          <TouchableOpacity
            style={[
              styles.submitButton,
              selectedCount === 0 && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={selectedCount === 0 || mutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('gallery.send_selection')}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color={colors.charcoal} />
            ) : (
              <Text style={styles.submitButtonText}>{t('gallery.send_selection')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Lightbox */}
      <PhotoLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        selectedIds={selectedIds}
        selectable
        onClose={() => setLightboxIndex(null)}
        onToggleSelect={handleToggleSelect}
      />

      {/* Confirmation dialog */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('gallery.send_selection')}</Text>
            <Text style={styles.modalBody}>
              {selectedCount} {t('gallery.images_selected')}
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder={t('client.selection.message_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={clientMessage}
              onChangeText={setClientMessage}
              multiline
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.modalCancelText}>{t('admin.common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleConfirmSubmit}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.charcoal} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t('gallery.send_selection')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DeliveryUI
// ---------------------------------------------------------------------------

interface DeliveryUIProps {
  images: PhotoGridImage[];
}

function DeliveryUI({ images }: DeliveryUIProps) {
  const { t } = useLanguage();
  const [savingAll, setSavingAll] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  async function requestPermission(): Promise<boolean> {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('', t('client.delivery.permission_denied'));
      return false;
    }
    return true;
  }

  /** Downloads one image to the device cache and saves it to the media library. */
  async function downloadAndSave(image: PhotoGridImage): Promise<void> {
    const src = image.path;
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg';
    const localUri = `${FileSystem.cacheDirectory}koral_${image._id}.${ext}`;
    const { uri } = await FileSystem.downloadAsync(url, localUri);
    await MediaLibrary.saveToLibraryAsync(uri);
  }

  const handleSaveOne = useCallback(
    async (id: string) => {
      const image = images.find((img) => img._id === id);
      if (!image) return;
      const allowed = await requestPermission();
      if (!allowed) return;
      try {
        await downloadAndSave(image);
        Alert.alert('', t('mobileOnly.saveToGallery'));
      } catch {
        Alert.alert('', t('contact.error'));
      }
    },
    [images, t],
  );

  const handleSaveAll = useCallback(async () => {
    const allowed = await requestPermission();
    if (!allowed) return;
    setSavingAll(true);
    try {
      for (const image of images) {
        await downloadAndSave(image);
      }
      Alert.alert('', `${images.length} ${t('gallery.images_selected')} — ${t('mobileOnly.saveToGallery')}`);
    } catch {
      Alert.alert('', t('contact.error'));
    } finally {
      setSavingAll(false);
    }
  }, [images, t]);

  return (
    <View style={styles.fill}>
      <PhotoGrid
        images={images}
        selectable={false}
        onLongPress={handleSaveOne}
        onPressImage={(index) => setLightboxIndex(index)}
      />

      {/* Save all button */}
      {images.length > 0 && (
        <View style={styles.bottomBar}>
          <Text style={styles.counterText}>
            {images.length} {t('gallery.images_selected')}
          </Text>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSaveAll}
            disabled={savingAll}
            accessibilityRole="button"
            accessibilityLabel={t('client.delivery.save_all')}
          >
            {savingAll ? (
              <ActivityIndicator size="small" color={colors.charcoal} />
            ) : (
              <Text style={styles.submitButtonText}>{t('client.delivery.save_all')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Lightbox (delivery — not selectable) */}
      <PhotoLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        selectedIds={new Set()}
        selectable={false}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GalleryScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);

  // Fetch gallery metadata
  const galleryQuery = useQuery({
    queryKey: QUERY_KEYS.gallery(token),
    queryFn: () => fetchGalleryByToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  // Fetch images (only once gallery is loaded)
  const imagesQuery = useQuery({
    queryKey: QUERY_KEYS.images(galleryQuery.data?._id ?? ''),
    queryFn: () => fetchImages(galleryQuery.data!._id),
    enabled: Boolean(galleryQuery.data?._id),
    staleTime: 1000 * 60 * 10,
  });

  const gallery = galleryQuery.data;
  const images = imagesQuery.data ?? [];

  // ── Determine effective status (local submitted state overrides server)
  const effectiveStatus: GalleryStatus | null = submitted
    ? 'selection_submitted'
    : gallery?.status ?? null;

  // ── Render
  const renderContent = () => {
    if (galleryQuery.isPending) return <LoadingView />;

    if (galleryQuery.isError) {
      return (
        <ErrorView
          message={
            axios.isAxiosError(galleryQuery.error) &&
            galleryQuery.error.response?.status === 404
              ? t('gallery.link_expired')
              : t('gallery.not_found')
          }
        />
      );
    }

    if (!gallery) return <LoadingView />;

    if (effectiveStatus === 'selection_submitted') {
      return submitted ? <SelectionConfirmedView /> : <ThankYouView />;
    }

    if (effectiveStatus === 'in_editing') {
      return <EditingView />;
    }

    if (effectiveStatus === 'delivered') {
      if (imagesQuery.isPending) return <LoadingView />;
      return <DeliveryUI images={images} />;
    }

    // gallery_sent or viewed → selection flow
    if (imagesQuery.isPending) return <LoadingView />;
    return (
      <SelectionUI
        gallery={gallery}
        images={images}
        onSubmitted={() => setSubmitted(true)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />

      {/* Header */}
      {gallery && (
        <View style={styles.header}>
          <Text style={styles.galleryName} numberOfLines={1}>
            {gallery.name}
          </Text>
          {gallery.headerMessage ? (
            <Text style={styles.headerMessage} numberOfLines={2}>
              {gallery.headerMessage}
            </Text>
          ) : null}
        </View>
      )}

      {/* Body */}
      <View style={styles.fill}>{renderContent()}</View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  centeredFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  galleryName: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.charcoal,
  },
  headerMessage: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: typography.sm * typography.relaxed,
  },

  // ── Error / status views ──────────────────────────────────────────────────
  errorIcon: {
    fontSize: 36,
    marginBottom: spacing.md,
    color: colors.error,
  },
  errorTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorBody: {
    fontSize: typography.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.sm * typography.relaxed,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  statusTitle: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.charcoal,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statusBody: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.md * typography.relaxed,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Bottom action bar ─────────────────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sm,
  },
  counterText: {
    fontSize: typography.sm,
    color: colors.textMuted,
    flex: 1,
    marginRight: spacing.sm,
  },
  submitButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.charcoal,
  },

  // ── Confirm modal ─────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.charcoal,
    marginBottom: spacing.xs,
  },
  modalBody: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  messageInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
    color: colors.textMuted,
  },
  modalConfirm: {
    flex: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalConfirmText: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: colors.charcoal,
  },
});
