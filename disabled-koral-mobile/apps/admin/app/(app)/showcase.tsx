import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGalleries, getSettings, updateFeaturedImages } from '@koral/api';
import type { Gallery, GalleryImage } from '@koral/types';
import type { SiteSettings } from '@koral/api';
import { useLanguage } from '@koral/i18n';
import { Ionicons } from '@expo/vector-icons';
import { Button, Header } from '../../components/ui';
import { colors, spacing, typography, radius, shadows } from '../../theme';

const QUERY_KEYS = {
  galleries: ['galleries'] as const,
  settings: ['settings'] as const,
};

const COLUMN_COUNT = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE =
  (SCREEN_WIDTH - spacing.md * 2 - spacing.xs * (COLUMN_COUNT - 1)) /
  COLUMN_COUNT;

// ---------------------------------------------------------------------------
// Image tile
// ---------------------------------------------------------------------------

interface ImageTileProps {
  image: GalleryImage;
  isFeatured: boolean;
  onToggle: (id: string) => void;
  baseUrl: string;
}

function ImageTile({ image, isFeatured, onToggle, baseUrl }: ImageTileProps) {
  const imageUrl = image.url.startsWith('http')
    ? image.url
    : `${baseUrl}${image.url}`;

  return (
    <TouchableOpacity
      onPress={() => onToggle(image._id)}
      accessibilityRole="button"
      accessibilityLabel={image.filename}
      accessibilityState={{ selected: isFeatured }}
      style={styles.tile}
    >
      <Image
        source={{ uri: imageUrl }}
        style={styles.tileImage}
        contentFit="cover"
        transition={150}
      />
      {isFeatured && (
        <View style={styles.tileOverlay}>
          <Ionicons name="star" size={20} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

export default function ShowcaseScreen() {
  const { t } = useLanguage();
  const qc = useQueryClient();

  const {
    data: galleries = [],
    isLoading: galleriesLoading,
    isError: galleriesError,
    refetch: refetchGalleries,
  } = useQuery<Gallery[]>({
    queryKey: QUERY_KEYS.galleries,
    queryFn: getGalleries,
  });

  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery<SiteSettings>({
    queryKey: QUERY_KEYS.settings,
    queryFn: getSettings,
  });

  // Local selection state — starts from whatever the server has
  const initialFeaturedIds = useMemo<string[]>(
    () => (settings?.featuredImages ?? []).map((img) => img._id),
    [settings],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = React.useState(false);
  const [search, setSearch] = useState('');

  // Sync local state once settings load
  React.useEffect(() => {
    if (!initialized && settings) {
      setSelectedIds(new Set(initialFeaturedIds));
      setInitialized(true);
    }
  }, [settings, initialized, initialFeaturedIds]);

  const saveMutation = useMutation({
    mutationFn: (ids: string[]) => updateFeaturedImages(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.settings });
      Alert.alert('', t('admin.showcase.save_success'));
    },
    onError: () => {
      Alert.alert('', t('admin.showcase.save_error'));
    },
  });

  // Flatten all images from all galleries, optionally filtered by gallery name
  const allImages = useMemo<Array<{ image: GalleryImage; galleryTitle: string }>>(() => {
    const q = search.trim().toLowerCase();
    return galleries
      .filter((g) => !q || g.title.toLowerCase().includes(q))
      .flatMap((g) => g.images.map((img) => ({ image: img, galleryTitle: g.title })));
  }, [galleries, search]);

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSave() {
    saveMutation.mutate(Array.from(selectedIds));
  }

  const isLoading = galleriesLoading || settingsLoading;
  const isError = galleriesError || settingsError;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('admin.showcase.loading')}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('admin.showcase.error')}</Text>
        <TouchableOpacity
          onPress={() => {
            refetchGalleries();
            refetchSettings();
          }}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>{t('admin.common.error_retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={t('admin.showcase.title')} onBack />
      {/* Subtitle + filter */}
      <View style={styles.header}>
        <Text style={styles.subtitle}>
          {selectedIds.size} {t('admin.showcase.featured')}
        </Text>

        {/* Gallery search / filter */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('admin.showcase.search_placeholder')}
            placeholderTextColor={colors.textMuted}
            clearButtonMode="while-editing"
            returnKeyType="search"
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {allImages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('admin.showcase.no_images')}</Text>
        </View>
      ) : (
        <FlatList
          data={allImages}
          keyExtractor={(item) => item.image._id}
          numColumns={COLUMN_COUNT}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ImageTile
              image={item.image}
              isFeatured={selectedIds.has(item.image._id)}
              onToggle={handleToggle}
              baseUrl={API_BASE}
            />
          )}
        />
      )}

      {/* Sticky save button */}
      <View style={styles.footer}>
        <Button
          title={
            saveMutation.isPending
              ? t('admin.showcase.saving')
              : t('admin.showcase.save')
          }
          onPress={handleSave}
          loading={saveMutation.isPending}
        />
      </View>
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
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: typography.md,
    color: colors.text,
  },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.md,
    color: colors.text,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  columnWrapper: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  tile: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  tileImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  tileOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.full,
    padding: 4,
    ...shadows.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.md,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
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
