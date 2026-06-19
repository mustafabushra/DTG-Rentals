import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Attachment } from '../../domain/models';

const { height: SCREEN_H } = Dimensions.get('window');

interface Props {
  attachment: Attachment | null;
  onClose: () => void;
}

export function FileViewer({ attachment, onClose }: Props) {
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isImage = attachment?.type === 'image';
  const isPdf = attachment?.type === 'pdf';
  const isDoc = attachment?.type === 'doc' || attachment?.type === 'other';

  // OPEN animation
  const open = () => {
    setError(false);
    setImageLoading(false);
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  // CLOSE animation
  const close = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    if (attachment) open();
  }, [attachment]);

  if (!attachment) return null;

  const handleShareExternal = async () => {
    try {
      // For data URIs, download first then share
      if (attachment.uri.startsWith('data:')) {
        const ext = attachment.mimeType?.includes('pdf') ? '.pdf' : '.jpg';
        const fileUri = `${FileSystem.cacheDirectory}${attachment.name}${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, attachment.uri.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ok = await Sharing.isAvailableAsync();
        if (ok) await Sharing.shareAsync(fileUri);
      } else {
        const ok = await Sharing.isAvailableAsync();
        if (ok) await Sharing.shareAsync(attachment.uri);
      }
    } catch (e) {
      console.log('SHARE ERROR:', e);
    }
  };

  const handleDownload = async () => {
    try {
      if (attachment.uri.startsWith('data:')) {
        const ext = attachment.mimeType?.includes('pdf') ? '.pdf' : '.jpg';
        const fileUri = `${FileSystem.cacheDirectory}${attachment.name}${ext}`;
        await FileSystem.writeAsStringAsync(fileUri, attachment.uri.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri);
      } else {
        await Sharing.shareAsync(attachment.uri);
      }
    } catch (e) {
      console.log('DOWNLOAD ERROR:', e);
    }
  };

  const renderNonImage = () => (
    <View style={styles.nonImageContainer}>
      <Ionicons
        name={attachment.type === 'pdf' ? 'document-text-outline' : 'document-outline'}
        size={80}
        color="#fff"
        style={{ marginBottom: 20 }}
      />
      <Text style={styles.nonImageTitle}>{attachment.name}</Text>
      {attachment.size && (
        <Text style={styles.nonImageSubtitle}>
          {attachment.size < 1024 * 1024
            ? `${(attachment.size / 1024).toFixed(1)} KB`
            : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
        </Text>
      )}
      <View style={{ marginTop: 30, gap: 12 }}>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.downloadBtnText}>فتح الملف خارجياً</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareExternal}>
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>مشاركة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <StatusBar barStyle="light-content" />

      {/* BACKDROP */}
      <Animated.View style={[styles.backdrop, { opacity }]} />

      {/* SHEET */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={close}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16 }} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>
            <TouchableOpacity onPress={handleShareExternal}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <View style={{ flex: 1 }}>
            {/* IMAGE — display inline like property photos */}
            {isImage && !error && (
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
                <Image
                  source={{ uri: attachment.uri }}
                  style={{ width: '100%', height: 400 }}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => {
                    setError(true);
                    setImageLoading(false);
                  }}
                />
                <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>تحميل الصورة</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* PDF / DOC / OTHER — show file info + download/share buttons */}
            {(isPdf || isDoc) && !error && renderNonImage()}

            {/* LOADER */}
            {imageLoading && !error && (
              <View style={styles.loader}>
                <ActivityIndicator color="#fff" />
              </View>
            )}

            {/* ERROR — fallback to download */}
            {error && (
              <View style={styles.error}>
                <Ionicons name="alert-circle-outline" size={60} color="#fff" />
                <Text style={{ color: '#fff', marginTop: 10 }}>
                  تعذر عرض الملف
                </Text>
                <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>فتح خارجياً</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  nonImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  nonImageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  nonImageSubtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});