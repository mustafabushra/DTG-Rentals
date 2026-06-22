import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Platform, ActivityIndicator, Clipboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { FormInput } from '../components/forms/FormInput';
import { ConfirmModal } from '../components/ui/Modal';
import {
  collection, getDocs, addDoc, setDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  updateProfile as fbUpdateProfile, deleteUser, signOut,
} from 'firebase/auth';
import { db, getSecondaryAuth } from '../lib/firebase';
import { getActiveOrgId } from '../lib/firestoreService';
import { useApp } from '../context/AppProvider';
import { isAdminRole } from '../utils/roleUtils';
import { useAppTheme } from '../hooks/useAppTheme';

interface ManagedUser {
  id:        string;
  name:      string;
  email:     string;
  role:      string;
  phone?:    string;
  status:    'active' | 'pending' | 'suspended';
  createdAt?: string;
  ownerId?:  string;
}

const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'مدير النظام',
    color: '#8E44AD',
    bg: '#F4ECF7',
    icon: 'shield-checkmark-outline',
    perms: { view: true, add: true, edit: true, delete: true, users: true },
  },
  {
    value: 'manager',
    label: 'مدير',
    color: '#2E86C1',
    bg: '#EBF5FB',
    icon: 'briefcase-outline',
    perms: { view: true, add: true, edit: true, delete: false, users: false },
  },
  {
    value: 'viewer',
    label: 'مشاهد',
    color: '#27AE60',
    bg: '#E8F8F0',
    icon: 'eye-outline',
    perms: { view: true, add: false, edit: false, delete: false, users: false },
  },
  {
    value: 'owner',
    label: 'مالك',
    color: '#E67E22',
    bg: '#FEF9E7',
    icon: 'home-outline',
    perms: { view: true, add: false, edit: false, delete: false, users: false },
  },
] as const;

const STATUS_CFG = {
  active:    { label: 'نشط',    color: '#27AE60', bg: '#E8F8F0', icon: 'checkmark-circle-outline' },
  pending:   { label: 'معلق',   color: '#E67E22', bg: '#FEF9E7', icon: 'time-outline' },
  suspended: { label: 'موقوف',  color: '#E74C3C', bg: '#FDEDEC', icon: 'ban-outline' },
} as const;

const FILTER_TABS = [
  { key: 'all',       label: 'الكل' },
  { key: 'active',    label: 'نشط' },
  { key: 'pending',   label: 'معلق' },
  { key: 'suspended', label: 'موقوف' },
  { key: 'admin',     label: 'مدراء' },
];

const PERM_ROWS = [
  { key: 'view',   label: 'مشاهدة البيانات' },
  { key: 'add',    label: 'إضافة سجلات' },
  { key: 'edit',   label: 'تعديل السجلات' },
  { key: 'delete', label: 'حذف السجلات' },
  { key: 'users',  label: 'إدارة المستخدمين' },
];

function roleCfg(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)
    ?? { value: role, label: role, color: '#718096', bg: '#F0F4F8', icon: 'person-outline', perms: { view: true, add: false, edit: false, delete: false, users: false } };
}

function safeInitials(name: string) {
  return (name ?? '؟').split(' ').filter(Boolean).slice(0, 2).map(n => n[0] ?? '').join('') || '؟';
}

function normalizeTs(val: any): string {
  if (!val) return '';
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  return String(val);
}

type Screen = 'list' | 'form' | 'permissions';

