import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { adminService } from '../services/admin.service.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  toggleUserStatusSchema,
  rejectRegistrationSchema,
  departmentSchema,
  programSchema,
  subjectAdminSchema,
  academicYearSchema,
  semesterSchema,
  masterItemSchema,
  institutionSettingsSchema,
} from '../validators/admin.validator.js';

export class AdminController {
  // 1. Overview
  async getOverview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const data = await adminService.getOverviewStats();
      sendSuccess(res, data, 'Admin overview statistics loaded.');
    } catch (err) {
      next(err);
    }
  }

  // 2. Users
  async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const query = {
        role: req.query.role as string,
        departmentId: req.query.departmentId as string,
        status: req.query.status as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      };
      const result = await adminService.getUsers(query);
      sendSuccess(res, result, 'Users retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const user = await adminService.getUserById(String(req.params.id));
      sendSuccess(res, user, 'User details retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = createUserSchema.parse(req.body);
      const result = await adminService.createUser(input, req.user!.id, req);
      sendCreated(res, result, 'User created successfully.');
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = updateUserSchema.parse(req.body);
      const updated = await adminService.updateUser(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, updated, 'User updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  async toggleUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const { status } = toggleUserStatusSchema.parse(req.body);
      const updated = await adminService.toggleUserStatus(String(req.params.id), status, req.user!.id, req);
      sendSuccess(res, updated, `User account ${status.toLowerCase()}d successfully.`);
    } catch (err) {
      next(err);
    }
  }

  async approveRegistration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const user = await adminService.approveRegistration(String(req.params.id), req.user!.id, req);
      sendSuccess(res, user, 'Registration approved. The faculty member can now sign in.');
    } catch (err) {
      next(err);
    }
  }

  async rejectRegistration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const { reason } = rejectRegistrationSchema.parse(req.body ?? {});
      const result = await adminService.rejectRegistration(String(req.params.id), reason, req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = resetPasswordSchema.parse(req.body);
      const result = await adminService.resetUserPassword(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteUser(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 3. Roles
  async getRoles(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const roles = await adminService.getRolesOverview();
      sendSuccess(res, roles, 'Roles overview retrieved.');
    } catch (err) {
      next(err);
    }
  }

  // 4. Departments
  async getDepartments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const depts = await adminService.getDepartments();
      sendSuccess(res, depts, 'Departments retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async getDepartmentById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const dept = await adminService.getDepartmentById(String(req.params.id));
      sendSuccess(res, dept, 'Department details retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = departmentSchema.parse(req.body);
      const dept = await adminService.createDepartment(input, req.user!.id, req);
      sendCreated(res, dept, 'Department created successfully.');
    } catch (err) {
      next(err);
    }
  }

  async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = departmentSchema.parse(req.body);
      const dept = await adminService.updateDepartment(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, dept, 'Department updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteDepartment(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 5. Programs
  async getPrograms(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const progs = await adminService.getPrograms(req.query.departmentId as string);
      sendSuccess(res, progs, 'Degree programs retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async getProgramById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const prog = await adminService.getProgramById(String(req.params.id));
      sendSuccess(res, prog, 'Program details retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createProgram(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = programSchema.parse(req.body);
      const prog = await adminService.createProgram(input, req.user!.id, req);
      sendCreated(res, prog, 'Program created successfully.');
    } catch (err) {
      next(err);
    }
  }

  async updateProgram(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = programSchema.parse(req.body);
      const prog = await adminService.updateProgram(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, prog, 'Program updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  async deleteProgram(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteProgram(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 6. Subjects
  async getSubjects(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const query = {
        department: req.query.department as string,
        semester: req.query.semester ? Number(req.query.semester) : undefined,
        academicYear: req.query.academicYear as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 15,
      };
      const result = await adminService.getSubjects(query);
      sendSuccess(res, result, 'Subjects retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async getSubjectById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const sub = await adminService.getSubjectById(String(req.params.id));
      sendSuccess(res, sub, 'Subject retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = subjectAdminSchema.parse(req.body);
      const sub = await adminService.createSubject(input, req.user!.id, req);
      sendCreated(res, sub, 'Subject created successfully.');
    } catch (err) {
      next(err);
    }
  }

  async updateSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = subjectAdminSchema.parse(req.body);
      const sub = await adminService.updateSubject(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, sub, 'Subject updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  async deleteSubject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteSubject(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 7. Academic Years
  async getAcademicYears(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const years = await adminService.getAcademicYears();
      sendSuccess(res, years, 'Academic years retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createAcademicYear(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = academicYearSchema.parse(req.body);
      const year = await adminService.createAcademicYear(input, req.user!.id, req);
      sendCreated(res, year, 'Academic year created.');
    } catch (err) {
      next(err);
    }
  }

  async updateAcademicYear(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = academicYearSchema.parse(req.body);
      const year = await adminService.updateAcademicYear(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, year, 'Academic year updated.');
    } catch (err) {
      next(err);
    }
  }

  async setCurrentAcademicYear(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const year = await adminService.setCurrentAcademicYear(String(req.params.id), req.user!.id, req);
      sendSuccess(res, year, `Academic year '${year.name}' set as active current year.`);
    } catch (err) {
      next(err);
    }
  }

  async deleteAcademicYear(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteAcademicYear(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 8. Semesters
  async getSemesters(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const sems = await adminService.getSemesters(req.query.academicYear as string);
      sendSuccess(res, sems, 'Semesters retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createSemester(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = semesterSchema.parse(req.body);
      const sem = await adminService.createSemester(input, req.user!.id, req);
      sendCreated(res, sem, 'Semester created.');
    } catch (err) {
      next(err);
    }
  }

  async updateSemester(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = semesterSchema.parse(req.body);
      const sem = await adminService.updateSemester(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, sem, 'Semester updated.');
    } catch (err) {
      next(err);
    }
  }

  async setCurrentSemester(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const sem = await adminService.setCurrentSemester(String(req.params.id), req.user!.id, req);
      sendSuccess(res, sem, `Semester '${sem.name}' set as active current semester.`);
    } catch (err) {
      next(err);
    }
  }

  async deleteSemester(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteSemester(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 9. Master Items
  async getMasterItems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const category = (req.params.category ? String(req.params.category) : undefined) || (req.query.category as string);
      const items = await adminService.getMasterItems(category);
      sendSuccess(res, items, 'Master items retrieved.');
    } catch (err) {
      next(err);
    }
  }

  async createMasterItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = masterItemSchema.parse(req.body);
      const item = await adminService.createMasterItem(input, req.user!.id, req);
      sendCreated(res, item, 'Master item created.');
    } catch (err) {
      next(err);
    }
  }

  async updateMasterItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = masterItemSchema.parse(req.body);
      const item = await adminService.updateMasterItem(String(req.params.id), input, req.user!.id, req);
      sendSuccess(res, item, 'Master item updated.');
    } catch (err) {
      next(err);
    }
  }

  async toggleMasterItemStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const isActive = req.body.isActive === true;
      const item = await adminService.toggleMasterItemStatus(String(req.params.id), isActive, req.user!.id, req);
      sendSuccess(res, item, `Master item status updated to ${isActive ? 'ACTIVE' : 'INACTIVE'}.`);
    } catch (err) {
      next(err);
    }
  }

  async deleteMasterItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const result = await adminService.deleteMasterItem(String(req.params.id), req.user!.id, req);
      sendSuccess(res, result, result.message);
    } catch (err) {
      next(err);
    }
  }

  // 10. Institution Settings
  async getInstitutionSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const settings = await adminService.getInstitutionSettings();
      sendSuccess(res, settings, 'Institution settings loaded.');
    } catch (err) {
      next(err);
    }
  }

  async updateInstitutionSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const input = institutionSettingsSchema.parse(req.body);
      const settings = await adminService.updateInstitutionSettings(input, req.user!.id, req);
      sendSuccess(res, settings, 'Institution settings updated successfully.');
    } catch (err) {
      next(err);
    }
  }

  // 11. Audit Logs
  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      adminService.validateAdminAccess(req.user!.role);
      const query = {
        action: req.query.action as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20,
      };
      const result = await adminService.getAuditLogs(query);
      sendSuccess(res, result, 'Audit logs retrieved.');
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
