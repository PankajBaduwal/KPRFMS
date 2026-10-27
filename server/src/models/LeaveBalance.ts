import { Schema, Document, Types } from 'mongoose';
import { LEAVE_TYPE, type LeaveType } from './LeaveApplication.js';
import { tenantModel } from '../tenancy/tenantModel.js';

export interface ILeaveTypeBalance {
  total: number;
  used: number;
  remaining: number;
}

export interface ILeaveBalance extends Document {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  academicYear: string;
  balances: Map<string, ILeaveTypeBalance>;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_LEAVE_ENTITLEMENTS: Record<LeaveType, number> = {
  [LEAVE_TYPE.CASUAL_LEAVE]: 12,
  [LEAVE_TYPE.EARNED_LEAVE]: 15,
  [LEAVE_TYPE.SICK_LEAVE]: 10,
  [LEAVE_TYPE.ON_DUTY]: 15,
  [LEAVE_TYPE.COMPENSATORY_OFF]: 5,
  [LEAVE_TYPE.MATERNITY_PATERNITY]: 90,
  [LEAVE_TYPE.SPECIAL_CASUAL_LEAVE]: 7,
};

const leaveTypeBalanceSchema = new Schema<ILeaveTypeBalance>(
  {
    total: { type: Number, required: true, default: 0 },
    used: { type: Number, required: true, default: 0 },
    remaining: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      index: true,
    },
    balances: {
      type: Map,
      of: leaveTypeBalanceSchema,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

leaveBalanceSchema.index({ facultyId: 1, academicYear: 1 }, { unique: true });

export const LeaveBalance = tenantModel<ILeaveBalance>(
  'LeaveBalance',
  leaveBalanceSchema
);
