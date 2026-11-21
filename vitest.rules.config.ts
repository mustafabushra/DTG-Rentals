import { defineConfig } from 'vitest/config';
// اختبارات قواعد الصلاحيات: تحتاج محاكي Firestore (تشتغل في CI)
export default defineConfig({
  test: { include: ['rules-tests/**/*.check.ts'], testTimeout: 20000, hookTimeout: 60000, fileParallelism: false },
});
