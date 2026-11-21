/**
 * إجراءات الشيكات: تسجيل، إيداع، صرف (يسجّل القسط مدفوع ويصدر سند القبض)، ارتداد.
 */
import { useApp } from '../context/AppProvider';
import { useFinance } from '../context/FinanceProvider';
import type { Cheque } from '../domain/services/ChequeService';

const today = () => new Date().toISOString().split('T')[0];

export function useCheques() {
  const { payments, updatePayment, confirmPayment, logAudit } = useApp();
  const { issueReceiptForPayment } = useFinance();

  const save = (paymentId: string, cheque: Cheque) => {
    updatePayment(paymentId, { cheque });
  };

  const saveMany = (plan: { paymentId: string; cheque: Cheque }[]) => {
    plan.forEach(p => updatePayment(p.paymentId, { cheque: p.cheque }));
    logAudit('add', 'شيكات', `${plan.length} شيك`, `تسجيل ${plan.length} شيك لأقساط عقد`);
  };

  const advance = async (paymentId: string, action: 'deposit' | 'clear' | 'bounce' | 'redeposit', reason?: string) => {
    const p = payments.find(x => x.id === paymentId);
    if (!p?.cheque) return { ok: false, error: 'ما في شيك على هذا القسط' };
    const d = today();
    const c = p.cheque;
    if (action === 'deposit' || action === 'redeposit') {
      save(paymentId, { ...c, status: 'deposited', depositedAt: d });
    } else if (action === 'bounce') {
      save(paymentId, { ...c, status: 'bounced', bouncedAt: d, ...(reason ? { bounceReason: reason } : {}) });
      logAudit('edit', 'شيك', c.number, `ارتداد الشيك ${c.number}${reason ? ` — ${reason}` : ''}`);
    } else if (action === 'clear') {
      // الشيك انصرف ⇒ القسط مدفوع بطريقة "شيك" ورقمه مرجع، ويصدر سند القبض
      updatePayment(paymentId, { cheque: { ...c, status: 'cleared', clearedAt: d }, method: 'check', referenceNumber: c.number });
      confirmPayment(paymentId);
      const r = await issueReceiptForPayment(paymentId, { paidDate: d, method: 'check', referenceNumber: c.number });
      if (!r.ok) return { ok: true, warning: `القسط صار مدفوع، بس سند القبض ما صدر: ${r.error}` };
    }
    return { ok: true };
  };

  return { save, saveMany, advance };
}
