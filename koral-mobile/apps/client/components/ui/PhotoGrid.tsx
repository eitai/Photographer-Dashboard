/**
 * PhotoGrid — 3-column image grid using expo-image for performance.
 *
 * Each cell shows a thumbnail. When `selectable` is true, tapping a cell
 * calls `onSelect(imageId)`. Selected cells render a Blush ring border and a
 * checkmark badge so the user has clear visual feedback.
 *
 * Long-press calls `onLongPress(imageId)` (used in delivery mode to trigger save).
 */

import React, { useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Dimensions,
  type ListRenderItem,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, radius } from '../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoGridImage {
  _id: string;
  /** Thumbnail URL (preferred) or full URL */
  thumbnailPath?: string;
  path: string;
  originalName?: string;
}

interface PhotoGridProps {
  images: PhotoGridImage[];
  selectedIds?: Set<string>;
  selectable?: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onPressImage?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLUMNS = 3;
const GAP = 2;
const CELL_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

function resolveUrl(image: PhotoGridImage): string {
  const src = image.thumbnailPath ?? image.path;
  if (src.startsWith('http')) return src;
  return `${API_BASE}${src}`;
}

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

interface CellProps {
  image: PhotoGridImage;
  index: number;
  isSelected: boolean;
  selectable: boolean;
  onSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
  onPress?: (index: number) => void;
}

const Cell = React.memo(function Cell({
  image,
  index,
  isSelected,
  selectable,
  onSelect,
  onLongPress,
  onPress,
}: CellProps) {
  const handlePress = useCallback(() => {
    if (selectable && onSelect) {
      onSelect(image._id);
    } else if (onPress) {
      onPress(index);
    }
  }, [selectable, onSelect, onPress, image._id, index]);

  const handleLongPress = useCallback(() => {
    if (onLongPress) onLongPress(image._id);
  }, [onLongPress, image._id]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      accessibilityRole="imagebutton"
      accessibilityLabel={image.originalName ?? `Photo ${index + 1}`}
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.cell,
        isSelected && styles.cellSelected,
      ]}
    >
      <Image
        source={{ uri: resolveUrl(image) }}
        style={styles.image}
        contentFit="cover"
        transition={200}
        recyclingKey={image._id}
      />
      {isSelected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      )}
      {isSelected && <View style={styles.selectionOverlay} />}
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function PhotoGrid({
  images,
  selectedIds = new Set(),
  selectable = false,
  onSelect,
  onLongPress,
  onPressImage,
}: PhotoGridProps) {
  const renderItem: ListRenderItem<PhotoGridImage> = useCallback(
    ({ item, index }) => (
      <Cell
        image={item}
        index={index}
        isSelected={selectedIds.has(item._id)}
        selectable={selectable}
        onSelect={onSelect}
        onLongPress={onLongPress}
        onPress={onPressImage}
      />
    ),
    [selectedIds, selectable, onSelect, onLongPress, onPressImage],
  );

  const keyExtractor = useCallback(
    (item: PhotoGridImage) => item._id,
    [],
  );

  return (
    <FlatList
      data={images}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={30}
      maxToRenderPerBatch={30}
      windowSize={5}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GAP,
    paddingTop: GAP,
    paddingBottom: spacing.xxl,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellSelected: {
    borderColor: colors.selectionRing,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(231, 184, 181, 0.20)',
  },
  checkBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  checkmark: {
    color: colors.charcoal,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
