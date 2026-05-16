/**
 * AuditService — Audit log creation and querying.
 */
import type { AuditLog, AuditAction } from '../models';

let _counter = 1;
function genId(): string {
  return `audit_${Date.now()}_${_counter++}`;
}

export const AuditService = {

  /**
   * Create a new audit log entry.
   */
  create(params: {
    userId: string;
    userName: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    entityLabel: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): AuditLog {
    return {
      id:          genId(),
      timestamp:   new Date().toISOString(),
      ...params,
    };
  },

  /**
   * Arabic label for action types.
   */
  actionLabel(action: AuditAction): string {
    const map: Record<AuditAction, string> = {
      create:    'إضافة',
      update:    'تعديل',
      delete:    'حذف',
      cancel:    'إلغاء',
      terminate: 'إنهاء عقد',
      upload:    'رفع ملف',
      payment:   'دفعة',
      login:     'دخول',
      logout:    'خروج',
    };
    return map[action] ?? action;
  },

  /**
   * Color for each action type.
   */
  actionColor(action: AuditAction, colors: Record<string, string>): string {
    const map: Record<AuditAction, string> = {
      create:    colors.success,
      update:    colors.primary,
      delete:    colors.danger,
      cancel:    colors.danger,
      terminate: colors.danger,
      upload:    colors.purple,
      payment:   colors.success,
      login:     colors.textSecondary,
      logout:    colors.textSecondary,
    };
    return map[action] ?? colors.textSecondary;
  },

  /**
   * Icon for each action type.
   */
  actionIcon(action: AuditAction): string {
    const map: Record<AuditAction, string> = {
      create:    'add-circle-outline',
      update:    'pencil-outline',
      delete:    'trash-outline',
      cancel:    'close-circle-outline',
      terminate: 'ban-outline',
      upload:    'cloud-upload-outline',
      payment:   'cash-outline',
      login:     'log-in-outline',
      logout:    'log-out-outline',
    };
    return map[action] ?? 'ellipse-outline';
  },

  /**
   * Filter logs by action type.
   */
  filterByAction(logs: AuditLog[], action: string): AuditLog[] {
    if (action === 'all') return logs;
    return logs.filter(l => l.action === action);
  },

  /**
   * Group logs by date (YYYY-MM-DD).
   */
  groupByDate(logs: AuditLog[]): Record<string, AuditLog[]> {
    return logs.reduce<Record<string, AuditLog[]>>((acc, log) => {
      const date = log.timestamp.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(log);
      return acc;
    }, {});
  },

  /**
   * Format a timestamp as readable Arabic date-time.
   */
  formatTimestamp(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('ar-SA', {
      year:   'numeric',
      month:  'short',
      day:    'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Describe what changed between before/after snapshots.
   */
  diffSummary(before?: Record<string, unknown>, after?: Record<string, unknown>): string[] {
    if (!before || !after) return [];
    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    allKeys.forEach(key => {
      const bVal = JSON.stringify(before[key]);
      const aVal = JSON.stringify(after[key]);
      if (bVal !== aVal) changes.push(key);
    });
    return changes;
  },
};
