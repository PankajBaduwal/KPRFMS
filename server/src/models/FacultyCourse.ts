import { Schema, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';
import { workflowFields, type IWorkflowFields } from './dossierWorkflow.js';

/**
 * Courses & certifications a faculty member has completed: online courses, training programmes,
 * professional certifications. A module of its own (not an academic activity); the certificate
 * lives in the secure document vault and is referenced here.
 */
export const COURSE_KINDS = ['COURSE', 'CERTIFICATION'] as const;
export const COURSE_CATEGORIES = ['TECHNICAL', 'PEDAGOGY', 'RESEARCH_METHODS', 'DOMAIN', 'MANAGEMENT', 'LANGUAGE', 'SOFT_SKILLS', 'OTHER'] as const;
export const COURSE_MODES = ['ONLINE', 'OFFLINE', 'HYBRID', 'SELF_PACED'] as const;

export interface IFacultyCourse extends IWorkflowFields {
  _id: Types.ObjectId;
  kind: (typeof COURSE_KINDS)[number];
  title: string;
  category: (typeof COURSE_CATEGORIES)[number];
  provider: string;
  platform?: string;
  startDate?: Date;
  completionDate: Date;
  durationHours?: number;
  mode: (typeof COURSE_MODES)[number];
  skills: string[];
  certificateId?: string;
  credentialUrl?: string;
  result?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<IFacultyCourse>(
  {
    ...workflowFields(),
    kind: { type: String, enum: COURSE_KINDS, default: 'COURSE' },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    category: { type: String, enum: COURSE_CATEGORIES, default: 'OTHER' },
    provider: { type: String, required: true, trim: true, maxlength: 200 },
    platform: { type: String, trim: true, maxlength: 120 },
    startDate: Date,
    completionDate: { type: Date, required: true },
    durationHours: { type: Number, min: 0, max: 5000 },
    mode: { type: String, enum: COURSE_MODES, default: 'ONLINE' },
    skills: { type: [String], default: [] },
    certificateId: { type: String, trim: true, maxlength: 120 },
    credentialUrl: { type: String, trim: true, maxlength: 500 },
    result: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 3000 },
  },
  { timestamps: true, collection: 'faculty_courses' }
);
courseSchema.index({ facultyId: 1, status: 1, academicYear: 1 });
courseSchema.index({ departmentId: 1, status: 1 });

export const FacultyCourse = tenantModel<IFacultyCourse>('FacultyCourse', courseSchema);
