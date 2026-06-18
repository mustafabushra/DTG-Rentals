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
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';

import { Attachment } from '../../domain/models';

const { height: SCREEN_H } = Dimensions.get('window');

const isRemote = (uri: string) =>
  uri.startsWith('http://') || uri.startsWith('https://');

interface Props {
  attachment: Attachment | null;
  onClose: () => void;
}

export function FileViewer({ attachment, onClose }: Props) {
  const [imageLoading, setImageLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const isImage = attachment?.type === 'image';
  const isPdf = attachment?.type === 'pdf';

  // OPEN animation
  const open = () => {
    setError(false);
    setImageLoading(false);
    setPdfLoading(false);

    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
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

  // PDF timeout fallback (prevents infinite loading)
  useEffect(() => {
    if (!isPdf) return;

    const t = setTimeout(() => {
      if (pdfLoading) {
        setError(true);
        setPdfLoading(false);
      }
    }, 12000);

    return () => clearTimeout(t);
  }, [pdfLoading, isPdf]);

  if (!attachment) return null;

  const handleShare = async () => {
    try {
      const ok = await Sharing.isAvailableAsync();
      if (ok) {
        await Sharing.shareAsync(attachment.uri);
      }
    } catch (e) {
      console.log('SHARE ERROR:', e);
    }
  };

  const renderPdf = () => {
    return (
      <WebView
        style={{ flex: 1 }}
        source={{ uri: attachment.uri }}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        onLoadStart={() => setPdfLoading(true)}
        onLoadEnd={() => setPdfLoading(false)}
        onError={(e) => {
          console.log('PDF ERROR:', e.nativeEvent);
          setError(true);
          setPdfLoading(false);
        }}
      />
    );
  };

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
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#fff' }} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>

            <TouchableOpacity onPress={handleShare}>
              <Text style={{ color: '#fff' }}>↗</Text>
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <View style={{ flex: 1 }}>

            {/* IMAGE */}
            {isImage && !error && (
              <ScrollView contentContainerStyle={{ flex: 1 }}>
                <Image
                  source={{ uri: attachment.uri }}
                  style={{ width: '100%', flex: 1 }}
                  resizeMode="contain"
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => {
                    setError(true);
                    setImageLoading(false);
                  }}
                />
              </ScrollView>
            )}

            {/* PDF */}
            {isPdf && !error && renderPdf()}

            {/* LOADER */}
            {(imageLoading || pdfLoading) && !error && (
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
                <Text style={{ color: '#fff' }}>
                  Failed to load file
                </Text>

                <TouchableOpacity onPress={handleShare}>
                  <Text style={{ color: 'lightblue', marginTop: 10 }}>
                    Open externally
                  </Text>
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
  },
});