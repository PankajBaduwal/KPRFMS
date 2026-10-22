import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getAcademicYearOptions } from '../utils/academicYear.js';
import {
  Publication,
  Project,
  AcademicActivity,
  Patent,
  Copyright,
  Consultancy,
  StudentMentoring,
  StudentProject,
  Subject,
  FacultyAllocation,
} from '../models/index.js';

const router = Router();

/**
 * GET /api/academic-years
 * Academic year options for forms and filters, sourced from the AcademicYear
 * master, institution settings and years already present in stored records.
 */
router.get('/', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const used = await Promise.all([
      Publication.distinct('academicYear'),
      Project.distinct('academicYear'),
      AcademicActivity.distinct('academicYear'),
      Patent.distinct('academicYear'),
      Copyright.distinct('academicYear'),
      Consultancy.distinct('academicYear'),
      StudentMentoring.distinct('academicYear'),
      StudentProject.distinct('academicYear'),
      Subject.distinct('academicYear'),
      FacultyAllocation.distinct('academicYear'),
    ]);
    const options = await getAcademicYearOptions(used.flat());
    sendSuccess(res, options, 'Academic years fetched');
  } catch (error) {
    next(error);
  }
});

export default router;
