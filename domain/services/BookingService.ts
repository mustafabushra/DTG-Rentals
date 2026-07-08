/**
 * BookingService — All Holiday-Home booking business logic.
 * Pure functions only (no React, no Firestore) so revenue math is testable
 * and can be reused by AppProvider KPIs, financial reports, and UI alike.
 *
 * Date convention: all dates are 'YYYY-MM-DD' strings.
 *   - checkIn is INCLUSIVE (guest occupies that night)
 *   - checkOut is EXCLUSIVE (guest leaves that morning; that night is free)
 *   - nights = number of occupied nights = day(checkOut) − day(checkIn)
 * A same-day turnover (booking A checkOut == booking B checkIn) is NOT a conflict.
 * All arithmetic uses UTC day-numbers to avoid timezone drift.
 */
import type { Booking } from '../../data/mockData';

/** Parse 'YYYY-MM-DD' → integer day number (days since epoch, UTC). NaN if malformed. */
function dayNum(date: string): number {
  const parts = date?.split('-');
  if (!parts || parts.length !== 3) return NaN;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) return NaN;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export const BookingService = {

  /** Number of occupied nights between checkIn (inclusive) and checkOut (exclusive). */
  nights(checkIn: string, checkOut: string): number {
    const a = dayNum(checkIn);
    const b = dayNum(checkOut);
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.max(0, b - a);
  },

  /** Total price for a stay. */
  computeTotal(nights: number, nightlyRate: number): number {
    return Math.round(Math.max(0, nights) * Math.max(0, nightlyRate));
  },

  /** Effective per-night revenue for a booking (honours a manually-overridden total). */
  perNight(b: Pick<Booking, 'nights' | 'totalAmount' | 'nightlyRate'>): number {
    if (b.nights > 0 && b.totalAmount > 0) return b.totalAmount / b.nights;
    return b.nightlyRate;
  },

  /**
   * Do two date ranges overlap? checkOut is exclusive, so [1→3) and [3→5) do NOT overlap.
   */
  rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
    const a1 = dayNum(aIn), a2 = dayNum(aOut), b1 = dayNum(bIn), b2 = dayNum(bOut);
    if ([a1, a2, b1, b2].some(isNaN)) return false;
    return a1 < b2 && b1 < a2;
  },

  /**
   * Is there a confirmed booking on `unitId` that conflicts with [checkIn, checkOut)?
   * Pass `excludeId` when editing an existing booking so it doesn't clash with itself.
   */
  hasConflict(
    bookings: Booking[],
    unitId: string,
    checkIn: string,
    checkOut: string,
    excludeId?: string,
  ): Booking | null {
    for (const b of bookings) {
      if (b.unitId !== unitId) continue;
      if (b.status !== 'confirmed') continue;
      if (excludeId && b.id === excludeId) continue;
      if (BookingService.rangesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) return b;
    }
    return null;
  },

  /**
   * Number of a booking's nights that fall within the period [periodStart, periodEnd).
   * Used to split a cross-month/period stay across reporting buckets.
   */
  nightsInPeriod(b: Pick<Booking, 'checkIn' | 'checkOut'>, periodStart: string, periodEnd: string): number {
    const s = Math.max(dayNum(b.checkIn), dayNum(periodStart));
    const e = Math.min(dayNum(b.checkOut), dayNum(periodEnd));
    if (isNaN(s) || isNaN(e)) return 0;
    return Math.max(0, e - s);
  },

  /**
   * Occupancy-based revenue recognised within [periodStart, periodEnd) (end exclusive),
   * summed only over confirmed bookings' nights that actually fall in the window.
   */
  revenueForPeriod(bookings: Booking[], periodStart: string, periodEnd: string): number {
    let total = 0;
    for (const b of bookings) {
      if (b.status !== 'confirmed') continue;
      const n = BookingService.nightsInPeriod(b, periodStart, periodEnd);
      if (n > 0) total += n * BookingService.perNight(b);
    }
    return Math.round(total);
  },

  /** Total recognised revenue for all confirmed bookings (no period bound). */
  totalRevenue(bookings: Booking[]): number {
    return bookings
      .filter(b => b.status === 'confirmed')
      .reduce((s, b) => s + b.totalAmount, 0);
  },

  /** Cash-basis collected amount across confirmed bookings. */
  collected(bookings: Booking[]): number {
    return bookings
      .filter(b => b.status === 'confirmed')
      .reduce((s, b) => s + (b.paidAmount || 0), 0);
  },

  /**
   * Occupancy rate (0–100) for a set of units over [periodStart, periodEnd):
   * booked nights ÷ available nights.
   */
  occupancyRate(
    bookings: Booking[],
    unitIds: Set<string> | string[],
    periodStart: string,
    periodEnd: string,
  ): number {
    const ids = unitIds instanceof Set ? unitIds : new Set(unitIds);
    if (ids.size === 0) return 0;
    const periodNights = Math.max(0, dayNum(periodEnd) - dayNum(periodStart));
    const available = periodNights * ids.size;
    if (available <= 0) return 0;
    let booked = 0;
    for (const b of bookings) {
      if (b.status !== 'confirmed' || !ids.has(b.unitId)) continue;
      booked += BookingService.nightsInPeriod(b, periodStart, periodEnd);
    }
    return Math.min(100, Math.round((booked / available) * 100));
  },

  /**
   * Validate a booking form. Returns map of field → Arabic error, empty if valid.
   * `existing` is the full booking list used for conflict detection.
   */
  validate(
    data: { unitId?: string; guestName?: string; checkIn?: string; checkOut?: string; nightlyRate?: number },
    existing: Booking[],
    excludeId?: string,
  ): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!data.unitId)              errors.unitId    = 'الوحدة مطلوبة';
    if (!data.guestName?.trim())   errors.guestName = 'اسم الضيف مطلوب';
    if (!data.checkIn)             errors.checkIn   = 'تاريخ الوصول مطلوب';
    if (!data.checkOut)            errors.checkOut  = 'تاريخ المغادرة مطلوب';
    if (!data.nightlyRate || data.nightlyRate <= 0) errors.nightlyRate = 'سعر الليلة يجب أن يكون أكبر من صفر';
    if (data.checkIn && data.checkOut) {
      if (BookingService.nights(data.checkIn, data.checkOut) <= 0) {
        errors.checkOut = 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول';
      } else if (data.unitId) {
        const clash = BookingService.hasConflict(existing, data.unitId, data.checkIn, data.checkOut, excludeId);
        if (clash) {
          errors.checkOut = `متعارض مع حجز آخر من ${clash.checkIn} إلى ${clash.checkOut}`;
        }
      }
    }
    return errors;
  },

  /** Is a unit managed as a Holiday Home? */
  isNightly(unit: { rentalModel?: string } | null | undefined): boolean {
    return unit?.rentalModel === 'nightly';
  },
};
