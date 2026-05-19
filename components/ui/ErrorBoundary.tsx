import React, { Component, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trackError } from '../../lib/analytics';
import { logger } from '../../lib/logger';

interface Props { children: React.ReactNode; fallbackLabel?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('ErrorBoundary', error.message, { stack: info.componentStack?.slice(0, 300) });
    trackError(error, 'ErrorBoundary');
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <Ionicons name="alert-circle-outline" size={56} color="#E74C3C" />
        <Text style={s.title}>حدث خطأ غير متوقع</Text>
        <Text style={s.sub}>
          {this.props.fallbackLabel ?? 'نعتذر عن الإزعاج. يرجى المحاولة مجدداً.'}
        </Text>
        {this.state.error && (
          <ScrollView style={s.debugBox}>
            <Text style={s.debugText}>{this.state.error.message}</Text>
            <Text style={[s.debugText, { marginTop: 8, opacity: 0.7 }]}>{this.state.error.stack?.slice(0, 400)}</Text>
          </ScrollView>
        )}
        <TouchableOpacity style={s.btn} onPress={this.reset}>
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={s.btnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  title:     { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#1A202C' },
  sub:       { fontSize: 14, textAlign: 'center', color: '#718096', lineHeight: 22 },
  debugBox:  { maxHeight: 120, backgroundColor: '#FFF5F5', borderRadius: 8, padding: 12, width: '100%' },
  debugText: { fontSize: 11, color: '#C53030', fontFamily: 'monospace' },
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1B4F72', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText:   { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
