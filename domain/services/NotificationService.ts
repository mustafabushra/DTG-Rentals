/**
 * NotificationService — In-app notification generation and management.
 */
import type { Notification, NotificationType, Contract, PaymentInstallment, Attachment } from '../models';
import { ContractService } from './ContractService';
import { PaymentService }  from './PaymentService';
import { FileService }     from './FileService';

let _counter = 1;
function genId(): string { return `notif_${Date.now()}_${_counter++}`; }

export const NotificationService = {

  /**
   * Create a notification.
   */
  create(params: {
    type: NotificationType;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  }): Notification {
    return {
      id:        genId(),
      isRead:    false,
      createdAt: new Date().toISOString(),
      ...params,
    };
  },

  /**
   * Generate contract-expiry notifications for all active contracts.
   */
  generateContractAlerts(contracts: Contract[]): Notification[] {
    const notifications: Notification[] = [];
    contracts.forEach(c => {
      if (c.status !== 'active') return;
      const days = ContractService.daysRemaining(c);
      if (days < 0) {
        notifications.push(NotificationService.create({
          type:        'contract_expiry',
          title:       'عقد منتهي',
          body:        `عقد الإيجار انتهى منذ ${Math.abs(days)} يوم`,
          entityType:  'contract',
          entityId:    c.id,
        }));
      } else if (days <= 7) {
        notifications.push(NotificationService.create({
          type:        'contract_expiry',
          title:       'تنبيه: عقد على وشك الانتهاء',
          body:        `باقي ${days} أيام على انتهاء العقد`,
          entityType:  'contract',
          entityId:    c.id,
        }));
      } else if (days <= 30) {
        notifications.push(NotificationService.create({
          type:        'contract_expiry',
          title:       'تذكير: انتهاء عقد قريب',
          body:        `ينتهي العقد خلال ${days} يوم`,
          entityType:  'contract',
          entityId:    c.id,
        }));
      }
    });
    return notifications;
  },

  /**
   * Generate payment-due notifications.
   */
  generatePaymentAlerts(installments: PaymentInstallment[]): Notification[] {
    return installments
      .filter(p => PaymentService.isOverdue(p))
      .map(p => NotificationService.create({
        type:        'payment_due',
        title:       'دفعة متأخرة',
        body:        `دفعة بقيمة ${p.amount.toLocaleString('en-US')} ﷼ متأخرة منذ ${p.dueDate}`,
        entityType:  'payment',
        entityId:    p.id,
      }));
  },

  /**
   * Generate file-expiry notifications.
   */
  generateFileAlerts(attachments: Attachment[]): Notification[] {
    return FileService
      .getExpiringAttachments(attachments)
      .map(a => {
        const days = FileService.daysUntilExpiry(a.expiryDate!);
        const expired = days < 0;
        return NotificationService.create({
          type:        'file_expiry',
          title:       expired ? 'ملف منتهي الصلاحية' : 'تنبيه انتهاء صلاحية ملف',
          body:        expired
            ? `ملف "${a.name}" انتهت صلاحيته`
            : `ملف "${a.name}" تنتهي صلاحيته خلال ${days} يوم`,
          entityType:  'attachment',
          entityId:    a.id,
        });
      });
  },

  /**
   * Count unread notifications.
   */
  unreadCount(notifications: Notification[]): number {
    return notifications.filter(n => !n.isRead).length;
  },

  /**
   * Icon and color for each notification type.
   */
  typeIcon(type: NotificationType): { icon: string; color: string } {
    const map: Record<NotificationType, { icon: string; color: string }> = {
      payment_due:     { icon: 'cash-outline',            color: '#E74C3C' },
      contract_expiry: { icon: 'document-text-outline',   color: '#F39C12' },
      file_expiry:     { icon: 'document-attach-outline', color: '#8E44AD' },
      maintenance:     { icon: 'construct-outline',       color: '#2E86C1' },
      system:          { icon: 'information-circle-outline', color: '#27AE60' },
    };
    return map[type] ?? { icon: 'notifications-outline', color: '#6B7280' };
  },

  /**
   * Group notifications: today / yesterday / earlier.
   */
  groupByRecency(notifications: Notification[]): Record<'today' | 'yesterday' | 'earlier', Notification[]> {
    const now       = new Date();
    const todayStr  = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr      = yesterday.toISOString().split('T')[0];

    const groups = { today: [] as Notification[], yesterday: [] as Notification[], earlier: [] as Notification[] };
    notifications.forEach(n => {
      const d = n.createdAt.split('T')[0];
      if (d === todayStr)  groups.today.push(n);
      else if (d === yStr) groups.yesterday.push(n);
      else                 groups.earlier.push(n);
    });
    return groups;
  },
};
