import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES, ALL_ROLES, type Role } from '../permissions/roles.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { assignmentService } from '../services/assignment.service.js';
import { Department } from '../models/Department.js';
import { User, USER_STATUS } from '../models/User.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';

/** Leadership assignments (department heads, principal, deans): institutional Admin or Principal. */
const router = Router();
router.use(requireAuth, requireRole(ROLES.ADMIN, ROLES.PRINCIPAL));

const actorOf = (req: AuthenticatedRequest) => ({ id: req.user!.id, label: `${req.user!.role}:${req.user!.email}` });

/** Who leads what: each department's head plus the principal(s) and deans. */
router.get('/', async (_req, res, next) => {
  try {
    const [departments, leaders] = await Promise.all([
      Department.find({}).select('code name isActive hodId').populate('hodId', 'name email employeeId role status').sort({ code: 1 }).lean(),
      User.find({ role: { $in: [ROLES.PRINCIPAL, ROLES.DEAN, ROLES.ADMIN] }, status: USER_STATUS.ACTIVE }).select('name email employeeId role designation').sort({ role: 1, name: 1 }).lean(),
    ]);
    sendSuccess(res, { departments, leaders }, 'Assignments.');
  } catch (error) {
    next(error);
  }
});

router.put('/departments/:id/head', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z.object({ userId: z.string().nullable(), replaceHod: z.boolean().optional() }).parse(req.body);
    await assignmentService.setDepartmentHead(String(req.params.id), body.userId, actorOf(req), { replaceHod: body.replaceHod }, req);
    sendSuccess(res, null, 'Department head updated.');
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z
      .object({
        role: z.enum(ALL_ROLES as [Role, ...Role[]]).optional(),
        departmentId: z.string().nullable().optional(),
        replaceHod: z.boolean().optional(),
        replacePrincipal: z.boolean().optional(),
      })
      .parse(req.body);
    // Only an Admin can grant or remove the Admin role
    const target = await User.findById(req.params.id).select('role').lean();
    if (req.user!.role !== ROLES.ADMIN && (body.role === ROLES.ADMIN || target?.role === ROLES.ADMIN)) {
      throw AppError.forbidden('Only an administrator can change administrator accounts.');
    }
    const result = await assignmentService.apply(
      String(req.params.id),
      { role: body.role, departmentId: body.departmentId },
      actorOf(req),
      { replaceHod: body.replaceHod, replacePrincipal: body.replacePrincipal },
      req
    );
    sendSuccess(res, result, result.changed ? 'Assignment updated.' : 'Nothing to change.');
  } catch (error) {
    next(error);
  }
});

export default router;
