import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { ROLES } from '../permissions/roles.js';
import { adminController } from '../controllers/admin.controller.js';
import { spreadsheetUpload } from '../middleware/upload.js';

const router = Router();

// Protect ALL admin routes with authentication and ADMIN role check
router.use(requireAuth, requireRole(ROLES.ADMIN));

// Overview & Health
router.get('/overview', (req, res, next) => adminController.getOverview(req, res, next));

// Roles
router.get('/roles', (req, res, next) => adminController.getRoles(req, res, next));

// Users Management
router.get('/users', (req, res, next) => adminController.getUsers(req, res, next));
router.get('/users/import/template', (req, res, next) => adminController.downloadImportTemplate(req, res, next));
router.post('/users/import', spreadsheetUpload.single('file'), (req, res, next) => adminController.importUsers(req, res, next));
router.post('/users', (req, res, next) => adminController.createUser(req, res, next));
router.get('/users/:id', (req, res, next) => adminController.getUserById(req, res, next));
router.put('/users/:id', (req, res, next) => adminController.updateUser(req, res, next));
router.patch('/users/:id', (req, res, next) => adminController.updateUser(req, res, next));
router.patch('/users/:id/status', (req, res, next) => adminController.toggleUserStatus(req, res, next));
router.post('/users/:id/approve-registration', (req, res, next) => adminController.approveRegistration(req, res, next));
router.post('/users/:id/reject-registration', (req, res, next) => adminController.rejectRegistration(req, res, next));
router.post('/users/:id/reset-password', (req, res, next) => adminController.resetPassword(req, res, next));
router.post('/users/:id/reset-2fa', (req, res, next) => adminController.resetTwoFactor(req, res, next));
router.delete('/users/:id', (req, res, next) => adminController.deleteUser(req, res, next));

// Departments
router.get('/departments', (req, res, next) => adminController.getDepartments(req, res, next));
router.post('/departments', (req, res, next) => adminController.createDepartment(req, res, next));
router.get('/departments/:id', (req, res, next) => adminController.getDepartmentById(req, res, next));
router.put('/departments/:id', (req, res, next) => adminController.updateDepartment(req, res, next));
router.patch('/departments/:id', (req, res, next) => adminController.updateDepartment(req, res, next));
router.delete('/departments/:id', (req, res, next) => adminController.deleteDepartment(req, res, next));

// Degree Programs
router.get('/programs', (req, res, next) => adminController.getPrograms(req, res, next));
router.post('/programs', (req, res, next) => adminController.createProgram(req, res, next));
router.get('/programs/:id', (req, res, next) => adminController.getProgramById(req, res, next));
router.put('/programs/:id', (req, res, next) => adminController.updateProgram(req, res, next));
router.patch('/programs/:id', (req, res, next) => adminController.updateProgram(req, res, next));
router.delete('/programs/:id', (req, res, next) => adminController.deleteProgram(req, res, next));

// Subjects
router.get('/subjects', (req, res, next) => adminController.getSubjects(req, res, next));
router.post('/subjects', (req, res, next) => adminController.createSubject(req, res, next));
router.get('/subjects/:id', (req, res, next) => adminController.getSubjectById(req, res, next));
router.put('/subjects/:id', (req, res, next) => adminController.updateSubject(req, res, next));
router.patch('/subjects/:id', (req, res, next) => adminController.updateSubject(req, res, next));
router.delete('/subjects/:id', (req, res, next) => adminController.deleteSubject(req, res, next));

// Academic Years
router.get('/academic-years', (req, res, next) => adminController.getAcademicYears(req, res, next));
router.post('/academic-years', (req, res, next) => adminController.createAcademicYear(req, res, next));
router.put('/academic-years/:id', (req, res, next) => adminController.updateAcademicYear(req, res, next));
router.patch('/academic-years/:id', (req, res, next) => adminController.updateAcademicYear(req, res, next));
router.patch('/academic-years/:id/set-current', (req, res, next) => adminController.setCurrentAcademicYear(req, res, next));
router.delete('/academic-years/:id', (req, res, next) => adminController.deleteAcademicYear(req, res, next));

// Semesters
router.get('/semesters', (req, res, next) => adminController.getSemesters(req, res, next));
router.post('/semesters', (req, res, next) => adminController.createSemester(req, res, next));
router.put('/semesters/:id', (req, res, next) => adminController.updateSemester(req, res, next));
router.patch('/semesters/:id', (req, res, next) => adminController.updateSemester(req, res, next));
router.patch('/semesters/:id/set-current', (req, res, next) => adminController.setCurrentSemester(req, res, next));
router.delete('/semesters/:id', (req, res, next) => adminController.deleteSemester(req, res, next));

// Master Reference Items (Designations, Funding Agencies, Publication Types, Activity Types, Leave Types, Appraisal Criteria)
router.get('/masters', (req, res, next) => adminController.getMasterItems(req, res, next));
router.get('/masters/:category', (req, res, next) => adminController.getMasterItems(req, res, next));
router.post('/masters', (req, res, next) => adminController.createMasterItem(req, res, next));
router.put('/masters/:id', (req, res, next) => adminController.updateMasterItem(req, res, next));
router.patch('/masters/:id', (req, res, next) => adminController.updateMasterItem(req, res, next));
router.patch('/masters/:id/status', (req, res, next) => adminController.toggleMasterItemStatus(req, res, next));
router.delete('/masters/:id', (req, res, next) => adminController.deleteMasterItem(req, res, next));

// Institution Settings
router.get('/settings', (req, res, next) => adminController.getInstitutionSettings(req, res, next));
router.put('/settings', (req, res, next) => adminController.updateInstitutionSettings(req, res, next));
router.patch('/settings', (req, res, next) => adminController.updateInstitutionSettings(req, res, next));

// System Audit Logs
router.get('/audit-logs', (req, res, next) => adminController.getAuditLogs(req, res, next));

export default router;
