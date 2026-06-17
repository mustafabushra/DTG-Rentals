/**
 * FileService — Attachment management and expiry logic.
 */
import type { Attachment, FileCategory } from '../models';

let _counter = 1;
function genId(): string { return `att_${Date.now()}_${_counter++}`; }

export const FileService = {

  /**
   * Create a new Attachment record.
   */
  create(params: {
    entityType: string;
    entityId: string;
    name: string;
    uri: string;
    mimeType: string;
    size?: number;
    category: FileCategory;
    expiryDate?: string;
    uploadedBy?: string;
    notes?: string;
    storagePath?: string;
  }): Attachment {
    const type = FileService.typeFromMime(params.mimeType);
    const expiryStatus = params.expiryDate
      ? FileService.computeExpiryStatus(params.expiryDate)
      : undefined;
    const { storagePath, ...rest } = params;
    return {
      id:           genId(),
      uploadedAt:   new Date().toISOString(),
      expiryStatus,
      type,
      storagePath,
      ...rest,
    };
  },

  /**
   * Derive display type from MIME.
   */
  typeFromMime(mime: string): Attachment['type'] {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (mime.includes('word') || mime.includes('document')) return 'doc';
    return 'other';
  },

  /**
   * Icon name for file type.
   */
  typeIcon(type: Attachment['type']): string {
    const map: Record<Attachment['type'], string> = {
      image: 'image-outline',
      pdf:   'document-text-outline',
      doc:   'document-outline',
      other: 'attach-outline',
    };
    return map[type];
  },

  /**
   * Compute expiry status based on today's date.
   */
  computeExpiryStatus(expiryDate: string): Attachment['expiryStatus'] {
    const exp  = new Date(expiryDate).getTime();
    const now  = Date.now();
    const diff = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    if (diff < 0)   return 'expired';
    if (diff <= 30) return 'expiring_soon';
    return 'active';
  },

  /**
   * Days until expiry (negative = expired).
   */
  daysUntilExpiry(expiryDate: string): number {
    const exp = new Date(expiryDate).getTime();
    return Math.ceil((exp - Date.now()) / (1000 * 60 * 60 * 24));
  },

  /**
   * Filter attachments for an entity.
   */
  forEntity(attachments: Attachment[], entityType: string, entityId: string): Attachment[] {
    return attachments.filter(a => a.entityType === entityType && a.entityId === entityId);
  },

  /**
   * Get all expiring/expired attachments.
   */
  getExpiringAttachments(attachments: Attachment[]): Attachment[] {
    return attachments.filter(a =>
      a.expiryDate && (a.expiryStatus === 'expiring_soon' || a.expiryStatus === 'expired'),
    );
  },

  /**
   * Sync expiry statuses on all attachments.
   */
  syncExpiryStatuses(attachments: Attachment[]): Attachment[] {
    return attachments.map(a => ({
      ...a,
      expiryStatus: a.expiryDate
        ? FileService.computeExpiryStatus(a.expiryDate)
        : undefined,
    }));
  },

  /**
   * Category Arabic label.
   */
  categoryLabel(category: FileCategory): string {
    const map: Record<FileCategory, string> = {
      contract:    'عقد',
      id:          'هوية',
      property:    'عقار',
      payment:     'دفعة',
      maintenance: 'صيانة',
      other:       'أخرى',
    };
    return map[category];
  },

  /**
   * Format file size for display.
   */
  formatSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },

  /**
   * Validate a file before upload.
   */
  validate(file: { name: string; size?: number; mimeType: string }): string | null {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimeType)) return 'نوع الملف غير مدعوم. المسموح: JPG, PNG, PDF';
    if (file.size && file.size > 20 * 1024 * 1024) return 'حجم الملف يتجاوز الحد الأقصى (20MB)';
    return null;
  },
};
