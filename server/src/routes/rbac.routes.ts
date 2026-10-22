import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { requireDepartmentAccess } from '../middleware/requireDepartmentAccess.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOwnership } from '../middleware/requireOwnership.js';
import { ROLES } from '../permissions/roles.js';
import { PERMISSIONS } from '../permissions/permissions.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// 1. Role-specific test routes
router.get('/faculty-only', requireAuth, requireRole(ROLES.FACULTY), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'Faculty-only resource accessed successfully.');
});

router.get('/hod-only', requireAuth, requireRole(ROLES.HOD), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'HOD-only resource accessed successfully.');
});

router.get('/dean-only', requireAuth, requireRole(ROLES.DEAN), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'Dean-only resource accessed successfully.');
});

router.get('/principal-only', requireAuth, requireRole(ROLES.PRINCIPAL), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'Principal-only resource accessed successfully.');
});

router.get('/admin-only', requireAuth, requireRole(ROLES.ADMIN), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'Admin-only resource accessed successfully.');
});

router.get('/leadership', requireAuth, requireRole(ROLES.PRINCIPAL, ROLES.DEAN, ROLES.ADMIN), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'Institutional leadership resource accessed.');
});

// 2. Department-scoped test route
router.get('/department/:departmentId', requireAuth, requireDepartmentAccess('departmentId'), (req: AuthenticatedRequest, res) => {
  sendSuccess(
    res,
    { userDepartment: req.user?.departmentId, targetDepartment: req.params.departmentId },
    'Department-scoped resource accessed successfully.'
  );
});

// 3. Permission-based test route
router.get('/permission/system-config', requireAuth, requirePermission(PERMISSIONS.SYSTEM_CONFIG), (req: AuthenticatedRequest, res) => {
  sendSuccess(res, { role: req.user?.role }, 'System configuration permission verified.');
});

// 4. Ownership-based test route
router.put('/owner/:userId', requireAuth, requireOwnership('userId'), (req: AuthenticatedRequest, res) => {
  sendSuccess(
    res,
    { userId: req.user?.id, targetUserId: req.params.userId },
    'Resource ownership or administrative override verified.'
  );
});

export default router;
