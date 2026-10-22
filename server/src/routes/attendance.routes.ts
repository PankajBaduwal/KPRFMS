import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// =============================================
// OVERVIEWS & SUMMARIES (Static routes first)
// =============================================
router.get(
  '/overview/institution',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => attendanceController.getInstitutionOverview(req, res, next)
);

router.get('/my', requireAuth, (req, res, next) =>
  attendanceController.getMyAttendance(req, res, next)
);

router.get(
  '/daily/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.getDailyDepartment(req, res, next)
);

router.get('/summary/monthly/faculty/:facultyId', requireAuth, (req, res, next) =>
  attendanceController.getMonthlyFacultySummary(req, res, next)
);

router.get(
  '/summary/monthly/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.getDepartmentMonthlySummary(req, res, next)
);

router.get('/summary/yearly/faculty/:facultyId', requireAuth, (req, res, next) =>
  attendanceController.getYearlySummary(req, res, next)
);

// =============================================
// CORRECTION WORKFLOW
// =============================================
router.get('/corrections', requireAuth, (req, res, next) =>
  attendanceController.getCorrectionRequests(req, res, next)
);

router.post('/corrections', requireAuth, (req, res, next) =>
  attendanceController.submitCorrectionRequest(req, res, next)
);

router.put(
  '/corrections/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.reviewCorrectionRequest(req, res, next)
);

router.patch(
  '/corrections/:id/review',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.reviewCorrectionRequest(req, res, next)
);

router.post(
  '/corrections/:id/approve',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'APPROVED' };
    return attendanceController.reviewCorrectionRequest(req, res, next);
  }
);

router.post(
  '/corrections/:id/reject',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => {
    req.body = { ...req.body, status: 'REJECTED' };
    return attendanceController.reviewCorrectionRequest(req, res, next);
  }
);

// =============================================
// RECORDING & MANAGEMENT
// =============================================
router.post('/', requireAuth, (req, res, next) =>
  attendanceController.recordAttendance(req, res, next)
);

router.post('/mark', requireAuth, (req, res, next) =>
  attendanceController.recordAttendance(req, res, next)
);

router.post(
  '/bulk',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.bulkRecordAttendance(req, res, next)
);

router.post(
  '/lock',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL),
  (req, res, next) => attendanceController.lockAttendance(req, res, next)
);

router.get('/', requireAuth, (req, res, next) =>
  attendanceController.getRecords(req, res, next)
);

router.put(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.updateAttendance(req, res, next)
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.HOD),
  (req, res, next) => attendanceController.updateAttendance(req, res, next)
);

router.get('/:id/audit', requireAuth, (req, res, next) =>
  attendanceController.getAuditHistory(req, res, next)
);

export default router;
