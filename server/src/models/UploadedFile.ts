import { Schema, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

/**
 * Who an evidence file under /uploads belongs to, so it is only served to its owner and to the
 * people allowed to review that owner's records. Written at upload time; files uploaded before
 * this existed get a row the first time an authorised person opens them.
 */
export interface IUploadedFile {
  _id: Types.ObjectId;
  storedName: string;
  ownerUserId: Types.ObjectId | null;
  departmentId: Types.ObjectId | null;
  source: 'UPLOAD' | 'RESOLVED';
  createdAt: Date;
}

const uploadedFileSchema = new Schema<IUploadedFile>(
  {
    storedName: { type: String, required: true, unique: true, trim: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    source: { type: String, enum: ['UPLOAD', 'RESOLVED'], default: 'UPLOAD' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'uploaded_files' }
);

export const UploadedFile = tenantModel<IUploadedFile>('UploadedFile', uploadedFileSchema);
