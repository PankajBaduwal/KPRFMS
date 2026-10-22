import { z } from 'zod';
import {
  PUBLICATION_TYPES,
  PUBLICATION_LIFECYCLE_STATUS,
  INDEXING_TYPES,
  QUARTILES,
  AUTHOR_POSITIONS,
} from '../models/Publication.js';

export const publicationSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').trim(),
  publicationType: z.enum([
    PUBLICATION_TYPES.JOURNAL,
    PUBLICATION_TYPES.CONFERENCE,
    PUBLICATION_TYPES.BOOK,
    PUBLICATION_TYPES.BOOK_CHAPTER,
    PUBLICATION_TYPES.EDITED_BOOK,
    PUBLICATION_TYPES.REVIEW_PAPER,
    PUBLICATION_TYPES.TECHNICAL_PAPER,
    PUBLICATION_TYPES.OTHER,
  ]).default(PUBLICATION_TYPES.JOURNAL),
  journalOrConference: z.string().min(2, 'Journal or Conference name is required').trim(),
  publisher: z.string().optional(),
  issn: z.string().optional(),
  doi: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
  publicationDate: z.coerce.date(),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must be in format YYYY-YYYY (e.g. 2023-2024)')
    .trim(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  indexing: z.enum([
    INDEXING_TYPES.SCOPUS,
    INDEXING_TYPES.SCI,
    INDEXING_TYPES.SCIE,
    INDEXING_TYPES.WEB_OF_SCIENCE,
    INDEXING_TYPES.UGC_CARE,
    INDEXING_TYPES.IEEE_XPLORE,
    INDEXING_TYPES.PUBMED,
    INDEXING_TYPES.OTHER,
    INDEXING_TYPES.NONE,
  ]).default(INDEXING_TYPES.SCOPUS),
  quartile: z.enum([
    QUARTILES.Q1,
    QUARTILES.Q2,
    QUARTILES.Q3,
    QUARTILES.Q4,
    QUARTILES.NA,
  ]).default(QUARTILES.NA),
  impactFactor: z.coerce.number().min(0).default(0),
  citationCount: z.coerce.number().min(0).default(0),
  authorPosition: z.enum([
    AUTHOR_POSITIONS.FIRST_AUTHOR,
    AUTHOR_POSITIONS.SECOND_AUTHOR,
    AUTHOR_POSITIONS.CORRESPONDING_AUTHOR,
    AUTHOR_POSITIONS.CO_AUTHOR,
  ]).default(AUTHOR_POSITIONS.FIRST_AUTHOR),
  numberOfAuthors: z.coerce.number().min(1).default(1),
  coAuthors: z.array(z.string().trim()).default([]).or(
    z.string().transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean))
  ),
  affiliation: z.string().trim().default('KPR Institute of Engineering and Technology'),
  correspondingAuthor: z.coerce.boolean().default(false),
  publicationStatus: z.enum([
    PUBLICATION_LIFECYCLE_STATUS.DRAFT,
    PUBLICATION_LIFECYCLE_STATUS.SUBMITTED,
    PUBLICATION_LIFECYCLE_STATUS.ACCEPTED,
    PUBLICATION_LIFECYCLE_STATUS.PUBLISHED,
  ]).default(PUBLICATION_LIFECYCLE_STATUS.PUBLISHED),
  pdfUrl: z.string().optional(),
  pdfFileName: z.string().optional(),
});

export const updatePublicationSchema = publicationSchema.partial();

export const reviewPublicationSchema = z.object({
  status: z
    .enum(['VERIFIED', 'RETURNED_FOR_CORRECTION', 'UNDER_REVIEW', 'REJECTED', 'APPROVED' as const])
    .transform((val) => (val === 'APPROVED' ? 'VERIFIED' : val)),
  remarks: z.string().optional(),
});

export const publicationFilterQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  academicYear: z.string().optional(),
  publicationType: z.string().optional(),
  indexing: z.string().optional(),
  quartile: z.string().optional(),
  departmentId: z.string().optional(),
  facultyId: z.string().optional(),
  verificationStatus: z.string().optional(),
  publicationStatus: z.string().optional(),
  authorPosition: z.string().optional(),
});
