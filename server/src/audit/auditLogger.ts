import { auditService, AuditOptions } from '../services/audit.service.js';

export type { AuditOptions };

export async function recordAudit(options: AuditOptions): Promise<void> {
  await auditService.recordAudit(options);
}
