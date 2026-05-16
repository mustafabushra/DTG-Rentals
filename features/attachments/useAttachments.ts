/**
 * useAttachments — Feature-layer hook for file attachment management.
 */
import { useMemo } from 'react';
import { useApp }       from '../../context/AppProvider';
import { FileService }  from '../../domain/services/FileService';
import type { FileCategory } from '../../domain/models';

export function useAttachments(entityType: string, entityId: string) {
  const { attachments: allAttachments, addAttachment, deleteAttachment, currentUser } = useApp();

  const attachments = useMemo(
    () => FileService.forEntity(allAttachments, entityType, entityId),
    [allAttachments, entityType, entityId],
  );

  const add = (params: {
    name: string;
    uri: string;
    mimeType: string;
    size?: number;
    category: FileCategory;
    expiryDate?: string;
    notes?: string;
  }) => {
    return addAttachment({
      entityType,
      entityId,
      uploadedBy: currentUser.name,
      ...params,
    });
  };

  const remove = deleteAttachment;

  const expiryColor = (status?: string): string => {
    if (status === 'expired')       return '#E74C3C';
    if (status === 'expiring_soon') return '#F39C12';
    return '#27AE60';
  };

  return {
    attachments,
    add,
    remove,
    typeIcon:      FileService.typeIcon,
    formatSize:    FileService.formatSize,
    categoryLabel: FileService.categoryLabel,
    expiryColor,
  };
}
