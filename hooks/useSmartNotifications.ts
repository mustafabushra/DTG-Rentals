/**
 * مصدر واحد للتنبيهات: صفحة الإشعارات والجرس والقائمة كلها تقرأ من هنا،
 * فيطلع نفس الرقم في كل مكان. الرقم على الجرس = عدد التنبيهات "العاجلة".
 */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppProvider';
import { getUserProfile, updateUserProfile } from '../lib/auth';

// ── حالة "مقروء" محفوظة: على الجهاز فوراً، وفي حساب المستخدم عشان تتبعه بين الأجهزة ──
let readSet = new Set<string>();
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const LS = (uid: string) => `dtg_read_notifs_${uid}`;
let syncTimer: any = null;

function emit() { listeners.forEach(l => l()); }

function loadFor(uid: string) {
  if (!uid || loadedFor === uid) return;
  loadedFor = uid;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS(uid)) : null;
    readSet = new Set(raw ? JSON.parse(raw) : []);
  } catch { readSet = new Set(); }
  emit();
  getUserProfile(uid).then(p => {
    const remote: string[] = (p as any)?.readNotifs ?? [];
    if (remote.length) { remote.forEach(id => readSet.add(id)); persist(uid, false); emit(); }
  }).catch(() => {});
}

function persist(uid: string, remote = true) {
  const arr = [...readSet].slice(-500);
  try { localStorage.setItem(LS(uid), JSON.stringify(arr)); } catch {}
  if (!remote) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { updateUserProfile(uid, { readNotifs: arr }).catch(() => {}); }, 1500);
}

export function useReadNotifications() {
  const { currentUser } = useApp();
  const userId = currentUser?.id || '';
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(x => x + 1);
    listeners.add(l);
    if (userId) loadFor(userId);
    return () => { listeners.delete(l); };
  }, [userId]);
  const markRead = (ids: string[]) => {
    ids.forEach(id => readSet.add(id));
    if (userId) persist(userId);
    emit();
  };
  return { isRead: (id: string) => readSet.has(id), markRead };
}

export type Urgency = 'critical' | 'warning' | 'info' | 'success';

export interface SmartNotif {
  id:       string;
  type:     string;
  urgency:  Urgency;
  title:    string;
  body:     string;
  date:     string;
  route?:   string;
  isRead:   boolean;
}

