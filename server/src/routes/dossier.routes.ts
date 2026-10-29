import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getCurrentAcademicYear } from '../utils/academicYear.js';
import { dossierService } from '../services/dossier.service.js';
import { dossierRecordsService, DOSSIER_OPTIONS } from '../services/dossier-records.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Faculty dossier: summary and profile completion, courses & certifications, achievements,
 * the departmental / institutional directory, category rankings and department comparison.
 */
const router = Router();
router.use(requireAuth);

type Handler = (req: AuthenticatedRequest) => Promise<[unknown, string, number?]>;
const h = (fn: Handler) => async (req: any, res: any, next: any) => {
  try {
    const [data, message, status] = await fn(req as AuthenticatedRequest);
    sendSuccess(res, data, message, status ?? 200);
  } catch (error) {
    next(error);
  }
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const LEADERS = [ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN];

router.get('/options', h(async () => [DOSSIER_OPTIONS, 'Dossier options.']));

router.get('/summary', h(async (req) => [await dossierService.summary(req.user!, str(req.query.facultyId)), 'Dossier summary.']));
router.get('/completion', h(async (req) => [await dossierService.completion(req.user!, str(req.query.facultyId)), 'Profile completion.']));

router.get('/directory', requireRole(...LEADERS), h(async (req) => [
  await dossierService.directory(req.user!, {
    departmentId: str(req.query.departmentId),
    designation: str(req.query.designation),
    search: str(req.query.search),
    academicYear: str(req.query.academicYear),
  }),
  'Faculty directory.',
]));

router.get('/rankings/metrics', requireRole(...LEADERS), h(async () => [dossierService.metricCatalog(), 'Ranking metrics.']));
router.get('/rankings', requireRole(...LEADERS), h(async (req) => [
  await dossierService.ranking(req.user!, {
    metric: str(req.query.metric) ?? 'publications',
    departmentId: str(req.query.departmentId),
    from: str(req.query.from),
    to: str(req.query.to),
    page: Number(req.query.page) || undefined,
    limit: Number(req.query.limit) || undefined,
  }),
  'Faculty ranking.',
]));
router.get('/departments', requireRole(ROLES.DEAN, ROLES.PRINCIPAL, ROLES.ADMIN), h(async (req) => [
  await dossierService.departments(req.user!, {
    metrics: str(req.query.metrics)?.split(',').map((s) => s.trim()).filter(Boolean),
    from: str(req.query.from),
    to: str(req.query.to),
  }),
  'Department comparison.',
]));

router.get('/courses/stats', h(async (req) => [await dossierRecordsService.courseStats(req.user!, str(req.query.facultyId), await getCurrentAcademicYear()), 'Course statistics.']));

// Records: kind is "course" or "achievement"
const reviewSchema = z.object({ action: z.enum(['VERIFY', 'RETURN', 'REJECT']), comment: z.string().trim().max(1000).optional() });
const kinds = ['courses', 'achievements'] as const;
const kindOf = (k: string) => (k === 'courses' ? 'course' : 'achievement');

for (const k of kinds) {
  const kind = kindOf(k);
  router.get(`/${k}`, h(async (req) => [await dossierRecordsService.list(req.user!, kind, req.query as Record<string, string | undefined>), 'Records.']));
  router.post(`/${k}`, h(async (req) => [await dossierRecordsService.create(req.user!, kind, req.body ?? {}, req), 'Record saved.', 201]));
  router.get(`/${k}/:id`, h(async (req) => [await dossierRecordsService.get(req.user!, kind, String(req.params.id)), 'Record.']));
  router.patch(`/${k}/:id`, h(async (req) => [await dossierRecordsService.update(req.user!, kind, String(req.params.id), req.body ?? {}, req), 'Record updated.']));
  router.delete(`/${k}/:id`, h(async (req) => [await dossierRecordsService.remove(req.user!, kind, String(req.params.id), req), 'Record deleted.']));
  router.post(`/${k}/:id/submit`, h(async (req) => [await dossierRecordsService.submit(req.user!, kind, String(req.params.id), req), 'Submitted for verification.']));
  router.post(`/${k}/:id/review`, requireRole(ROLES.HOD, ROLES.DEAN, ROLES.PRINCIPAL), h(async (req) => {
    const { action, comment } = reviewSchema.parse(req.body ?? {});
    return [await dossierRecordsService.review(req.user!, kind, String(req.params.id), action, comment, req), 'Decision recorded.'];
  }));
}

export default router;
