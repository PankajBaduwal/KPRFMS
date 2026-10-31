import { Router } from 'express';
import { Institution } from '../models/Institution.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { resolveActiveTenant } from '../../tenancy/registry.js';
import { runInTenant } from '../../tenancy/context.js';
import { User, USER_STATUS } from '../../models/User.js';
import { Department } from '../../models/Department.js';
import { sessionService } from '../../services/session.service.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../audit/auditLogger.js';
import { AUDIT_ACTIONS } from '../../models/AuditLog.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { PlatformUser } from '../models/PlatformUser.js';
import { platformAuthService, DEMO_OPERATOR_EMAIL } from '../services/platformAuth.service.js';
import { env } from '../../config/env.js';
import type { Request, Response, NextFunction } from 'express';

const router = Router();

/** Demo sign-in exists only where DEMO_LOGIN_ENABLED=true; elsewhere the routes do not exist. */
const demoOnly = (_req: Request, _res: Response, next: NextFunction) =>
  env.DEMO_LOGIN_ENABLED ? next() : next(AppError.notFound('Not found.'));

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Institution finder for the sign-in page. Lists ACTIVE institutions only.
 */
router.get('/institutions', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim().slice(0, 80);
    const filter: Record<string, unknown> = { status: 'ACTIVE' };
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { city: rx }];
    }
    const items = await Institution.find(filter)
      .select('code name type city state logo.url')
      .sort({ name: 1 })
      .limit(20)
      .lean();
    sendSuccess(
      res,
      items.map((i) => ({
        code: i.code,
        name: i.name,
        type: i.type,
        city: i.city || '',
        state: i.state || '',
        logoUrl: i.logo?.url || '',
      })),
      'Institutions.'
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Public catalog of verified demonstration accounts grouped by institution.
 * Returns only explicitly tagged demo users (isDemo: true), organized by institutional
 * leadership and department rosters.
 */
router.get('/demo/accounts', demoOnly, async (_req, res, next) => {
  try {
    const institutions = await Institution.find({ status: 'ACTIVE' })
      .select('code name type city state')
      .sort({ name: 1 })
      .lean();

    const catalog = [];

    for (const inst of institutions) {
      try {
        const tenant = await resolveActiveTenant(inst.code);
        const data = await runInTenant(tenant, async () => {
          const depts = await Department.find({ isActive: { $ne: false } })
            .select('code name hodId')
            .sort({ code: 1 })
            .lean();

          // Only users explicitly tagged as isDemo: true and active
          const users = await User.find({
            isDemo: true,
            status: USER_STATUS.ACTIVE,
            email: { $not: /inactive/i },
          })
            .select('employeeId name email role designation departmentId')
            .lean();

          const formatUser = (u: any) => ({
            id: String(u._id),
            employeeId: u.employeeId,
            name: u.name,
            email: u.email,
            role: u.role,
            designation: u.designation || '',
            departmentId: u.departmentId ? String(u.departmentId) : undefined,
          });

          // Institutional Leadership
          const principal = users.find((u) => u.role === 'PRINCIPAL');
          const admin = users.find((u) => u.role === 'ADMIN');
          const dean = users.find((u) => u.role === 'DEAN');

          const leadership = [
            principal && { ...formatUser(principal), roleLabel: 'Principal' },
            admin && { ...formatUser(admin), roleLabel: 'Institution Admin' },
            dean && { ...formatUser(dean), roleLabel: 'Dean (Academic Affairs)' },
          ].filter(Boolean);

          // Department wise HODs and Faculty
          const departments = depts
            .filter((d) => !/179|test|audit/i.test(d.code))
            .map((dept) => {
              const deptIdStr = String(dept._id);
              const hod =
                users.find((u) => u.role === 'HOD' && (String(u.departmentId) === deptIdStr || String(dept.hodId) === String(u._id))) ||
                users.find((u) => u.role === 'HOD' && u.email.toLowerCase().includes(`hod.${dept.code.toLowerCase()}@`));

              const faculty = users
                .filter(
                  (u) =>
                    u.role === 'FACULTY' &&
                    (String(u.departmentId) === deptIdStr || u.email.toLowerCase().includes(`.${dept.code.toLowerCase()}@`))
                )
                .map(formatUser);

              return {
                id: deptIdStr,
                code: dept.code,
                name: dept.name,
                hod: hod ? { ...formatUser(hod), roleLabel: 'Head of Department' } : null,
                faculty,
              };
            });

          return {
            institution: {
              code: inst.code,
              name: inst.name,
              type: inst.type,
              city: inst.city,
              state: inst.state,
            },
            leadership,
            departments,
          };
        });

        catalog.push(data);
      } catch (tenantErr) {
        // Skip unresolvable tenant gracefully
        continue;
      }
    }


    // The demo operator is offered only when that local account exists and is active
    const operator = await PlatformUser.findOne({ email: DEMO_OPERATOR_EMAIL, status: 'ACTIVE' }).select('email name').lean();
    const platformSuperAdmin = operator
      ? {
          email: operator.email,
          name: operator.name || 'Demo Super Admin',
          role: 'PLATFORM_SUPER_ADMIN',
          roleLabel: 'Platform Super Admin',
          designation: 'Platform Operator & Super Administrator',
          isPlatform: true,
        }
      : null;

    sendSuccess(
      res,
      {
        institutions: catalog,
        platformSuperAdmin,
      },
      'Demonstration accounts catalog retrieved.'
    );
  } catch (error) {
    next(error);
  }
});

/**
 * One-click demo authentication endpoint.
 * Securely verifies that the target account is explicitly designated as a demo user (isDemo: true),
 * executes real authentication within the tenant context, creates a tracked session, and sets
 * the official session cookies.
 */
router.post('/demo/login', demoOnly, authLimiter, async (req, res, next) => {
  try {
    const { institutionCode, email, userId, role } = req.body;
    if (!institutionCode) {
      throw AppError.badRequest('Institution code is required.');
    }

    // Platform: only the local demo operator, never a real operator account
    if (institutionCode === 'platform' || role === 'PLATFORM_SUPER_ADMIN') {
      const result = await platformAuthService.demoLogin(req, res);
      return sendSuccess(res, { isPlatform: true, user: result }, 'Platform Super Admin signed in successfully.');
    }

    // Institutional Demo Login
    const tenant = await resolveActiveTenant(institutionCode);
    const result = await runInTenant(tenant, async () => {
      const query: Record<string, unknown> = {
        isDemo: true,
        status: USER_STATUS.ACTIVE,
      };

      if (userId) {
        query._id = String(userId);
      } else if (email) {
        query.email = String(email).trim().toLowerCase();
      } else if (role) {
        query.role = String(role);
      } else {
        throw AppError.badRequest('User ID, email, or role must be provided.');
      }

      const user = await User.findOne(query);
      if (!user || !user.isDemo) {
        throw AppError.forbidden('Only verified demonstration accounts can be accessed through one-click demo login.');
      }

      // Reset failed attempts, update last login
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Issue real HTTP-only session cookie
      await sessionService.start(user, req, res);

      await recordAudit({
        userId: user._id,
        action: AUDIT_ACTIONS.LOGIN,
        req,
        details: { role: user.role, employeeId: user.employeeId, isDemo: true, authMethod: 'ONE_CLICK_DEMO' },
      });

      return {
        id: user._id.toString(),
        employeeId: user.employeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId?.toString(),
        designation: user.designation,
        status: user.status,
        isDemo: true,
        lastLogin: user.lastLogin,
      };
    });

    sendSuccess(
      res,
      {
        user: result,
        institution: { code: tenant.code },
      },
      'Demonstration session established successfully.'
    );
  } catch (error) {
    next(error);
  }
});

export default router;
