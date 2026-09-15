/**
 * منطق وضع المعاينة "بعين المالك" — مستخرج ليكون مختبَراً.
 *
 * القرار الهندسي: المعاينة **قراءة فقط**. الكتابة باسم المالك تُفسد سجل التدقيق
 * في نظام مالي (من نفّذ فعلاً — المدير أم المالك؟)، والمدير يستطيع التعديل
 * بصفته أصلاً، فوضع الكتابة يضيف خطراً بلا قدرة جديدة.
 *
 * وهي متاحة لمن يملك إدارة المستخدمين: المدير يرى بيانات كل الملّاك أصلاً في
 * العرض العادي، فالمعاينة تُظهر **أقل** مما يراه — فلترة لا تصعيد صلاحية.
 */

export interface PreviewInputs {
  isAdmin:        boolean;
  previewOwnerId: string | null;
  isOwnerRole:    boolean;
  ownerDataIsolation: boolean;
  currentUserOwnerId?: string | null;
}

export interface PreviewState {
  previewing:        boolean;
  effectiveOwnerId:  string | null | undefined;
  applyOwnerFilter:  boolean;
}

/** الحالة المشتقّة التي تحكم العرض والصلاحيات. */
export function derivePreview(i: PreviewInputs): PreviewState {
  const previewing = !!i.previewOwnerId && i.isAdmin;
  const effectiveOwnerId = previewing ? i.previewOwnerId : i.currentUserOwnerId;
  const applyOwnerFilter = !!effectiveOwnerId
    && (previewing || (i.isOwnerRole && i.ownerDataIsolation));
  return { previewing, effectiveOwnerId, applyOwnerFilter };
}

/** الكتابة ممنوعة أثناء المعاينة مهما كانت صلاحية المستخدم. */
export function canWriteDuringPreview(previewing: boolean, basePermission: boolean): boolean {
  return !previewing && basePermission;
}
