import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

interface Step {
  icon: string;
  color: string;
  bg: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    icon: 'home-outline',
    color: '#C3AF76',
    bg: '#03284C',
    title: 'مرحباً بك في يلا تاسك 👋',
    desc: 'نظام إدارة العقارات الذكي — يساعدك على إدارة عقاراتك، مستأجريك، وعقودك من مكان واحد.',
  },
  {
    icon: 'grid-outline',
    color: '#2E86C1',
    bg: '#EBF5FB',
    title: 'لوحة التحكم',
    desc: 'نظرة سريعة على أهم الأرقام — عدد الوحدات المؤجرة، الإيرادات الشهرية، والمدفوعات المتأخرة.',
  },
  {
    icon: 'business-outline',
    color: '#7B3FA0',
    bg: '#EAE0F2',
    title: 'العقارات والوحدات',
    desc: 'أضف عقاراتك وحداتها بسهولة. كل وحدة لها سجل كامل من العقود والصيانة والمرفقات.',
  },
  {
    icon: 'document-text-outline',
    color: '#27AE60',
    bg: '#D8F4E6',
    title: 'العقود والمدفوعات',
    desc: 'أنشئ عقود إيجار واحتسب الأقساط تلقائياً. تتبّع الدفعات وتلقَّ تنبيهات عند الاستحقاق.',
  },
  {
    icon: 'people-outline',
    color: '#D4880A',
    bg: '#FDEFD5',
    title: 'الملاك والمستأجرون',
    desc: 'سجّل بيانات الملاك والمستأجرين بالكامل. كل مالك يرى بياناته الخاصة فقط.',
  },
  {
    icon: 'construct-outline',
    color: '#E74C3C',
    bg: '#FDEDEC',
    title: 'الصيانة والتقارير',
    desc: 'تتبّع طلبات الصيانة وأنشئ تقارير مالية مفصّلة لكل عقار أو لجميع عقاراتك.',
  },
];

const STORAGE_KEY = 'yala_onboarding_done';

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const done = typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    if (!done) {
      // تأخير بسيط حتى تكتمل شاشة الدخول
      setTimeout(() => {
        setVisible(true);
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
      }, 800);
    }
  }, []);

  const animateStep = (next: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(-20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  };

  const finish = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setVisible(false);
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, '1');
    });
  };

  const next = () => {
    if (step < STEPS.length - 1) animateStep(step + 1);
    else finish();
  };

  const prev = () => {
    if (step > 0) animateStep(step - 1);
  };

  if (!visible) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>

        {/* زر تخطي */}
        <TouchableOpacity style={styles.skipBtn} onPress={finish}>
          <Text style={styles.skipText}>تخطي</Text>
        </TouchableOpacity>

        {/* الأيقونة */}
        <View style={[styles.iconWrap, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon as any} size={52} color={s.color} />
        </View>

        {/* النص */}
        <Text style={styles.title}>{s.title}</Text>
        <Text style={styles.desc}>{s.desc}</Text>

        {/* نقاط التقدم */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive]}
            />
          ))}
        </View>

        {/* أزرار التنقل */}
        <View style={styles.actions}>
          {step > 0 ? (
            <TouchableOpacity style={styles.prevBtn} onPress={prev}>
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
              <Text style={styles.prevText}>السابق</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: s.color === '#C3AF76' ? '#03284C' : s.color }]} onPress={next}>
            <Text style={styles.nextText}>{isLast ? 'ابدأ الآن 🚀' : 'التالي'}</Text>
            {!isLast && <Ionicons name="chevron-back" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(2,28,54,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : {}),
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 28,
    width: Math.min(width - 40, 420),
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A202C',
    textAlign: 'center',
    lineHeight: 30,
  },
  desc: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#03284C',
    width: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  prevText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
  },
  nextText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
