/**
 * PhotoGallery — Multi-photo management for Property / Unit entities.
 *
 * Features:
 * - Horizontal RTL slider with dots
 * - Fullscreen modal viewer with RTL swipe
 * - Upload multiple photos via ImagePicker
 * - Set main (thumbnail) photo
 * - Delete photos with confirmation
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, Modal, Alert, ActivityIndicator,
  FlatList, ViewToken, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import type { EntityPhoto } from '../../domain/models';
import {
  lightColors, darkColors, spacing, fontSize, fontWeight, radius,
} from '../../constants/DesignTokens';
import { useAppTheme } from '../../hooks/useAppTheme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GALLERY_H  = 240;
const THUMB_SIZE = 72;

interface PhotoGalleryProps {
  entityType: 'property' | 'unit';
  entityId:   string;
  photos:     EntityPhoto[];
  editable?:  boolean;
  onAdd?:     (uri: string) => void;
  onRemove?:  (photoId: string) => void;
  onSetMain?: (photoId: string) => void;
}

export function PhotoGallery({
  entityType, entityId, photos, editable = true,
  onAdd, onRemove, onSetMain,
}: PhotoGalleryProps) {
  const { colors } = useAppTheme();

  const [activeIdx,   setActiveIdx]   = useState(0);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [fsIdx,       setFsIdx]       = useState(0);
  const [uploading,   setUploading]   = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null); // photoId

  const sliderRef   = useRef<FlatList<EntityPhoto>>(null);
  const fsSliderRef = useRef<FlatList<EntityPhoto>>(null);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'إذن مطلوب',
        'يرجى الذهاب إلى الإعدادات والسماح للتطبيق بالوصول إلى مكتبة الصور.',
        [{ text: 'حسناً' }],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      for (const asset of result.assets) {
        if (asset.uri) onAdd?.(asset.uri);
      }
    } finally {
      setUploading(false);
    }
  }, [onAdd]);

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'إذن مطلوب',
        'يرجى الذهاب إلى الإعدادات والسماح للتطبيق باستخدام الكاميرا.',
        [{ text: 'حسناً' }],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    onAdd?.(result.assets[0].uri);
  }, [onAdd]);

  const showUploadOptions = () => {
    if (Platform.OS === 'web') {
      pickImage();
      return;
    }
    Alert.alert('إضافة صورة', 'اختر مصدر الصورة', [
      { text: 'مكتبة الصور',  onPress: pickImage },
      { text: 'الكاميرا',     onPress: openCamera },
      { text: 'إلغاء',        style: 'cancel' },
    ]);
  };

  // ── Viewable tracker ────────────────────────────────────────────────────────

  const onViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setActiveIdx(viewableItems[0].index);
  }).current;

  const onFsViewableChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setFsIdx(viewableItems[0].index);
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const openFullscreen = (idx: number) => {
    setFsIdx(idx);
    setFullscreen(true);
    setTimeout(() => {
      fsSliderRef.current?.scrollToIndex({ index: idx, animated: false });
    }, 50);
  };

  const confirmDelete = (photo: EntityPhoto) => {
    const doDelete = () => {
      onRemove?.(photo.id);
      setShowActions(null);
      if (activeIdx >= photos.length - 1) setActiveIdx(Math.max(0, photos.length - 2));
    };
    if (Platform.OS === 'web') {
      if (window.confirm('هل تريد حذف هذه الصورة؟')) doDelete();
      return;
    }
    Alert.alert('حذف الصورة', 'هل تريد حذف هذه الصورة؟', [
      { text: 'إلغاء',  style: 'cancel' },
      { text: 'حذف',    style: 'destructive', onPress: doDelete },
    ]);
  };

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (photos.length === 0) {
    return (
      <TouchableOpacity
        onPress={editable ? showUploadOptions : undefined}
        style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.75}
      >
        {uploading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primarySubtle }]}>
              <Ionicons name="camera-outline" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد صور</Text>
            {editable && (
              <Text style={[styles.emptyHint, { color: colors.textMuted }]}>اضغط لإضافة صور</Text>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }

  // ── Main slider ─────────────────────────────────────────────────────────────

  const renderSlideItem = ({ item, index }: { item: EntityPhoto; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => openFullscreen(index)}
      onLongPress={() => editable && setShowActions(item.id)}
      style={{ width: SCREEN_W }}
    >
      <Image source={{ uri: item.uri }} style={styles.slideImage} resizeMode="cover" />
      {/* Main badge */}
      {item.isMain && (
        <View style={[styles.mainBadge, { backgroundColor: colors.primary }]}>
          <Ionicons name="star" size={10} color="#FFF" />
          <Text style={styles.mainBadgeText}>رئيسية</Text>
        </View>
      )}
      {/* Caption */}
      {item.caption ? (
        <View style={[styles.captionBox, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View>
      {/* ── Slider ── */}
      <View style={[styles.sliderWrap, { height: GALLERY_H }]}>
        <FlatList
          ref={sliderRef}
          data={photos}
          keyExtractor={p => p.id}
          renderItem={renderSlideItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableChanged}
          viewabilityConfig={viewConfig}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        />

        {/* Expand icon */}
        <TouchableOpacity
          style={[styles.expandBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={() => openFullscreen(activeIdx)}
        >
          <Ionicons name="expand-outline" size={18} color="#FFF" />
        </TouchableOpacity>

        {/* Photo count */}
        <View style={[styles.countBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Text style={styles.countText}>{activeIdx + 1} / {photos.length}</Text>
        </View>

        {/* Dots */}
        {photos.length > 1 && (
          <View style={styles.dotsRow}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === activeIdx ? '#FFF' : 'rgba(255,255,255,0.45)' },
                  i === activeIdx && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Thumbnails strip ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.thumbStrip, { backgroundColor: colors.surface }]}
        contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
      >
        {photos.map((photo, idx) => (
          <TouchableOpacity
            key={photo.id}
            onPress={() => {
              setActiveIdx(idx);
              sliderRef.current?.scrollToIndex({ index: idx, animated: true });
            }}
            onLongPress={() => editable && setShowActions(photo.id)}
            style={[
              styles.thumb,
              { borderColor: idx === activeIdx ? colors.primary : colors.border },
              photo.isMain && { borderColor: '#F39C12', borderWidth: 2.5 },
            ]}
          >
            <Image source={{ uri: photo.uri }} style={styles.thumbImage} resizeMode="cover" />
            {photo.isMain && (
              <View style={[styles.thumbStar, { backgroundColor: '#F39C12' }]}>
                <Ionicons name="star" size={9} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Add button */}
        {editable && (
          <TouchableOpacity
            onPress={showUploadOptions}
            style={[styles.addThumbBtn, { backgroundColor: colors.primarySubtle, borderColor: colors.primary }]}
          >
            {uploading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="add" size={24} color={colors.primary} />
            }
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Photo actions bottom sheet ── */}
      <Modal
        visible={!!showActions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActions(null)}
      >
        <TouchableOpacity
          style={styles.actionsOverlay}
          activeOpacity={1}
          onPress={() => setShowActions(null)}
        />
        <View style={[styles.actionsSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.actionsHandle, { backgroundColor: colors.border }]} />

          {showActions && (() => {
            const photo = photos.find(p => p.id === showActions);
            if (!photo) return null;
            return (
              <>
                <Image source={{ uri: photo.uri }} style={styles.actionsPreview} resizeMode="cover" />

                {!photo.isMain && (
                  <TouchableOpacity
                    style={[styles.actionRow, { borderColor: colors.border }]}
                    onPress={() => { onSetMain?.(photo.id); setShowActions(null); }}
                  >
                    <Text style={[styles.actionText, { color: colors.text }]}>تعيين كصورة رئيسية</Text>
                    <Ionicons name="star-outline" size={20} color="#F39C12" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionRow, { borderColor: colors.border }]}
                  onPress={() => { openFullscreen(photos.findIndex(p => p.id === showActions)); setShowActions(null); }}
                >
                  <Text style={[styles.actionText, { color: colors.text }]}>عرض بالحجم الكامل</Text>
                  <Ionicons name="expand-outline" size={20} color={colors.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionRow, { borderColor: colors.border }]}
                  onPress={() => { setShowActions(null); confirmDelete(photo); }}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>حذف الصورة</Text>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionCancel, { backgroundColor: colors.surface }]}
                  onPress={() => setShowActions(null)}
                >
                  <Text style={[styles.actionCancelText, { color: colors.text }]}>إلغاء</Text>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      </Modal>

      {/* ── Fullscreen viewer ── */}
      <Modal
        visible={fullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
        statusBarTranslucent
      >
        <View style={styles.fsContainer}>
          {/* Header */}
          <View style={styles.fsHeader}>
            <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.fsCloseBtn}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.fsCounter}>{fsIdx + 1} / {photos.length}</Text>
            {editable && (
              <TouchableOpacity
                style={styles.fsActionBtn}
                onPress={() => { setFullscreen(false); setShowActions(photos[fsIdx]?.id ?? null); }}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Images */}
          <FlatList
            ref={fsSliderRef}
            data={photos}
            keyExtractor={p => p.id}
            renderItem={({ item }) => (
              <View style={styles.fsSlide}>
                <Image source={{ uri: item.uri }} style={styles.fsImage} resizeMode="contain" />
                {item.caption ? (
                  <View style={styles.fsCaptionBox}>
                    <Text style={styles.fsCaptionText}>{item.caption}</Text>
                  </View>
                ) : null}
              </View>
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onFsViewableChanged}
            viewabilityConfig={viewConfig}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          />

          {/* Bottom dots */}
          {photos.length > 1 && (
            <View style={styles.fsDotsRow}>
              {photos.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setFsIdx(i); fsSliderRef.current?.scrollToIndex({ index: i, animated: true }); }}
                  style={[
                    styles.fsDot,
                    { backgroundColor: i === fsIdx ? '#FFF' : 'rgba(255,255,255,0.35)' },
                    i === fsIdx && styles.fsDotActive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Navigation arrows */}
          {photos.length > 1 && (
            <>
              {fsIdx < photos.length - 1 && (
                <TouchableOpacity
                  style={[styles.fsArrow, styles.fsArrowRight]}
                  onPress={() => {
                    const next = fsIdx + 1;
                    setFsIdx(next);
                    fsSliderRef.current?.scrollToIndex({ index: next, animated: true });
                  }}
                >
                  <Ionicons name="chevron-forward" size={28} color="#FFF" />
                </TouchableOpacity>
              )}
              {fsIdx > 0 && (
                <TouchableOpacity
                  style={[styles.fsArrow, styles.fsArrowLeft]}
                  onPress={() => {
                    const prev = fsIdx - 1;
                    setFsIdx(prev);
                    fsSliderRef.current?.scrollToIndex({ index: prev, animated: true });
                  }}
                >
                  <Ionicons name="chevron-back" size={28} color="#FFF" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Empty state
  emptyBox: {
    height: GALLERY_H, alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    borderBottomWidth: 1,
  },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  emptyTitle:   { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  emptyHint:    { fontSize: fontSize.sm },

  // Slider
  sliderWrap:  { position: 'relative', overflow: 'hidden' },
  slideImage:  { width: SCREEN_W, height: GALLERY_H },
  mainBadge: {
    position: 'absolute', top: spacing[3], left: spacing[3],
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'transparent', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.full,
  },
  mainBadgeText: { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold },
  captionBox: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing[2] },
  captionText: { color: '#FFF', fontSize: fontSize.sm },
  expandBtn: {
    position: 'absolute', top: spacing[3], right: spacing[3],
    width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center',
  },
  countBadge: {
    position: 'absolute', bottom: spacing[3], right: spacing[3],
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full,
  },
  countText: { color: '#FFF', fontSize: 11, fontWeight: fontWeight.semibold },
  dotsRow: {
    position: 'absolute', bottom: spacing[3],
    left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { width: 18 },

  // Thumbnails strip
  thumbStrip: { flexGrow: 0 },
  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.lg,
    borderWidth: 2, overflow: 'hidden', position: 'relative',
  },
  thumbImage: { width: '100%', height: '100%' },
  thumbStar: {
    position: 'absolute', top: 3, left: 3,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  addThumbBtn: {
    width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: radius.lg,
    borderWidth: 1.5, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },

  // Actions sheet
  actionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  actionsSheet: {
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing[4], gap: spacing[2], alignItems: 'stretch',
  },
  actionsHandle:  { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2] },
  actionsPreview: { width: '100%', height: 140, borderRadius: radius.xl, marginBottom: spacing[2] },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[4], borderBottomWidth: 1,
  },
  actionText:       { fontSize: fontSize.base, fontWeight: fontWeight.medium, textAlign: 'right' },
  actionCancel:     { borderRadius: radius.lg, padding: spacing[4], alignItems: 'center', marginTop: spacing[2] },
  actionCancelText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  // Fullscreen
  fsContainer: { flex: 1, backgroundColor: '#000' },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  fsCloseBtn:  { padding: spacing[2] },
  fsActionBtn: { padding: spacing[2] },
  fsCounter:   { color: '#FFF', fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  fsSlide: {
    width: SCREEN_W, height: SCREEN_H,
    justifyContent: 'center', alignItems: 'center',
  },
  fsImage: { width: SCREEN_W, height: SCREEN_H * 0.75 },
  fsCaptionBox: {
    position: 'absolute', bottom: 80, left: 0, right: 0,
    padding: spacing[4], backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fsCaptionText: { color: '#FFF', fontSize: fontSize.base, textAlign: 'center' },
  fsDotsRow: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  fsDot:       { width: 8, height: 8, borderRadius: 4 },
  fsDotActive: { width: 22 },
  fsArrow: {
    position: 'absolute', top: '50%',
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  fsArrowRight: { right: spacing[4] },
  fsArrowLeft:  { left: spacing[4] },
});
