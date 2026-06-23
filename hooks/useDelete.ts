/**
 * useDelete — Unified delete hook with dependency validation.
 *
 * Uses useApp() (AppProvider) for both reading state and executing deletes —
 * the single source of truth the UI renders from.
 *
 * Flow:
 *  1. Permission check  → alert if no permission
 *  2. Dependency check  → AlertModal if blocked
 *  3. Archive check     → ConfirmModal "archive" for contracts with paid installments
 *  4. Confirm modal     → standard danger ConfirmModal
 *  5. Execute via useApp() actions → state updates → UI re-renders
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useApp } from '../context/AppProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeletableEntity =
  | 'owner'
  | 'property'
  | 'unit'
  | 'tenant'
  | 'contract'
  | 'maintenance'
  | 'calendarEvent'
  | 'attachment';

interface DeleteTarget {
  id: string;
  entityType: DeletableEntity;
  label: string;
  onSuccess?: () => void;
}

/** delete  = hard delete
 *  archive = contract with paid installments → cancel instead of delete */
type DeleteMode = 'delete' | 'archive';

type DependencyResult =
  | { ok: true }
  | { ok: false; reason: string }
  | { ok: 'archive'; archiveMessage: string };

export interface UseDeleteReturn {
  canDelete:     boolean;
  pending:       DeleteTarget | null;
  pendingMode:   DeleteMode;
  blocked:       string | null;
  clearBlocked:  () => void;
  requestDelete: (target: DeleteTarget) => void;
  cancelDelete:  () => void;
  confirmDelete: () => void;
}

// ─── Permission ───────────────────────────────────────────────────────────────

const CAN_DELETE_ROLES = ['admin', 'manager', 'مدير النظام', 'مدير عام'];

