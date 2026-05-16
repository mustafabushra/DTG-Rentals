/**
 * FileViewer — Full-screen in-app file preview modal.
 *
 * UX:
 *   • Slides up from bottom with spring animation
 *   • Fades backdrop on open/close
 *   • RTL header: ✕ on left | file name centered | share on right
 *   • Images  → pinch-to-zoom via ScrollView (no extra deps)
 *   • PDFs    → WebView (iOS native | Android via Google Docs Viewer for remote)
 *   • Android local PDF → expo-sharing (device native viewer)
 *   • Error state → share button as fallback
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Image,
  ActivityIndicator, Platform, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import {
  lightColors, darkColors, spacing, fontSize, fontWeight, radius,
} from '../../constants/DesignTokens';
import { FileService } from '../../domain/services/FileService';
import type { Attachment } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isRemote = (uri: string) =>
  uri.startsWith('http://') || uri.startsWith('https://');

const pdfSource = (uri: string) => {
  if (Platform.OS === 'android' && isRemote(uri))
    return `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`;
  return uri;
};

const TYPE_COLOR: Record<Attachment['type'], string> = {
  image: '#2E86C1',
  pdf:   '#E74C3C',
  doc:   '#8E44AD',
  other: '#7F8C8D',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface FileViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileViewer({ attachment, onClose }: FileViewerProps) {
  const { colors } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Spring slide-up animation
  const slideY  = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const open = () => {
    setLoading(true);
    setError(false);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        tension: 60,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  const close = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: SCREEN_H,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    if (attachment) {
      open();
    }
  }, [attachment?.id]);

  // Android + local PDF → share immediately (no WebView for local PDFs on Android)
  useEffect(() => {
    if (!attachment) return;
    if (attachment.type === 'pdf' && Platform.OS === 'android' && !isRemote(attachment.uri)) {
      Sharing.shareAsync(attachment.uri, {
        mimeType: attachment.mimeType,
        dialogTitle: attachment.name,
      }).finally(() => onClose());
    }
  }, [attachment?.id]);

  if (!attachment) return null;
  if (attachment.type === 'pdf' && Platform.OS === 'android' && !isRemote(attachment.uri)) return null;

  const isImage = attachment.type === 'image';
  const isPdf   = attachment.type === 'pdf';
  const color   = TYPE_COLOR[attachment.type];

  const handleShare = async () => {
    const ok = await Sharing.isAvailableAsync();
    if (ok) await Sharing.shareAsync(attachment.uri, {
      mimeType: attachment.mimeType,
      dialogTitle: attachment.name,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible
      transparent
      animationType="none"        // we handle animation ourselves
      statusBarTranslucent
      onRequestClose={close}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />

      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity }]} />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <SafeAreaView style={styles.safeArea}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <View style={styles.header}>

            {/* Right — close (RTL: right = start) */}
            <TouchableOpacity onPress={close} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.closeCircle}>
                <Ionicons name="close" size={18} color="#FFF" />
              </View>
            </TouchableOpacity>

            {/* Center — title + meta */}
            <View style={styles.headerTitle}>
              <View style={[styles.typePill, { backgroundColor: `${color}30` }]}>
                <Ionicons
                  name={FileService.typeIcon(attachment.type) as any}
                  size={12}
                  color={color}
                />
                <Text style={[styles.typePillText, { color }]}>
                  {attachment.type === 'image' ? 'صورة'
                   : attachment.type === 'pdf'  ? 'PDF'
                   : 'ملف'}
                </Text>
              </View>
              <Text style={styles.headerName} numberOfLines={1}>{attachment.name}</Text>
              <Text style={styles.headerDate}>{attachment.uploadedAt.split('T')[0]}</Text>
            </View>

            {/* Left — share */}
            <TouchableOpacity onPress={handleShare} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.shareCircle}>
                <Ionicons name="share-outline" size={18} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Content ────────────────────────────────────────────────── */}
          <View style={styles.content}>

            {/* Loading overlay */}
            {loading && !error && (
              <View style={styles.loaderBox}>
                <ActivityIndicator size="large" color="#FFF" />
                <Text style={styles.loaderText}>جارٍ التحميل…</Text>
              </View>
            )}

            {/* Error state */}
            {error && (
              <View style={styles.errorBox}>
                <View style={[styles.errorIcon, { backgroundColor: `${color}20` }]}>
                  <Ionicons name={FileService.typeIcon(attachment.type) as any} size={40} color={color} />
                </View>
                <Text style={styles.errorTitle}>تعذّر عرض الملف</Text>
                <Text style={styles.errorSub}>يمكنك فتحه في التطبيق الافتراضي</Text>
                <TouchableOpacity
                  style={[styles.openExtBtn, { backgroundColor: colors.primary }]}
                  onPress={handleShare}
                >
                  <Text style={styles.openExtText}>فتح بالتطبيق الافتراضي</Text>
                  <Ionicons name="open-outline" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Image ── */}
            {isImage && !error && (
              <ScrollView
                style={styles.fill}
                contentContainerStyle={styles.imageFill}
                maximumZoomScale={5}
                minimumZoomScale={1}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                bouncesZoom
                centerContent
              >
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.image}
                  resizeMode="contain"
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => { setLoading(false); setError(true); }}
                />
              </ScrollView>
            )}

            {/* ── PDF ── */}
            {isPdf && !error && (
              <WebView
                style={styles.fill}
                source={{ uri: pdfSource(attachment.uri) }}
                originWhitelist={['*']}
                allowFileAccess
                allowFileAccessFromFileURLs
                allowUniversalAccessFromFileURLs
                javaScriptEnabled
                domStorageEnabled
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => { setLoading(false); setError(true); }}
              />
            )}

            {/* ── Unsupported ── */}
            {!isImage && !isPdf && !error && (
              <View style={styles.errorBox}>
                <View style={[styles.errorIcon, { backgroundColor: `${color}20` }]}>
                  <Ionicons name="attach-outline" size={40} color={color} />
                </View>
                <Text style={styles.errorTitle}>{attachment.name}</Text>
                <Text style={styles.errorSub}>هذا النوع لا يمكن عرضه داخل التطبيق</Text>
                <TouchableOpacity
                  style={[styles.openExtBtn, { backgroundColor: colors.primary }]}
                  onPress={handleShare}
                >
                  <Text style={styles.openExtText}>فتح بالتطبيق الافتراضي</Text>
                  <Ionicons name="open-outline" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

          </View>

          {/* ── Footer info bar ─────────────────────────────────────────── */}
          <View style={styles.footer}>
            {attachment.size ? (
              <Text style={styles.footerText}>{FileService.formatSize(attachment.size)}</Text>
            ) : null}
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerText}>{FileService.categoryLabel(attachment.category)}</Text>
            {attachment.expiryDate ? (
              <>
                <Text style={styles.footerDot}>·</Text>
                <Text style={[
                  styles.footerText,
                  {
                    color: attachment.expiryStatus === 'expired'       ? '#E74C3C'
                         : attachment.expiryStatus === 'expiring_soon' ? '#F5A623'
                         : '#2ECC71',
                  },
                ]}>
                  {attachment.expiryStatus === 'expired'       ? '⚠ منتهية'
                   : attachment.expiryStatus === 'expiring_soon' ? '⏳ تنتهي قريباً'
                   : `✓ صالحة حتى ${attachment.expiryDate}`}
                </Text>
              </>
            ) : null}
          </View>

        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },

  // Sheet
  sheet: {
    flex: 1,
    backgroundColor: '#111',
  },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn:   { flexShrink: 0 },
  closeCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  shareCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { flex: 1, alignItems: 'center', gap: 3 },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  typePillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  headerName:   { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center' },
  headerDate:   { color: 'rgba(255,255,255,0.45)', fontSize: fontSize.xs },

  // Content
  content: { flex: 1 },
  fill:    { flex: 1 },

  // Image
  imageFill: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  image:     { width: '100%', aspectRatio: 1 },

  // Loader
  loaderBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    zIndex: 10,
  },
  loaderText: { color: 'rgba(255,255,255,0.6)', fontSize: fontSize.sm },

  // Error / unsupported
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[10],
  },
  errorIcon:  { width: 80, height: 80, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { color: '#FFF', fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  errorSub:   { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, textAlign: 'center' },
  openExtBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    borderRadius: radius.full, marginTop: spacing[2],
  },
  openExtText: { color: '#FFF', fontSize: fontSize.base, fontWeight: fontWeight.semibold },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.xs },
  footerDot:  { color: 'rgba(255,255,255,0.25)', fontSize: fontSize.xs },
});