export default function UserManagementScreen() {
  const { colors } = useAppTheme();
  const { currentUser, owners } = useApp();
  const isAdmin = isAdminRole(currentUser.role);

  const [users,     setUsers]     = useState<ManagedUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [screen,    setScreen]    = useState<Screen>('list');
  const [editing,   setEditing]   = useState<ManagedUser | null>(null);
  const [delTarget, setDelTarget] = useState<ManagedUser | null>(null);
  const [saving,    setSaving]    = useState(false);

  const [fName,    setFName]    = useState('');
  const [fEmail,   setFEmail]   = useState('');
  const [fPhone,   setFPhone]   = useState('');
  const [fRole,    setFRole]    = useState<string>('viewer');
  const [fOwnerId, setFOwnerId] = useState<string>('');
  const [fErrors,  setFErrors]  = useState<Record<string, string>>({});

  // قائمة المستخدمين مشتركة تحت orgs/main/managedUsers
  const colRef = useCallback(
    () => collection(db, 'orgs', getActiveOrgId(), 'managedUsers'),
    [],
  );

  const fetchUsers = useCallback(async () => {
    if (!currentUser.id || !isAdminRole(currentUser.role)) return;
    setLoading(true);
    try {
      const snap = await getDocs(colRef());
      const list: ManagedUser[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id:        d.id,
          name:      data.name     ?? '',
          email:     data.email    ?? '',
          role:      data.role     ?? 'viewer',
          phone:     data.phone    ?? '',
          status:    data.status   ?? 'pending',
          createdAt: normalizeTs(data.createdAt),
          ownerId:   data.ownerId  ?? undefined,
        };
      });
      setUsers(list.sort((a, b) => (a.name).localeCompare(b.name)));
    } catch (err: any) {
      // تجاهل أخطاء الصلاحيات عند تسجيل الخروج
      if (currentUser.id && isAdminRole(currentUser.role)) {
        toast('تعذّر تحميل قائمة المستخدمين');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.role]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function toast(msg: string) {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('تنبيه', msg);
  }

  const selfRecord: ManagedUser = {
    id: currentUser.id, name: currentUser.name, email: currentUser.email,
    role: currentUser.role, phone: currentUser.phone, status: 'active',
  };

  const allUsers: ManagedUser[] = [selfRecord, ...users.filter(u => u.id !== currentUser.id)];

  const filtered = allUsers.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || u.name?.toLowerCase().includes(q)
      || u.email?.toLowerCase().includes(q)
      || u.phone?.includes(q);
    const matchTab =
      filterTab === 'all'  ? true :
      filterTab === 'admin' ? isAdminRole(u.role) :
      u.status === filterTab;
    return matchSearch && matchTab;
  });

  // ── Tab counts ──
  const tabCounts: Record<string, number> = {
    all:       allUsers.length,
    active:    allUsers.filter(u => u.status === 'active').length,
    pending:   allUsers.filter(u => u.status === 'pending').length,
    suspended: allUsers.filter(u => u.status === 'suspended').length,
    admin:     allUsers.filter(u => isAdminRole(u.role)).length,
  };

  // ── Add / Edit helpers ──
  const openAdd = () => {
    setEditing(null); setFName(''); setFEmail(''); setFPhone(''); setFRole('viewer'); setFOwnerId(''); setFErrors({});
    setScreen('form');
  };
  const openEdit = (u: ManagedUser) => {
    setEditing(u); setFName(u.name); setFEmail(u.email); setFPhone(u.phone ?? ''); setFRole(u.role); setFOwnerId(u.ownerId ?? ''); setFErrors({});
    setScreen('form');
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fName.trim())  e.name  = 'الاسم مطلوب';
    if (!fEmail.trim()) e.email = 'البريد الإلكتروني مطلوب';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fEmail.trim())) e.email = 'بريد إلكتروني غير صحيح';
    if (fRole === 'owner' && !fOwnerId) e.ownerId = 'يجب اختيار المالك المرتبط بهذا الحساب';
    setFErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data: Record<string, any> = {
        name:  fName.trim(),
        email: fEmail.trim(),
        phone: fPhone.trim(),
        role:  fRole,
        ...(fRole === 'owner' && fOwnerId ? { ownerId: fOwnerId } : {}),
      };

      if (editing) {
        // ── تعديل مستخدم موجود ────────────────────────────────────────────
        await setDoc(doc(db, 'orgs', getActiveOrgId(), 'managedUsers', editing.id), data, { merge: true });
        // حفظ في مستند المستخدم نفسه كذلك (لو كان لديه حساب Firebase Auth)
        await setDoc(doc(db, 'users', editing.id), {
          name:  data.name,
          phone: data.phone,
          role:  data.role,
          ...(data.ownerId ? { ownerId: data.ownerId } : {}),
        }, { merge: true });
        setUsers(prev => prev.map(u => u.id === editing.id ? { ...u, ...data } : u));
        setScreen('list');

      } else {
        // ── إنشاء مستخدم جديد ──────────────────────────────────────────────
        // 1. أنشئ حساب Firebase Auth بكلمة مرور مؤقتة عشوائية (عبر app ثانوية)
        const secondaryAuth = getSecondaryAuth();
        if (!secondaryAuth) { toast('تعذّر تهيئة المصادقة'); setSaving(false); return; }
        const tempPassword  = `Temp_${Math.random().toString(36).slice(2, 10)}!`;
        let   newUid        = '';
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, tempPassword);
          newUid = cred.user.uid;
          await fbUpdateProfile(cred.user, { displayName: data.name });
          // تسجيل خروج من الـ session الثانوي فوراً — session المدير سليم
          await signOut(secondaryAuth);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            toast('هذا البريد الإلكتروني مسجّل مسبقاً في النظام');
            setSaving(false);
            return;
          }
          throw authErr;
        }

        // 2. احفظ بروفايل المستخدم في users/{uid} (خاص به) + orgId للوصول للبيانات المشتركة
        await setDoc(doc(db, 'users', newUid), {
          name:      data.name,
          email:     data.email,
          phone:     data.phone,
          role:      data.role,
          status:    'active',
          orgId:     getActiveOrgId(),
          ...(data.role === 'owner' || data.role === 'مالك' ? { ownerId: data.ownerId } : {}),
          createdAt: serverTimestamp(),
        });

        // 3. احفظه في قائمة المستخدمين المشتركة orgs/main/managedUsers
        await setDoc(doc(db, 'orgs', getActiveOrgId(), 'managedUsers', newUid), {
          ...data,
          status:    'active',
          createdAt: serverTimestamp(),
        });

        // 4. أرسل بريد إعادة تعيين كلمة المرور — هذا هو "دعوة التسجيل"
        await sendPasswordResetEmail(secondaryAuth, data.email);

        const newUser: ManagedUser = {
          id:        newUid,
          name:      data.name,
          email:     data.email,
          phone:     data.phone,
          role:      data.role,
          status:    'pending',
          createdAt: new Date().toISOString(),
          ...(data.ownerId ? { ownerId: data.ownerId } : {}),
        };
        setUsers(prev => [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name)));

        setScreen('list');
        // إشعار واضح للمدير
        if (Platform.OS === 'web') {
          window.alert(`✅ تم إنشاء الحساب\n\nأُرسل بريد دعوة إلى:\n${data.email}\n\nسيضغط المستخدم على الرابط ويحدد كلمة مروره ثم يسجّل دخوله.`);
        } else {
          Alert.alert(
            '✅ تم إنشاء الحساب',
            `أُرسل بريد دعوة إلى:\n${data.email}\n\nسيضغط المستخدم على الرابط ويحدد كلمة مروره ثم يسجّل دخوله.`,
          );
        }
      }
    } catch (e: any) {
      console.error('user-management save error:', e);
      toast(`تعذّر حفظ البيانات: ${e?.message ?? ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    try {
      await deleteDoc(doc(db, 'orgs', getActiveOrgId(), 'managedUsers', delTarget.id));
      setUsers(prev => prev.filter(u => u.id !== delTarget.id));
    } catch { toast('تعذّر الحذف'); }
    finally { setDelTarget(null); }
  };

  const toggleStatus = async (u: ManagedUser) => {
    const next: ManagedUser['status'] = u.status === 'active' ? 'suspended' : 'active';
    try {
      await setDoc(doc(db, 'orgs', getActiveOrgId(), 'managedUsers', u.id), { status: next }, { merge: true });
      // حدّث بروفايل المستخدم نفسه أيضاً
      await setDoc(doc(db, 'users', u.id), { status: next }, { merge: true });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: next } : x));
    } catch { toast('تعذّر تغيير الحالة'); }
  };

  const copyEmail = (email: string) => {
    try { (Clipboard as any).setString(email); toast(`تم نسخ: ${email}`); } catch {}
  };

  // ─── PERMISSIONS SCREEN ────────────────────────────────────────────────────
  if (screen === 'permissions') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="جدول الصلاحيات" showBack={false}
          rightText={{ label: 'رجوع', onPress: () => setScreen('list') }} />
        <ScrollView contentContainerStyle={{ padding: Theme.spacing.base, paddingBottom: 40 }}>
          <View style={[styles.permCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header row */}
            <View style={[styles.permRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <Text style={[styles.permCell, styles.permHeader, { color: colors.text, flex: 2 }]}>الصلاحية</Text>
              {ROLE_OPTIONS.map(r => (
                <View key={r.value} style={[styles.permCell, styles.permColHeader, { backgroundColor: r.bg }]}>
                  <Ionicons name={r.icon as any} size={14} color={r.color} />
                  <Text style={[styles.permColHeaderText, { color: r.color }]}>{r.label}</Text>
                </View>
              ))}
            </View>
            {/* Data rows */}
            {PERM_ROWS.map((row, i) => (
              <View key={row.key} style={[
                styles.permRow,
                i < PERM_ROWS.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
              ]}>
                <Text style={[styles.permCell, { color: colors.text, flex: 2, fontSize: Theme.fontSize.sm }]}>
                  {row.label}
                </Text>
                {ROLE_OPTIONS.map(r => (
                  <View key={r.value} style={[styles.permCell, { alignItems: 'center' }]}>
                    <Ionicons
                      name={(r.perms as any)[row.key] ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={(r.perms as any)[row.key] ? colors.success : colors.danger + '60'}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>

          {/* Role descriptions */}
          {ROLE_OPTIONS.map(r => (
            <View key={r.value} style={[styles.roleDescRow, { backgroundColor: r.bg, borderColor: r.color + '40' }]}>
              <View style={[styles.roleDescIcon, { backgroundColor: r.color + '20' }]}>
                <Ionicons name={r.icon as any} size={20} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleDescTitle, { color: r.color }]}>{r.label}</Text>
                <Text style={[styles.roleDescText, { color: colors.textSecondary }]}>
                  {r.value === 'admin'   ? 'صلاحية كاملة: إضافة، تعديل، حذف، وإدارة المستخدمين.'
                  : r.value === 'manager' ? 'يمكنه إضافة وتعديل البيانات دون حذف أو إدارة المستخدمين.'
                  :                        'مشاهدة البيانات فقط، لا يمكنه إجراء أي تغييرات.'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ─── FORM SCREEN ──────────────────────────────────────────────────────────
  if (screen === 'form') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader
          title={editing ? 'تعديل المستخدم' : 'إضافة مستخدم'}
          showBack={false}
          rightText={{ label: 'إلغاء', onPress: () => setScreen('list') }}
        />
        <ScrollView contentContainerStyle={{ padding: Theme.spacing.base, gap: 4, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">

          <FormInput label="الاسم الكامل *" value={fName} onChangeText={v => { setFName(v); setFErrors(e => ({ ...e, name: '' })); }}
            placeholder="محمد أحمد" icon="person-outline" error={fErrors.name} />
          <FormInput label="البريد الإلكتروني *" value={fEmail} onChangeText={v => { setFEmail(v); setFErrors(e => ({ ...e, email: '' })); }}
            placeholder="user@example.com" icon="mail-outline" keyboardType="email-address"
            autoCapitalize="none" error={fErrors.email} editable={!editing} />
          <FormInput label="رقم الجوال" value={fPhone} onChangeText={setFPhone}
            placeholder="05xxxxxxxx" icon="call-outline" keyboardType="phone-pad" />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>الصلاحية</Text>
          {ROLE_OPTIONS.map(r => {
            const selected = fRole === r.value;
            return (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleCard, { borderColor: selected ? r.color : colors.border, backgroundColor: selected ? r.bg : colors.card }]}
                onPress={() => setFRole(r.value)}
                activeOpacity={0.8}
              >
                <View style={[styles.roleCardIcon, { backgroundColor: r.color + '20' }]}>
                  <Ionicons name={r.icon as any} size={20} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleCardTitle, { color: selected ? r.color : colors.text }]}>{r.label}</Text>
                  <Text style={[styles.roleCardSub, { color: colors.textMuted }]}>
                    {r.value === 'admin'   ? 'صلاحيات كاملة'
                    : r.value === 'manager' ? 'إضافة وتعديل فقط'
                    : r.value === 'owner'   ? 'يرى عقاراته فقط'
                    : 'مشاهدة فقط'}
                  </Text>
                </View>
                <View style={[styles.radioOuter, { borderColor: selected ? r.color : colors.border }]}>
                  {selected && <View style={[styles.radioInner, { backgroundColor: r.color }]} />}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* حقل ربط المالك — يظهر فقط عند اختيار دور "مالك" */}
          {fRole === 'owner' && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>المالك المرتبط بهذا الحساب</Text>
              {owners.length === 0 ? (
                <View style={[styles.roleCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.textMuted, textAlign: 'right', flex: 1 }}>لا يوجد ملاك — أضف مالكاً أولاً من قائمة الملاك</Text>
                </View>
              ) : owners.map(o => {
                const selected = fOwnerId === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.roleCard, { borderColor: selected ? '#E67E22' : colors.border, backgroundColor: selected ? '#FEF9E7' : colors.card }]}
                    onPress={() => setFOwnerId(o.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleCardIcon, { backgroundColor: '#E67E2220' }]}>
                      <Ionicons name="person-outline" size={18} color="#E67E22" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roleCardTitle, { color: selected ? '#E67E22' : colors.text }]}>{o.name}</Text>
                      {o.phone ? <Text style={[styles.roleCardSub, { color: colors.textMuted }]}>{o.phone}</Text> : null}
                    </View>
                    <View style={[styles.radioOuter, { borderColor: selected ? '#E67E22' : colors.border }]}>
                      {selected && <View style={[styles.radioInner, { backgroundColor: '#E67E22' }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {fErrors.ownerId && <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'right' }}>{fErrors.ownerId}</Text>}
            </View>
          )}

          <TouchableOpacity
            style={[styles.permLink, { borderColor: colors.primary }]}
            onPress={() => setScreen('permissions')}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.permLinkText, { color: colors.primary }]}>عرض جدول الصلاحيات التفصيلي</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.border : colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Ionicons name="checkmark-outline" size={20} color="#FFF" />}
            <Text style={styles.saveBtnText}>
              {saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إضافة المستخدم'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── LIST SCREEN ──────────────────────────────────────────────────────────
  if (!currentUser.id) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`إدارة المستخدمين (${allUsers.length})`}
        rightAction={isAdmin ? { icon: 'person-add-outline', onPress: openAdd } : undefined}
      />

      {/* Search */}
      <FormInput label="" value={search} onChangeText={setSearch}
        placeholder="ابحث بالاسم أو البريد أو الهاتف..." icon="search-outline" />

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}>
        {FILTER_TABS.map(t => {
          const active = filterTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
              onPress={() => setFilterTab(t.key)}
            >
              <Text style={[styles.tabText, { color: active ? '#FFF' : colors.textSecondary }]}>{t.label}</Text>
              <View style={[styles.tabBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.accent }]}>
                <Text style={[styles.tabBadgeText, { color: active ? '#FFF' : colors.textMuted }]}>
                  {tabCounts[t.key] ?? 0}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Permissions shortcut */}
      <TouchableOpacity
        style={[styles.permBanner, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '30' }]}
        onPress={() => setScreen('permissions')}
      >
        <Ionicons name="shield-outline" size={16} color={colors.primary} />
        <Text style={[styles.permBannerText, { color: colors.primary }]}>عرض جدول صلاحيات الأدوار</Text>
        <Ionicons name="chevron-back-outline" size={14} color={colors.primary} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.hint, { color: colors.textMuted }]}>جارٍ التحميل…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.loadingBox}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.hint, { color: colors.textMuted }]}>لا توجد نتائج</Text>
          </View>
        ) : filtered.map(u => {
          const cfg   = roleCfg(u.role);
          const stCfg = STATUS_CFG[u.status] ?? STATUS_CFG.active;
          const isMe  = u.id === currentUser.id;

          return (
            <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

              {/* Status bar */}
              <View style={[styles.statusBar, { backgroundColor: stCfg.bg }]}>
                <Ionicons name={stCfg.icon as any} size={13} color={stCfg.color} />
                <Text style={[styles.statusBarText, { color: stCfg.color }]}>{stCfg.label}</Text>
                {isMe && (
                  <View style={[styles.meBadge, { backgroundColor: colors.primarySubtle, marginRight: 'auto' }]}>
                    <Text style={[styles.meBadgeText, { color: colors.primary }]}>حسابك</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: cfg.color + (u.status === 'suspended' ? '50' : 'FF') }]}>
                  <Text style={styles.avatarText}>{safeInitials(u.name)}</Text>
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={[styles.name, { color: u.status === 'suspended' ? colors.textMuted : colors.text }]}>
                    {u.name}
                  </Text>
                  <TouchableOpacity onPress={() => copyEmail(u.email)} activeOpacity={0.7}>
                    <Text style={[styles.emailText, { color: colors.primary }]}>{u.email}</Text>
                  </TouchableOpacity>
                  {u.phone ? (
                    <Text style={[styles.sub, { color: colors.textMuted }]}>{u.phone}</Text>
                  ) : null}
                  {u.createdAt && !isMe ? (
                    <Text style={[styles.sub, { color: colors.textMuted }]}>
                      أُضيف: {u.createdAt.split('T')[0]}
                    </Text>
                  ) : null}
                </View>

                {/* Role badge */}
                <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                  <Text style={[styles.roleText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Actions */}
              {isAdmin && !isMe && (
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primarySubtle }]} onPress={() => openEdit(u)}>
                    <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>تعديل</Text>
                  </TouchableOpacity>
                  {/* إعادة إرسال الدعوة للحسابات المعلقة */}
                  {u.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#EBF5FB' }]}
                      onPress={async () => {
                        const sAuth = getSecondaryAuth();
                        if (!sAuth) { toast('تعذّر تهيئة المصادقة'); return; }
                        try {
                          await sendPasswordResetEmail(sAuth, u.email);
                          toast(`تم إعادة إرسال بريد الدعوة إلى ${u.email}`);
                        } catch { toast('تعذّر إرسال البريد'); }
                      }}
                    >
                      <Ionicons name="mail-outline" size={15} color="#2E86C1" />
                      <Text style={[styles.actionText, { color: '#2E86C1' }]}>دعوة</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: u.status === 'suspended' ? colors.successSubtle ?? '#E8F8F0' : '#FEF9E7' }]}
                    onPress={() => toggleStatus(u)}
                  >
                    <Ionicons
                      name={u.status === 'suspended' ? 'checkmark-circle-outline' : 'ban-outline'}
                      size={15}
                      color={u.status === 'suspended' ? colors.success : '#E67E22'}
                    />
                    <Text style={[styles.actionText, { color: u.status === 'suspended' ? colors.success : '#E67E22' }]}>
                      {u.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.dangerSubtle }]} onPress={() => setDelTarget(u)}>
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    <Text style={[styles.actionText, { color: colors.danger }]}>حذف</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {isAdmin && (
          <TouchableOpacity style={[styles.addCta, { borderColor: colors.primary }]} onPress={openAdd}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            <Text style={[styles.addCtaText, { color: colors.primary }]}>إضافة مستخدم جديد</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ConfirmModal
        visible={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={handleDelete}
        title="حذف المستخدم"
        message={`هل أنت متأكد من حذف "${delTarget?.name}"؟ سيتم إزالته نهائياً.`}
        confirmLabel="حذف"
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hint:       { textAlign: 'center', fontSize: Theme.fontSize.base, marginTop: 12 },
  loadingBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  sectionLabel: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right', marginTop: 12, marginBottom: 8 },

  // Filter tabs
  tabsRow: { flexDirection: 'row', paddingHorizontal: Theme.spacing.base, gap: 8, paddingVertical: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Theme.radius.full, borderWidth: 1 },
  tabText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 99, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },

  // Permissions banner
  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Theme.spacing.base, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Theme.radius.md, borderWidth: 1,
  },
  permBannerText: { flex: 1, fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  // Cards
  card: { marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm, borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Theme.spacing.md, paddingVertical: 5 },
  statusBarText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.semibold },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  emailText: { fontSize: Theme.fontSize.sm, textAlign: 'right', textDecorationLine: 'underline' },
  sub: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  meBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  meBadgeText: { fontSize: 10, fontWeight: '700' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, alignSelf: 'flex-start' },
  roleText: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
  actions: { flexDirection: 'row', gap: 8, padding: Theme.spacing.sm, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: Theme.radius.md },
  actionText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  addCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: Theme.spacing.base, marginTop: 8, paddingVertical: 16,
    borderRadius: Theme.radius.xl, borderWidth: 1.5, borderStyle: 'dashed',
  },
  addCtaText: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.semibold },

  // Form
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Theme.radius.lg, borderWidth: 1.5, marginBottom: 8 },
  roleCardIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  roleCardTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  roleCardSub: { fontSize: Theme.fontSize.xs, textAlign: 'right' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  permLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', paddingVertical: 10, borderRadius: Theme.radius.md, borderWidth: 1, marginBottom: 16 },
  permLinkText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: Theme.radius.xl },
  saveBtnText: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },

  // Permissions screen
  permCard: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  permRow: { flexDirection: 'row', alignItems: 'center' },
  permCell: { flex: 1, padding: 12, justifyContent: 'center' },
  permHeader: { fontWeight: Theme.fontWeight.bold, fontSize: Theme.fontSize.sm },
  permColHeader: { alignItems: 'center', gap: 4, padding: 8, flexDirection: 'column' },
  permColHeaderText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  roleDescRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Theme.radius.lg, borderWidth: 1, marginBottom: 8 },
  roleDescIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  roleDescTitle: { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 2, textAlign: 'right' },
  roleDescText: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
});
