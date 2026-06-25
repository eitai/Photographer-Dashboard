import React, { useCallback } from 'react';
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
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSelection, getGallery, updateGallery, getClients, deleteSubmission } from '@koral/api';
import type { Gallery, GalleryImage, Client } from '@koral/types';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header } from '../../../components/ui';
import { colors, spacing, typography, radius } from '../../../theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

const QUERY_KEYS = {
  gallery: (id: string) => ['gallery', id] as const,
  selection: (id: string) => ['selection', id] as const,
  clients: ['clients'] as const,
};

// ---------------------------------------------------------------------------
// Types — the selection API response shape
// ---------------------------------------------------------------------------

interface SelectionResponse {
  _id: string;
  galleryId: string;
  selectedImages: GalleryImage[];
  heroImageId?: string;
  comment?: string;
  submittedAt?: string;
}

// ---------------------------------------------------------------------------
// Image cell
// ---------------------------------------------------------------------------

const CELL_SIZE = 110;

interface SelectionImageCellProps {
  image: GalleryImage;
  isHero: boolean;
}

function SelectionImageCell({ image, isHero }: SelectionImageCellProps) {
  const { t } = useLanguage();
  const uri = `${API_URL}/uploads/${image.filename}`;

  return (
    <View style={styles.cellWrapper}>
      <Image
        source={{ uri }}
        style={styles.imageCell}
        resizeMode="cover"
        accessibilityLabel={image.filename}
      />
      {isHero && (
        <View style={styles.heroBadge} accessibilityLabel={t('admin.selections.hero')}>
          <Ionicons name="star" size={14} color={colors.textOnPrimary} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SelectionDetailScreen() {
  const { galleryId } = useLocalSearchParams<{ galleryId: string }>();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const {
    data: gallery,
    isLoading: galleryLoading,
  } = useQuery<Gallery>({
    queryKey: QUERY_KEYS.gallery(galleryId),
    queryFn: () => getGallery(galleryId),
    enabled: !!galleryId,
  });

  const {
    data: selection,
    isLoading: selectionLoading,
    isError,
    refetch,
  } = useQuery<SelectionResponse>({
    queryKey: QUERY_KEYS.selection(galleryId),
    queryFn: () => getSelection(galleryId) as Promise<SelectionResponse>,
    enabled: !!galleryId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: QUERY_KEYS.clients,
    queryFn: getClients,
  });

  const markEditingMutation = useMutation({
    mutationFn: () => updateGallery(galleryId, { status: 'in_editing' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(galleryId) });
      qc.invalidateQueries({ queryKey: ['galleries'] });
      Alert.alert('', t('admin.status.in_editing'));
    },
  });

  const deleteSubmissionMutation = useMutation({
    mutationFn: () => deleteSubmission(galleryId, selection!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.selection(galleryId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.gallery(galleryId) });
      qc.invalidateQueries({ queryKey: ['galleries'] });
      router.back();
    },
    onError: () => Alert.alert('', t('admin.selections.error')),
  });

  const clientName = clients.find((c) => c._id === gallery?.clientId)?.name ?? '—';

  const handleMarkEditing = useCallback(() => {
    Alert.alert(
      t('admin.selections.mark_editing'),
      undefined,
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.confirm'),
          onPress: () => markEditingMutation.mutate(),
        },
      ],
    );
  }, [markEditingMutation, t]);

  const handleShareList = useCallback(async () => {
    if (!selection?.selectedImages) return;
    const urls = selection.selectedImages
      .map((img) => `${API_URL}/uploads/${img.filename}`)
      .join('\n');
    const text = `${gallery?.title ?? ''} — ${t('admin.selections.images_selected')}:\n\n${urls}`;
    try {
      await Share.share({ message: text });
    } catch {
      // user dismissed — no-op
    }
  }, [selection, gallery, t]);

  const handleDeleteSubmission = useCallback(() => {
    if (!selection) return;
    Alert.alert(
      t('admin.selections.delete_sub_confirm'),
      t('admin.selections.delete_sub_body'),
      [
        { text: t('admin.common.cancel'), style: 'cancel' },
        {
          text: t('admin.common.delete'),
          style: 'destructive',
          onPress: () => deleteSubmissionMutation.mutate(),
        },
      ],
    );
  }, [selection, deleteSubmissionMutation, t]);

  const isLoading = galleryLoading || selectionLoading;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.selections.error_detail')}</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedImages = selection?.selectedImages ?? [];

  return (
    <View style={styles.container}>
      <Header title={t('admin.selections.title')} onBack />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Info card */}
      <Card style={styles.infoCard}>
        <Text style={styles.galleryTitle}>{gallery?.title}</Text>
        <Text style={styles.clientLabel}>
          {t('admin.selections.client')}: {clientName}
        </Text>
        <Text style={styles.imageCount}>
          {selectedImages.length} {t('admin.selections.images_selected')}
        </Text>
        {selection?.submittedAt && (
          <Text style={styles.date}>
            {t('admin.selections.submitted')}: {new Date(selection.submittedAt).toLocaleDateString()}
          </Text>
        )}
      </Card>

      {/* Client comment */}
      {!!selection?.comment && (
        <Card style={styles.commentCard}>
          <Text style={styles.commentLabel}>{t('admin.selections.comment')}</Text>
          <Text style={styles.commentText}>{selection.comment}</Text>
        </Card>
      )}

      {/* Image grid */}
      {selectedImages.length === 0 ? (
        <Text style={styles.emptyText}>{t('admin.selections.no_selection')}</Text>
      ) : (
        <FlatList
          data={selectedImages}
          keyExtractor={(item) => item._id}
          numColumns={3}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <SelectionImageCell
              image={item}
              isHero={item._id === selection?.heroImageId}
            />
          )}
          columnWrapperStyle={styles.imageRow}
          contentContainerStyle={styles.imageGrid}
        />
      )}

      {/* Actions */}
      <View style={styles.actionsSection}>
        <Button
          title={
            markEditingMutation.isPending
              ? t('admin.selections.marking')
              : t('admin.selections.mark_editing')
          }
          onPress={handleMarkEditing}
          loading={markEditingMutation.isPending}
          disabled={gallery?.status === 'in_editing' || gallery?.status === 'delivered'}
        />
        <Button
          title={t('admin.selections.share_list')}
          variant="secondary"
          onPress={handleShareList}
          iconLeft={<Ionicons name="share-outline" size={18} color={colors.primary} />}
        />
        {!!selection && (
          <Button
            title={
              deleteSubmissionMutation.isPending
                ? t('admin.selections.deleting')
                : t('admin.selections.delete_submission')
            }
            variant="ghost"
            onPress={handleDeleteSubmission}
            loading={deleteSubmissionMutation.isPending}
          />
        )}
      </View>
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
  infoCard: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  galleryTitle: {
    fontSize: typography.lg,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  clientLabel: {
    fontSize: typography.sm,
    color: colors.textMuted,
  },
  imageCount: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: typography.medium,
  },
  date: {
    fontSize: typography.xs,
    color: colors.textMuted,
  },
  commentCard: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  commentLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  commentText: {
    fontSize: typography.md,
    color: colors.text,
    lineHeight: Math.round(typography.md * typography.relaxed),
  },
  imageGrid: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  imageRow: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cellWrapper: {
    position: 'relative',
  },
  imageCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  heroBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: 3,
  },
  actionsSection: {
    gap: spacing.sm,
    marginTop: spacing.md,
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
