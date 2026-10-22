import { Router } from 'express';
import { timetableController } from '../controllers/timetable.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';

const router = Router();

// Slot CRUD & Conflict Check
router.get('/slots', requireAuth, (req, res, next) =>
  timetableController.getSlots(req, res, next)
);

router.post(
  '/slots',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.createSlot(req, res, next)
);

router.put(
  '/slots/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.updateSlot(req, res, next)
);

router.patch(
  '/slots/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.updateSlot(req, res, next)
);

router.delete(
  '/slots/:id',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.deleteSlot(req, res, next)
);

router.post('/check-conflict', requireAuth, (req, res, next) =>
  timetableController.checkSlotConflict(req, res, next)
);

// Timetable Views
router.get('/my-timetable', requireAuth, (req, res, next) =>
  timetableController.getMyTimetable(req, res, next)
);

router.get('/faculty/:facultyId', requireAuth, (req, res, next) =>
  timetableController.getFacultyTimetable(req, res, next)
);

router.get(
  '/department/:departmentId',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.HOD, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.getDepartmentTimetable(req, res, next)
);

router.get(
  '/institution',
  requireAuth,
  requireRole(ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN),
  (req, res, next) => timetableController.getInstitutionalTimetable(req, res, next)
);

// Substitutions
router.get('/substitutions', requireAuth, (req, res, next) =>
  timetableController.getSubstitutions(req, res, next)
);

router.post('/substitutions', requireAuth, (req, res, next) =>
  timetableController.createSubstitution(req, res, next)
);

router.post('/substitutions/check-conflict', requireAuth, (req, res, next) =>
  timetableController.checkSubstitutionConflict(req, res, next)
);

router.put('/substitutions/:id/cancel', requireAuth, (req, res, next) =>
  timetableController.cancelSubstitution(req, res, next)
);

router.post('/substitutions/:id/cancel', requireAuth, (req, res, next) =>
  timetableController.cancelSubstitution(req, res, next)
);

router.patch('/substitutions/:id/cancel', requireAuth, (req, res, next) =>
  timetableController.cancelSubstitution(req, res, next)
);

export default router;
