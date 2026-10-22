import { Faculty, IFaculty } from '../models/Faculty.js';
import { Types } from 'mongoose';

export class FacultyRepository {
  async findByUserId(userId: string | Types.ObjectId): Promise<IFaculty | null> {
    return Faculty.findOne({ userId }).populate('departmentId', 'name code').populate('userId', 'email role name designation');
  }

  async findById(id: string | Types.ObjectId): Promise<IFaculty | null> {
    return Faculty.findById(id).populate('departmentId', 'name code').populate('userId', 'email role name designation');
  }

  async findByDepartmentId(departmentId: string | Types.ObjectId): Promise<IFaculty[]> {
    return Faculty.find({ departmentId })
      .populate('departmentId', 'name code')
      .populate('userId', 'email role name designation')
      .sort({ name: 1 });
  }

  async findAll(
    filter: Record<string, unknown> = {},
    projection: string | Record<string, number> = 'name employeeId designation departmentId userId verificationStatus profilePhoto basicInfo createdAt'
  ): Promise<IFaculty[]> {
    return Faculty.find(filter)
      .select(projection)
      .populate('departmentId', 'name code')
      .populate('userId', 'email role name designation')
      .sort({ name: 1 })
      .lean() as unknown as Promise<IFaculty[]>;
  }

  async updateBasicInfo(
    id: string | Types.ObjectId,
    basicInfo: Partial<IFaculty['basicInfo']>
  ): Promise<IFaculty | null> {
    return Faculty.findByIdAndUpdate(
      id,
      { $set: { basicInfo } },
      { new: true, runValidators: true }
    );
  }

  async addItemToSection(
    id: string | Types.ObjectId,
    section: string,
    item: Record<string, unknown>
  ): Promise<IFaculty | null> {
    return Faculty.findByIdAndUpdate(
      id,
      { $push: { [section]: item } },
      { new: true, runValidators: true }
    );
  }

  async updateItemInSection(
    id: string | Types.ObjectId,
    section: string,
    itemId: string,
    item: Record<string, unknown>
  ): Promise<IFaculty | null> {
    const updateQuery: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item)) {
      updateQuery[`${section}.$.${key}`] = value;
    }

    return Faculty.findOneAndUpdate(
      { _id: id, [`${section}._id`]: new Types.ObjectId(itemId) },
      { $set: updateQuery },
      { new: true }
    );
  }

  async deleteItemFromSection(
    id: string | Types.ObjectId,
    section: string,
    itemId: string
  ): Promise<IFaculty | null> {
    return Faculty.findByIdAndUpdate(
      id,
      { $pull: { [section]: { _id: new Types.ObjectId(itemId) } } },
      { new: true }
    );
  }

  async updateVerification(
    id: string | Types.ObjectId,
    status: 'PENDING' | 'VERIFIED' | 'REJECTED',
    notes?: string,
    verifiedBy?: string
  ): Promise<IFaculty | null> {
    return Faculty.findByIdAndUpdate(
      id,
      {
        $set: {
          verificationStatus: status,
          verificationNotes: notes || '',
          verifiedBy: verifiedBy ? new Types.ObjectId(verifiedBy) : undefined,
          verifiedAt: new Date(),
        },
      },
      { new: true }
    );
  }
}

export const facultyRepository = new FacultyRepository();
