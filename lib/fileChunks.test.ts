import { describe, it, expect, vi } from 'vitest';
vi.mock('./firestoreService', () => ({ setOne: vi.fn(), getOne: vi.fn(), deleteOne: vi.fn() }));
import { splitIntoChunks } from './fileChunks';

describe('تقسيم الملفات الكبيرة', () => {
  it('يقسم ويعيد التجميع بدون فقد', () => {
    const s = 'data:application/pdf;base64,' + 'A'.repeat(2_000_003);
    const parts = splitIntoChunks(s, 700_000);
    expect(parts).toHaveLength(3);
    expect(parts.join('')).toBe(s);
    expect(parts.every(p => p.length <= 700_000)).toBe(true);
  });
  it('الملف الصغير قطعة وحدة', () => {
    expect(splitIntoChunks('data:x', 10)).toEqual(['data:x']);
  });
});
