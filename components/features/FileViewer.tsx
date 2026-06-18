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
  Platform,
  Animated,
  Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';

import { spacing, fontSize, fontWeight, radius } from '../../constants/DesignTokens';
import { FileService } from '../../domain/services/FileService';
import type { Attachment } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

const { height: SCREEN_H } = Dimensions.get('window');

const isRemote = (uri: string) =>
  uri.startsWith('http://') || uri.startsWith('https://');

const pdfSource = (uri: string) => {
  if (Platform.OS === 'android' && isRemote(uri)) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`;
  }
  return uri;
};

const TYPE_COLOR: Record<Attachment['type'], string> = {
  image: '#2E86C1',
  pdf: '#E74C3C',
  doc: '#8E44AD',
  other: '#7F8C8D',
};

interface FileViewerProps {
  attachment: Attachment | null;
  onClose: () => void;
}

export function FileViewer({ attachment, onClose }: FileViewerProps) {
  const { colors } = useAppTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // OPEN animation
  const open = () => {
    setLoading(true);
    setError(false);

    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // CLOSE animation
  const close = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  useEffect(() => {
    if (attachment) open();
  }, [attachment]);

  // Auto share Android local PDF (safe fallback)
  useEffect(() => {
    if (!attachment) return;

    const isLocalPdf =
      attachment.type === 'pdf' &&
      Platform.OS === 'android' &&
      !isRemote(attachment.uri);

    if (isLocalPdf) {
      Sharing.shareAsync(attachment.uri, {
        mimeType: attachment.mimeType,
        dialogTitle: attachment.name,
      }).finally(() => onClose());
    }
  }, [attachment]);

  if (!attachment) {
    return null;
  }

  const isImage = attachment.type === 'image';
  const isPdf = attachment.type === 'pdf';
  const color = TYPE_COLOR[attachment.type];

  const handleShare = async () => {
    try {
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(attachment.uri, {
          mimeType: attachment.mimeType,
          dialogTitle: attachment.name,
        });
      }
    } catch (e) {
      console.log('SHARE ERROR:', e);
    }
  };

  const renderPdf = () => {
    const src = pdfSource(attachment.uri);

    if (Platform.OS === 'web') {
      return (
        <iframe
          src={src}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      );
    }

    return (
      <WebView
        style={{ flex: 1 }}
        source={{ uri: src }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          console.log('PDF ERROR:', e.nativeEvent);
          setLoading(false);
          setError(true);
        }}
      />
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <StatusBar barStyle="light-content" />

      {/* BACKDROP */}
      <Animated.View style={[styles.backdrop, { opacity }]} />

      {/* SHEET */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <SafeAreaView style={{ flex: 1 }}>

          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity onPress={close}>
              <Text style={{ color: '#fff' }}>✕</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600' }} numberOfLines={1}>
                {attachment.name}
              </Text>
              <Text style={{ color: '#999', fontSize: 12 }}>
                {attachment.type}
              </Text>
            </View>

            <TouchableOpacity onPress={handleShare}>
              <Text style={{ color: '#fff' }}>↗</Text>
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <View style={{ flex: 1 }}>

            {/* LOADER */}
            {loading && !error && (
              <View style={styles.loader}>
                <ActivityIndicator color="#fff" />
                <Text style={{ color: '#aaa', marginTop: 10 }}>
                  Loading...
                </Text>
              </View>
            )}

            {/* ERROR */}
            {error && (
              <View style={styles.error}>
                <Text style={{ color: '#fff' }}>Failed to load file</Text>
                <TouchableOpacity onPress={handleShare}>
                  <Text style={{ color: 'lightblue', marginTop: 10 }}>
                    Open externally
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* IMAGE */}
            {isImage && !error && (
              <ScrollView
                contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                maximumZoomScale={5}
              >
                <Image
                  source={{ uri: attachment.uri }}
                  style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={(e) => {
                    console.log('IMAGE ERROR:', e.nativeEvent);
                    setError(true);
                    setLoading(false);
                  }}
                />
              </ScrollView>
            )}

            {/* PDF */}
            {isPdf && !error && renderPdf()}

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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});