import { describe, it, expect } from 'vitest';
import {
  parseNumber, parseDeedDate, computeShares, sharesTotal, shareLabel,
  matchOwner, normalizeDeed, validateDeed, parseMortgage, deedForStorage,
} from './DeedService';

// قيم منقولة حرفياً من سند الوحدة 301 (دائرة الأراضي والأملاك - دبي، 19/11/2026)
const RAW_301 = {
  issuer: 'دائرة الأراضي والأملاك - دبي',
  certificateNo: '293510/2026',
  issueDate: '19/11/2026',
  mortgageStatus: 'Not mortgaged غير مرهونة',
  propertyType: 'Flat',
  community: 'Burj Khalifa',
  plotNo: '380', municipalityNo: '345 - 823', buildingNo: '2',
  buildingName: 'THE RESIDENCES II - TOWER 2',
  propertyNo: '301', floorNo: '3', parking: '91',
  suiteArea: '97.36', balconyArea: '14.12', totalArea: '111.48', totalAreaSqFt: '1,199.96',
  transferNote: 'إرث من منى بنت عبدالله بن عثمان القصبي',
  owners: [
    { name: 'NAIEF AHMED S DAHRAN', ownerNumber: '7645458', shareArea: '37.16' },
    { name: 'ABDULLAH AHMED S DAHRAN', ownerNumber: '5644567', shareArea: '37.16' },
    { name: 'HAIFA AHMED S DAHRAN', ownerNumber: '7645460', shareArea: '18.58' },
    { name: 'NOUF AHMED S DAHRAN', ownerNumber: '7645459', shareArea: '18.58' },
  ],
};

describe('parsing', () => {
  it.each([
    ['1,557.97', 1557.97], ['١٬٥٥٧٫٩٧', 1557.97], ['109/90', 109.9], ['97.36 م²', 97.36],
    ['', null], ['—', null],
  ])('parseNumber(%s)', (s, n) => expect(parseNumber(s)).toBe(n));

  it('dates in both orders, Arabic digits', () => {
    expect(parseDeedDate('19/11/2026')).toBe('2026-11-19');
    expect(parseDeedDate('2026-11-19')).toBe('2026-11-19');
    expect(parseDeedDate('١٩/١١/٢٠٢٦')).toBe('2026-11-19');
    expect(parseDeedDate('1448/05/10')).toBeNull(); // هجري لا يُخمَّن
  });

  it('mortgage status', () => {
    expect(parseMortgage('Not mortgaged')).toBe(false);
    expect(parseMortgage('غير مرهونة')).toBe(false);
    expect(parseMortgage('مرهونة لبنك')).toBe(true);
    expect(parseMortgage('')).toBeNull();
  });
});

describe('shares', () => {
  it('derives percent from share areas (deed 301 → ثلث/ثلث/سدس/سدس)', () => {
    const d = normalizeDeed(RAW_301);
    expect(d.owners.map(o => o.sharePercent)).toEqual([33.33, 33.33, 16.67, 16.67]);
    expect(Math.abs(sharesTotal(d.owners) - 100)).toBeLessThanOrEqual(0.1);
  });
  it('keeps written percents when areas are missing', () => {
    const s = computeShares([{ name: 'a', sharePercent: 60 }, { name: 'b', sharePercent: 40 }]);
    expect(s.map(o => o.sharePercent)).toEqual([60, 40]);
  });
  it('labels familiar fractions', () => {
    expect(shareLabel(33.33)).toContain('الثلث');
    expect(shareLabel(16.67)).toContain('السدس');
    expect(shareLabel(42)).toBe('42%');
  });
});

describe('normalizeDeed', () => {
  it('maps every field of a real Dubai deed', () => {
    const d = normalizeDeed(RAW_301);
    expect(d).toMatchObject({
      certificateNo: '293510/2026', issueDate: '2026-11-19', mortgaged: false,
      plotNo: '380', propertyNo: '301', floorNo: '3', parking: '91',
      suiteArea: 97.36, balconyArea: 14.12, totalArea: 111.48, totalAreaSqFt: 1199.96,
    });
    expect(validateDeed(d).errors).toEqual([]);
    expect(validateDeed(d).warnings).toEqual([]);
  });
  it('drops owners without a name', () => {
    const d = normalizeDeed({ owners: [{ name: '' }, { name: 'x', sharePercent: '100' }] });
    expect(d.owners).toHaveLength(1);
  });
});

describe('owner matching', () => {
  const sys = [
    { id: 'o1', name: 'نايف بن أحمد ظهران' },
    { id: 'o2', name: 'Haifa Ahmed Dahran' },
    { id: 'o3', name: 'نوف أحمد ظهران' },
    { id: 'o4', name: 'نوف سعيد' },
  ];
  it('matches first + family name, ignoring بن and hamza', () => {
    expect(matchOwner('نايف بن احمد بن سعيد ظهران', sys)).toBe('o1');
    expect(matchOwner('HAIFA AHMED S DAHRAN', sys)).toBe('o2');
  });
  it('drops بن as a word, not inside names', () => {
    expect(matchOwner('بندر بن أحمد ظهران', [{ id: 'b', name: 'بندر ظهران' }])).toBe('b');
  });
  it('refuses ambiguous or missing matches', () => {
    expect(matchOwner('نوف', sys)).toBeNull();
    expect(matchOwner('عبدالله احمد ظهران', sys)).toBeNull();
  });
});

describe('validation and storage', () => {
  it('rejects shares that do not sum to 100', () => {
    const d = normalizeDeed({ owners: [{ name: 'a', sharePercent: '50' }, { name: 'b', sharePercent: '30' }] });
    expect(validateDeed(d).errors[0]).toContain('80');
  });
  it('warns when areas disagree', () => {
    const d = normalizeDeed({ ...RAW_301, totalArea: '150' });
    expect(validateDeed(d).warnings.length).toBeGreaterThan(0);
  });
  it('writes cleared fields as null, never undefined', () => {
    const out = deedForStorage({ owners: [{ name: 'a', sharePercent: 100 }], plotNo: undefined as any });
    expect(out.plotNo).toBeNull();
    expect((out.owners as any[])[0].ownerId).toBeNull();
  });
});
