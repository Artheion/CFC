import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: string;
  resourceType?: string;
}

/**
 * Decorator to mark endpoints that require audit logging
 * @param action - The action being performed (e.g., 'UPDATE_PRICES', 'DELETE_USER')
 * @param resourceType - The type of resource (e.g., 'COCK', 'USER', 'FIGHT')
 */
export const AuditLog = (action: string, resourceType?: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, resourceType } as AuditLogMetadata);