export function useCanDelete(): boolean {
  const { currentUser } = useApp();
  return CAN_DELETE_ROLES.includes(currentUser?.role ?? '');
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDelete(): UseDeleteReturn {
  // Read EVERYTHING from AppProvider — this is what the UI renders
  const app = useApp();
  const canDelete = CAN_DELETE_ROLES.includes(app.currentUser?.role ?? '');

  const [pending,     setPending]     = useState<DeleteTarget | null>(null);
  const [pendingMode, setPendingMode] = useState<DeleteMode>('delete');
  const [blocked,     setBlocked]     = useState<string | null>(null);

  const clearBlocked = useCallback(() => setBlocked(null), []);

  // ── Dependency checker (reads live AppProvider state) ──────────────────────
  const checkDependencies = useCallback((
    entityType: DeletableEntity,
    id: string,
  ): DependencyResult => {
    switch (entityType) {

      case 'owner': {
        const linked = app.properties.filter(p => p.ownerId === id);
        if (linked.length > 0) {
          return {
            ok: false,
            reason: `لا يمكن حذف هذا المالك لأنه مرتبط بـ ${linked.length} عقار.\nاحذف جميع العقارات المرتبطة به أولاً.`,
          };
        }
        return { ok: true };
      }

      case 'property': {
        const linked = app.units.filter(u => u.propertyId === id);
        if (linked.length > 0) {
          return {
            ok: false,
            reason: `لا يمكن حذف هذا العقار لأنه يحتوي على ${linked.length} وحدة.\nاحذف جميع الوحدات أولاً.`,
          };
        }
        return { ok: true };
      }

      case 'unit': {
        const active = app.contracts.find(c => c.unitId === id && c.status === 'active');
        if (active) {
          return {
            ok: false,
            reason: `لا يمكن حذف هذه الوحدة لوجود عقد إيجار نشط (${active.contractNumber ?? active.id}).\nأنهِ العقد أولاً ثم احذف الوحدة.`,
          };
        }
        return { ok: true };
      }

      case 'tenant': {
        const activeContract = app.contracts.find(
          c => c.tenantId === id && c.status === 'active',
        );
        if (activeContract) {
          return {
            ok: false,
            reason: `لا يمكن حذف هذا المستأجر لوجود عقد إيجار نشط.\nأنهِ العقد أولاً.`,
          };
        }
        const tenantContractIds = app.contracts
          .filter(c => c.tenantId === id)
          .map(c => c.id);
        const unpaid = app.payments.filter(
          p => tenantContractIds.includes(p.contractId) &&
               (p.status === 'pending' || p.status === 'overdue'),
        );
        if (unpaid.length > 0) {
          return {
            ok: false,
            reason: `لا يمكن حذف هذا المستأجر لوجود ${unpaid.length} دفعة غير مسددة.\nسدّد جميع الدفعات المستحقة أولاً.`,
          };
        }
        return { ok: true };
      }

      case 'contract': {
        const paidCount = app.payments.filter(
          p => p.contractId === id && p.status === 'paid',
        ).length;
        if (paidCount > 0) {
          return {
            ok: 'archive',
            archiveMessage:
              `يحتوي هذا العقد على ${paidCount} دفعة مسددة ولا يمكن حذفه نهائياً.\n` +
              `سيتم إلغاؤه وأرشفته مع الاحتفاظ بسجل الدفعات.`,
          };
        }
        return { ok: true };
      }

      case 'maintenance': {
        const item = app.maintenance.find(m => m.id === id);
        if (item && item.status !== 'new') {
          const statusLabel: Record<string, string> = {
            in_progress: 'قيد التنفيذ',
            completed:   'مكتمل',
            cancelled:   'ملغي',
          };
          return {
            ok: false,
            reason: `لا يمكن حذف طلب الصيانة في حالة "${statusLabel[item.status] ?? item.status}".\nيُسمح بالحذف فقط للطلبات الجديدة.`,
          };
        }
        return { ok: true };
      }

      default:
        return { ok: true };
    }
  }, [app]);

  // ── Request delete ─────────────────────────────────────────────────────────
  const requestDelete = useCallback((target: DeleteTarget) => {
    if (!canDelete) {
      Alert.alert('غير مصرح', 'ليس لديك صلاحية لحذف هذا العنصر.');
      return;
    }

    const result = checkDependencies(target.entityType, target.id);

    if (result.ok === false) {
      setBlocked(result.reason);
      return;
    }

    if (result.ok === 'archive') {
      setPendingMode('archive');
      setPending(target);
      return;
    }

    setPendingMode('delete');
    setPending(target);
  }, [canDelete, checkDependencies]);

  const cancelDelete = useCallback(() => {
    setPending(null);
    setPendingMode('delete');
  }, []);

  // ── Confirm delete — writes to AppProvider so UI updates immediately ────────
  const confirmDelete = useCallback(() => {
    if (!pending) return;
    const { id, entityType, label, onSuccess } = pending;

    try {
      if (pendingMode === 'archive') {
        app.cancelContract(id, 'أرشفة تلقائية عند الحذف');
        setPending(null);
        setPendingMode('delete');
        onSuccess?.();
        Alert.alert('تم الأرشفة', `تم إلغاء وأرشفة "${label}" بنجاح.`);
        return;
      }

      switch (entityType) {
        case 'owner':         app.deleteOwner(id);         break;
        case 'property':      app.deleteProperty(id);      break;
        case 'unit':          app.deleteUnit(id);          break;
        case 'tenant':        app.deleteTenant(id);        break;
        case 'contract':      app.deleteContract(id);      break;
        case 'maintenance':   app.deleteMaintenance(id);   break;
        case 'calendarEvent': app.deleteCalendarEvent(id); break;
        case 'attachment':    app.deleteAttachment(id);    break;
      }

      setPending(null);
      setPendingMode('delete');
      onSuccess?.();
      Alert.alert('تم الحذف', `تم حذف "${label}" بنجاح.`);
    } catch {
      setPending(null);
      setPendingMode('delete');
      Alert.alert('خطأ', 'حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.');
    }
  }, [pending, pendingMode, app]);

  return { canDelete, pending, pendingMode, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete };
}
