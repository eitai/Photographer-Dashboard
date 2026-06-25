/**
 * PhotoLightbox — Full-screen image viewer with horizontal swipe navigation.
 *
 * Uses react-native-reanimated + react-native-gesture-handler for smooth
 * gesture-driven swiping between images.
 *
 * Features:
 *   - Horizontal FlatList paging (simpler/more reliable than manual gestures for gallery use)
 *   - Select/deselect toggle button at the bottom
 *   - Blush accent on selected state
 *   - Close button top-left
 *   - Photo counter top-right (e.g. "3 / 24")
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, typography, radius } from '../../theme';
import type { PhotoGridImage } from './PhotoGrid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhotoLightboxProps {
  images: PhotoGridImage[];
  initialIndex: number;
  visible: boolean;
  selectedIds: Set<string>;
  selectable?: boolean;
  onClose: () => void;
  onToggleSelect?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

function resolveUrl(image: PhotoGridImage): string {
  // Prefer full path over thumbnail in lightbox
  const src = image.path ?? image.thumbnailPath;
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return `${API_BASE}${src}`;
}

// ---------------------------------------------------------------------------
// Single image slide
// ---------------------------------------------------------------------------

interface SlideProps {
  image: PhotoGridImage;
}

const Slide = React.memo(function Slide({ image }: SlideProps) {
  return (
    <View style={styles.slide}>
      <Image
        source={{ uri: resolveUrl(image) }}
        style={styles.slideImage}
        contentFit="contain"
        transition={100}
        recyclingKey={image._id}
      />
    </View>
  );
});

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

export function PhotoLightbox({
  images,
  initialIndex,
  visible,
  selectedIds,
  selectable = false,
  onClose,
  onToggleSelect,
}: PhotoLightboxProps) {
  const flatListRef = useRef<FlatList<PhotoGridImage>>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Sync scroll position when lightbox opens or initialIndex changes
  useEffect(() => {
    if (visible && images.length > 0) {
      setCurrentIndex(initialIndex);
      // Delay to ensure FlatList is mounted
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 50);
    }
  }, [visible, initialIndex, images.length]);

  const currentImage = images[currentIndex];
  const isSelected = currentImage ? selectedIds.has(currentImage._id) : false;

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderSlide: ListRenderItem<PhotoGridImage> = useCallback(
    ({ item }) => <Slide image={item} />,
    [],
  );

  const keyExtractor = useCallback((item: PhotoGridImage) => item._id, []);

  const handleToggleSelect = useCallback(() => {
    if (currentImage && onToggleSelect) {
      onToggleSelect(currentImage._id);
    }
  }, [currentImage, onToggleSelect]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.headerButtonText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* ── Image pager ─────────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderSlide}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          initialScrollIndex={initialIndex}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={3}
        />

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {selectable && currentImage && (
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleToggleSelect}
              style={[
                styles.selectButton,
                isSelected && styles.selectButtonSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isSelected ? 'Deselect photo' : 'Select photo'}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  isSelected && styles.selectButtonTextSelected,
                ]}
              >
                {isSelected ? '✓  Selected' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightbox,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(26, 26, 26, 0.6)',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerButtonText: {
    color: colors.textOnDark,
    fontSize: typography.lg,
    fontWeight: typography.semibold,
  },
  counter: {
    color: colors.textOnDark,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    opacity: 0.85,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  selectButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectButtonText: {
    color: colors.textOnDark,
    fontSize: typography.md,
    fontWeight: typography.semibold,
    letterSpacing: 0.5,
  },
  selectButtonTextSelected: {
    color: colors.charcoal,
  },
});
