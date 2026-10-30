import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { hodOverviewService } from '../services/hod-overview.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

// All dashboard endpoints require authentication
router.use(requireAuth);

// 1. Unified current user dashboard endpoint
router.get('/', (req, res, next) => dashboardController.getDashboard(req, res, next));
router.get('/current', (req, res, next) => dashboardController.getDashboard(req, res, next));

// 2. Role-specific dashboard endpoints
router.get('/faculty', (req, res, next) => dashboardController.getFacultyDashboard(req, res, next));

router.get(
  '/hod',
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => dashboardController.getHodDashboard(req, res, next)
);

// HOD department console: attention, metrics, progress and calendar for one academic year
router.get('/hod/overview', requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD), async (req, res, next) => {
  try {
    const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    const data = await hodOverviewService.overview((req as any).user, { academicYear: str(req.query.academicYear), departmentId: str(req.query.departmentId) });
    sendSuccess(res, data, 'Department overview.');
  } catch (err) {
    next(err);
  }
});

router.get(
  '/dean',
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => dashboardController.getDeanDashboard(req, res, next)
);

router.get(
  '/leaderboards',
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => dashboardController.getLeaderboards(req, res, next)
);

router.get(
  '/principal',
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => dashboardController.getPrincipalDashboard(req, res, next)
);

router.get(
  '/admin',
  requireRole(ROLES.ADMIN),
  (req, res, next) => dashboardController.getAdminDashboard(req, res, next)
);

export default router;
