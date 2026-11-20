/**
 * مصدر واحد للتنبيهات: صفحة الإشعارات والجرس والقائمة كلها تقرأ من هنا،
 * فيطلع نفس الرقم في كل مكان. الرقم على الجرس = عدد التنبيهات "العاجلة".
 */
import { useMemo } from 'react';
import { useApp } from '../context/AppProvider';

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

  const urgentCount = notifications.filter(n => n.urgency === 'critical').length;
  return { notifications, urgentCount };
}
