import mongoose, { Schema, Document as MongooseDocument, Types } from 'mongoose';
import {
  DOCUMENT_TYPES,
  type DocumentType,
  ACCESS_LEVELS,
  type AccessLevel,
  type IDocumentMetadata,
} from '../types/document.js';

export interface IDocument extends MongooseDocument {
  _id: Types.ObjectId;
  title: string;
  documentType: DocumentType;
  originalFilename: string;
  storedFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  fileHash: string;
  ownerId: Types.ObjectId;
  facultyId?: Types.ObjectId;
  departmentId?: Types.ObjectId;
  accessLevel: AccessLevel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata: IDocumentMetadata;
  isArchived: boolean;
  downloadCount: number;
  lastDownloadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    documentType: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      required: true,
      index: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    storedFilename: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    fileHash: {
      type: String,
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'Faculty',
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    accessLevel: {
      type: String,
      enum: Object.values(ACCESS_LEVELS),
      default: ACCESS_LEVELS.PRIVATE,
      required: true,
      index: true,
    },
    relatedEntityType: {
      type: String,
      trim: true,
    },
    relatedEntityId: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDownloadedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for performant access control & listing
documentSchema.index({ ownerId: 1, isArchived: 1, createdAt: -1 });
documentSchema.index({ departmentId: 1, accessLevel: 1, isArchived: 1 });
documentSchema.index({ documentType: 1, isArchived: 1 });

export const DocumentRecord = mongoose.model<IDocument>('DocumentRecord', documentSchema);
