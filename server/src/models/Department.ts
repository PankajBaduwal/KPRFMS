import { Schema, Document, Types } from 'mongoose';
import { tenantModel } from '../tenancy/tenantModel.js';

export interface IDepartment extends Document {
  name: string;
  code: string;
  hodId?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    // The head of department's user account (always a User id; see services/assignment.service.ts)
    hodId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Department = tenantModel<IDepartment>('Department', departmentSchema);
