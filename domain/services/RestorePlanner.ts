/**
 * تخطيط استعادة النسخة الاحتياطية — دوال نقية، بلا شبكة ولا React.
 *
 * **لماذا وُجد هذا الملف:** الاستعادة كانت «امحُ كل شيء ثم اكتب». وتلك خوارزمية
 * لا تغتفر: لو انقطع الاتصال بعد المحو وقبل تمام الكتابة، ذهبت البيانات ولا
 * رجعة — ولا معاملة ذرّية تشمل آلاف المستندات في Firestore.
 *
 * فالترتيب انقلب إلى **اكتب ثم قلّم**:
 *   ① تُكتب كل سجلات النسخة (setOne يكتب فوق الموجود، فالعملية مُعادة بأمان)
 *   ② لا يُحذف شيء إلا بعد نجاح كل الكتابات
 *   ③ ويُحذف فقط ما هو موجود في قاعدة البيانات وغائب عن النسخة
 *
 * فأسوأ ما يحدث عند الفشل: بقاء سجلات قديمة زائدة — وهي حالة تُصلَح بإعادة
 * المحاولة. أما فقدان البيانات فيصير مستحيلاً لا مستبعداً.
 *
 * القرار الخطير هو **ما يُحذف**، فهو هنا في دالة نقية مُختبَرة لا في وسط
 * دالة تنادي الشبكة.
 */

/** أدنى ما نحتاجه من السجل: معرّفه. */
export interface IdLike { id?: unknown }

export interface RestorePlan {
  /** سجلات صالحة تُكتب، مجموعةً بمجموعتها. */
  write:   Record<string, IdLike[]>;
  /** معرّفات موجودة في قاعدة البيانات وغائبة عن النسخة ⇒ تُقلَّم بعد الكتابة. */
  prune:   Record<string, string[]>;
  /** سجلات بلا معرّف صالح. لا تُكتب ولا تُهمَل صامتةً. */
  invalid: { col: string; count: number }[];
  counts:  { write: number; prune: number; invalid: number };
}

/** معرّف صالح: نصّ غير فارغ. الرقم يُرفض — معرّفات Firestore نصوص. */
function validId(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * يبني خطة الاستعادة. لا يكتب ولا يحذف — يقرّر فقط.
 *
 * `incoming` ما في ملف النسخة، و`existingIds` ما في قاعدة البيانات الآن.
 */
export function planRestore(input: {
  cols:        readonly string[];
  incoming:    Record<string, IdLike[] | undefined>;
  existingIds: Record<string, string[] | undefined>;
}): RestorePlan {
  const write:   Record<string, IdLike[]> = {};
  const prune:   Record<string, string[]> = {};
  const invalid: { col: string; count: number }[] = [];

  let writeCount = 0;
  let pruneCount = 0;
  let invalidCount = 0;

  for (const col of input.cols) {
    const rows = input.incoming[col] ?? [];

    const keep: IdLike[] = [];
    const incomingIds = new Set<string>();
    let bad = 0;

    for (const row of rows) {
      const id = validId((row as IdLike)?.id);
      if (!id) { bad++; continue; }
      // معرّف مكرَّر داخل النسخة: الأخير يفوز، وهو سلوك setOne نفسه.
      // لا يُحتسب خطأً — الملف قد يحمل تصحيحاً لاحقاً للسجل نفسه.
      incomingIds.add(id);
      keep.push(row);
    }

    write[col] = keep;
    writeCount += keep.length;

    if (bad > 0) {
      invalid.push({ col, count: bad });
      invalidCount += bad;
    }

    const existing = input.existingIds[col] ?? [];
    const toPrune = existing.filter(id => !incomingIds.has(id));
    prune[col] = toPrune;
    pruneCount += toPrune.length;
  }

  return {
    write, prune, invalid,
    counts: { write: writeCount, prune: pruneCount, invalid: invalidCount },
  };
}

/**
 * هل الخطة تمحو كل شيء وتكتب لا شيء؟
 *
 * ملف صالح شكلاً لكنه فارغ المحتوى (مصفوفات خاوية) يُنتج خطةً تُقلّم كل سجل
 * موجود. وذلك محوٌ كامل بثوب استعادة — فيُمنَع، لا يُنفَّذ بصمت.
 */
export function wipesEverything(plan: RestorePlan): boolean {
  return plan.counts.write === 0 && plan.counts.prune > 0;
}
