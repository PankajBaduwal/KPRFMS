import { Schema, Document, Types } from 'mongoose';
import './Department.js';
import './User.js';
import './Faculty.js';
import { tenantModel } from '../tenancy/tenantModel.js';

export const PUBLICATION_TYPES = {
  JOURNAL: 'JOURNAL',
  CONFERENCE: 'CONFERENCE',
  BOOK: 'BOOK',
  BOOK_CHAPTER: 'BOOK_CHAPTER',
  EDITED_BOOK: 'EDITED_BOOK',
  REVIEW_PAPER: 'REVIEW_PAPER',
  TECHNICAL_PAPER: 'TECHNICAL_PAPER',
  OTHER: 'OTHER',
} as const;

export type PublicationType = (typeof PUBLICATION_TYPES)[keyof typeof PUBLICATION_TYPES];

export const PUBLICATION_LIFECYCLE_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  ACCEPTED: 'ACCEPTED',
  PUBLISHED: 'PUBLISHED',
} as const;

export type PublicationLifecycleStatus =
  (typeof PUBLICATION_LIFECYCLE_STATUS)[keyof typeof PUBLICATION_LIFECYCLE_STATUS];

export const PUBLICATION_VERIFICATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;

export type PublicationVerificationStatus =
  (typeof PUBLICATION_VERIFICATION_STATUS)[keyof typeof PUBLICATION_VERIFICATION_STATUS];

export const INDEXING_TYPES = {
  SCOPUS: 'SCOPUS',
  SCI: 'SCI',
  SCIE: 'SCIE',
  WEB_OF_SCIENCE: 'WEB_OF_SCIENCE',
  UGC_CARE: 'UGC_CARE',
  IEEE_XPLORE: 'IEEE_XPLORE',
  PUBMED: 'PUBMED',
  OTHER: 'OTHER',
  NONE: 'NONE',
} as const;

export type IndexingType = (typeof INDEXING_TYPES)[keyof typeof INDEXING_TYPES];

export const QUARTILES = {
  Q1: 'Q1',
  Q2: 'Q2',
  Q3: 'Q3',
  Q4: 'Q4',
  NA: 'NA',
} as const;

export type Quartile = (typeof QUARTILES)[keyof typeof QUARTILES];

export const AUTHOR_POSITIONS = {
  FIRST_AUTHOR: 'FIRST_AUTHOR',
  SECOND_AUTHOR: 'SECOND_AUTHOR',
  CORRESPONDING_AUTHOR: 'CORRESPONDING_AUTHOR',
  CO_AUTHOR: 'CO_AUTHOR',
} as const;

export type AuthorPosition = (typeof AUTHOR_POSITIONS)[keyof typeof AUTHOR_POSITIONS];

export interface IPublicationDoc extends Document {
  facultyId: Types.ObjectId;
  userId: Types.ObjectId;
  departmentId: Types.ObjectId;
  title: string;
  publicationType: PublicationType;
  journalOrConference: string;
  publisher?: string;
  issn?: string;
  doi?: string;
  url?: string;
  publicationDate: Date;
  academicYear: string;
  volume?: string;
  issue?: string;
  pages?: string;
  indexing: IndexingType;
  quartile: Quartile;
  impactFactor?: number;
  citationCount: number;
  authorPosition: AuthorPosition;
  numberOfAuthors: number;
  coAuthors: string[];
  affiliation: string;
  correspondingAuthor: boolean;
  publicationStatus: PublicationLifecycleStatus;
  pdfUrl?: string;
  pdfFileName?: string;
  verificationStatus: PublicationVerificationStatus;
  verificationRemarks?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const publicationSchema = new Schema<IPublicationDoc>(
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
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    publicationType: {
      type: String,
      enum: Object.values(PUBLICATION_TYPES),
      default: PUBLICATION_TYPES.JOURNAL,
      index: true,
    },
    journalOrConference: {
      type: String,
      required: true,
      trim: true,
    },
    publisher: {
      type: String,
      trim: true,
    },
    issn: {
      type: String,
      trim: true,
    },
    doi: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    publicationDate: {
      type: Date,
      required: true,
      index: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    volume: {
      type: String,
      trim: true,
    },
    issue: {
      type: String,
      trim: true,
    },
    pages: {
      type: String,
      trim: true,
    },
    indexing: {
      type: String,
      enum: Object.values(INDEXING_TYPES),
      default: INDEXING_TYPES.SCOPUS,
      index: true,
    },
    quartile: {
      type: String,
      enum: Object.values(QUARTILES),
      default: QUARTILES.NA,
      index: true,
    },
    impactFactor: {
      type: Number,
      default: 0,
      min: 0,
    },
    citationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    authorPosition: {
      type: String,
      enum: Object.values(AUTHOR_POSITIONS),
      default: AUTHOR_POSITIONS.FIRST_AUTHOR,
    },
    numberOfAuthors: {
      type: Number,
      default: 1,
      min: 1,
    },
    coAuthors: [
      {
        type: String,
        trim: true,
      },
    ],
    affiliation: {
      type: String,
      default: '',
      trim: true,
    },
    correspondingAuthor: {
      type: Boolean,
      default: false,
    },
    publicationStatus: {
      type: String,
      enum: Object.values(PUBLICATION_LIFECYCLE_STATUS),
      default: PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
      index: true,
    },
    pdfUrl: {
      type: String,
      trim: true,
    },
    pdfFileName: {
      type: String,
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(PUBLICATION_VERIFICATION_STATUS),
      default: PUBLICATION_VERIFICATION_STATUS.DRAFT,
      index: true,
    },
    verificationRemarks: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound text index for fast keyword search across publication records
publicationSchema.index({
  title: 'text',
  journalOrConference: 'text',
  publisher: 'text',
  doi: 'text',
  coAuthors: 'text',
});

// Compound indexing for multi-tenant and department filtering
publicationSchema.index({ departmentId: 1, verificationStatus: 1, academicYear: 1 });
publicationSchema.index({ facultyId: 1, verificationStatus: 1 });
publicationSchema.index({ academicYear: 1, publicationDate: -1 });
publicationSchema.index({ facultyId: 1, publicationDate: -1 });

export const Publication = tenantModel<IPublicationDoc>('Publication', publicationSchema);