export function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
export function formatArabicDate(iso: string) {
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m)-1]} ${y}`;
}


export function useSmartNotifications() {
  const { contracts, payments: installments, maintenance, attachments, notificationPrefs } = useApp();
  const notifications = useMemo((): SmartNotif[] => {
    const list: SmartNotif[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Overdue payments
    if (notificationPrefs.payments) installments
      .filter(p => p.status === 'overdue')
      .forEach(p => {
        const days = Math.abs(daysFromNow(p.dueDate));
        list.push({
          id:      `overdue_${p.id}`,
          type:    'payment',
          urgency: 'critical',
          title:   'دفعة متأخرة',
          body:    `مبلغ ${(p.amount ?? 0).toLocaleString('en-US')} ﷼ — متأخرة ${days} يوم`,
          date:    p.dueDate,
          route:   `/payment/${p.id}`,
          isRead:  false,
        });
      });

    // 2. Payments due soon (≤ 7 days)
    if (notificationPrefs.payments) installments
      .filter(p => p.status === 'pending')
      .forEach(p => {
        const d = daysFromNow(p.dueDate);
        if (d < 0 || d > 7) return;
        list.push({
          id:      `due_soon_${p.id}`,
          type:    'payment',
          urgency: d <= 2 ? 'warning' : 'info',
          title:   d === 0 ? 'دفعة مستحقة اليوم' : `دفعة مستحقة خلال ${d} أيام`,
          body:    `مبلغ ${(p.amount ?? 0).toLocaleString('en-US')} ﷼`,
          date:    p.dueDate,
          route:   `/payment/${p.id}`,
          isRead:  false,
        });
      });

    // 2b. الشيكات: جاهزة للإيداع، أو مرتدة
    if (notificationPrefs.payments) installments
      .filter(p => p.cheque && (p.cheque.status === 'held' || p.cheque.status === 'bounced'))
      .forEach(p => {
        const c = p.cheque!;
        if (c.status === 'bounced') {
          list.push({ id: `chq_bounce_${p.id}_${c.bouncedAt ?? ''}`, type: 'payment', urgency: 'critical',
            title: 'شيك مرتد', body: `شيك ${c.number} — ${(p.amount ?? 0).toLocaleString('en-US')}`, date: c.bouncedAt ?? c.date,
            route: '/cheques', isRead: false });
          return;
        }
        const d = daysFromNow(c.date);
        if (d > 3) return;
        list.push({ id: `chq_dep_${p.id}`, type: 'payment', urgency: d < 0 ? 'critical' : 'warning',
          title: d < 0 ? 'شيك فات موعد إيداعه' : d === 0 ? 'شيك يتودع اليوم' : `شيك يتودع بعد ${d} أيام`,
          body: `شيك ${c.number}${c.bank ? ` (${c.bank})` : ''} — ${(p.amount ?? 0).toLocaleString('en-US')}`, date: c.date,
          route: '/cheques', isRead: false });
      });

    // 3. Expiring contracts (≤ 90 days)
    if (notificationPrefs.contracts) contracts
      .filter(c => c.status === 'active')
      .forEach(c => {
        const d = daysFromNow(c.endDate);
        if (d < 0 || d > 90) return;
        list.push({
          id:      `expiring_${c.id}`,
          type:    'contract',
          urgency: d <= 7 ? 'critical' : d <= 30 ? 'warning' : 'info',
          title:   d <= 7 ? 'عقد ينتهي قريباً جداً' : 'عقد قارب على الانتهاء',
          body:    `${c.contractNumber ?? c.id} — ينتهي ${formatArabicDate(c.endDate)} (خلال ${d} يوم)`,
          date:    c.endDate,
          route:   `/contract/${c.id}`,
          isRead:  false,
        });
      });

    // 4. Expired contracts
    if (notificationPrefs.contracts) contracts
      .filter(c => c.status === 'active' && daysFromNow(c.endDate) < 0)
      .forEach(c => {
        list.push({
          id:      `expired_${c.id}`,
          type:    'contract',
          urgency: 'critical',
          title:   'عقد منتهي الصلاحية',
          body:    `${c.contractNumber ?? c.id} — انتهى ${formatArabicDate(c.endDate)}`,
          date:    c.endDate,
          route:   `/contract/${c.id}`,
          isRead:  false,
        });
      });

    // 5. File / attachment expiry (≤ 60 days or expired)
    if (notificationPrefs.documents) attachments
      .filter(a => a.expiryDate)
      .forEach(a => {
        const d = daysFromNow(a.expiryDate!);
        if (d > 60) return;
        const expired = d < 0;
        list.push({
          id:      `file_${a.id}`,
          type:    'file',
          urgency: expired ? 'critical' : d <= 7 ? 'warning' : 'info',
          title:   expired ? 'ملف منتهي الصلاحية' : `ملف ينتهي خلال ${d} يوم`,
          body:    `"${a.name}" — ${expired ? `انتهى ${formatArabicDate(a.expiryDate!)}` : `ينتهي ${formatArabicDate(a.expiryDate!)}`}`,
          date:    a.expiryDate!,
          isRead:  false,
        });
      });

    // 6. Open maintenance requests
    if (notificationPrefs.maintenance) maintenance
      .filter(m => m.status === 'new')
      .forEach(m => {
        list.push({
          id:      `maint_${m.id}`,
          type:    'maintenance',
          urgency: (m.priority === 'urgent' || m.priority === 'high') ? 'warning' : 'info',
          title:   'طلب صيانة جديد',
          body:    `${m.title} — أولوية: ${m.priority === 'urgent' ? 'عاجل' : m.priority === 'high' ? 'عالية' : 'عادية'}`,
          date:    (m.openedAt ?? (m as any).createdAt ?? new Date().toISOString()).split('T')[0],
          route:   `/maintenance/${m.id}`,
          isRead:  false,
        });
      });

    // Sort: critical first, then by date desc
    const urgencyOrder: Record<Urgency, number> = { critical: 0, warning: 1, info: 2, success: 3 };
    return list.sort((a, b) => {
      const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (uDiff !== 0) return uDiff;
      return b.date.localeCompare(a.date);
    });
  }, [contracts, installments, maintenance, attachments, notificationPrefs]);

  const { isRead, markRead } = useReadNotifications();
  // الرقم على الجرس = العاجل اللي ما انقرى بعد
  const urgentCount = notifications.filter(n => n.urgency === 'critical' && !isRead(n.id)).length;
  const unreadCount = notifications.filter(n => !isRead(n.id)).length;
  return { notifications, urgentCount, unreadCount, isRead, markRead };
}
