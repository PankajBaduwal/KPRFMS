import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { searchService, type ISearchUser } from '../services/search.service.js';
import { type SearchEntityType } from '../types/search.js';
import { Faculty } from '../models/Faculty.js';

export async function globalSearchHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawQuery = (req.query.q as string) || (req.query.query as string) || '';
    const typeFilter = req.query.type as SearchEntityType | undefined;

    const userId = req.user!.id;
    const role = req.user!.role;
    let departmentId = req.user!.departmentId;
    let facultyId: string | undefined;

    if (role === 'FACULTY' || role === 'HOD') {
      const facultyDoc = await Faculty.findOne({ userId }).select('_id departmentId').lean();
      if (facultyDoc) {
        facultyId = facultyDoc._id.toString();
        if (!departmentId && facultyDoc.departmentId) {
          departmentId = facultyDoc.departmentId.toString();
        }
      }
    }

    const searchUser: ISearchUser = {
      userId,
      role,
      departmentId,
      facultyId,
      name: req.user!.name,
    };

    const searchResults = await searchService.search(searchUser, rawQuery, typeFilter);

    res.status(200).json({
      success: true,
      data: searchResults,
    });
  } catch (error) {
    next(error);
  }
}
