import { Schema, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';
import { workflowFields, type IWorkflowFields } from './dossierWorkflow.js';

/**
 * Awards, honours, memberships, editorial roles, invited talks, keynotes, guest lectures,
 * recognitions, institutional responsibilities and supervised student achievements — each a
 * reviewable record with evidence (replaces the status-less lists embedded in the profile).
 */
export const ACHIEVEMENT_CATEGORIES = [
  'AWARD',
  'HONOR',
  'RECOGNITION',
  'MEMBERSHIP',
  'EDITORIAL_ROLE',
  'INVITED_TALK',
  'KEYNOTE',
  'GUEST_LECTURE',
  'RESPONSIBILITY',
  'STUDENT_ACHIEVEMENT',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];
export const ACHIEVEMENT_LEVELS = ['DEPARTMENT', 'INSTITUTION', 'STATE', 'NATIONAL', 'INTERNATIONAL'] as const;

export interface IFacultyAchievement extends IWorkflowFields {
  _id: Types.ObjectId;
  category: AchievementCategory;
  title: string;
  /** Awarding, organising or member body */
  body: string;
  date: Date;
  endDate?: Date;
  role?: string;
  level?: (typeof ACHIEVEMENT_LEVELS)[number];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const achievementSchema = new Schema<IFacultyAchievement>(
  {
    ...workflowFields(),
    category: { type: String, enum: ACHIEVEMENT_CATEGORIES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: Date, required: true },
    endDate: Date,
    role: { type: String, trim: true, maxlength: 120 },
    level: { type: String, enum: ACHIEVEMENT_LEVELS },
    description: { type: String, trim: true, maxlength: 3000 },
  },
  { timestamps: true, collection: 'faculty_achievements' }
);
achievementSchema.index({ facultyId: 1, category: 1, status: 1 });
achievementSchema.index({ departmentId: 1, status: 1 });

export const FacultyAchievement = tenantModel<IFacultyAchievement>('FacultyAchievement', achievementSchema);
