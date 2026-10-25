import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { aiFeaturesService } from '../services/ai/ai-features.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
router.use(requireAuth);

// AI calls cost money and take seconds: limit per signed-in user, not per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id ?? 'anonymous',
  handler: (_req, res) => sendError(res, 'You have used the AI assistant a lot in the last hour. Please try again later.', 'RATE_LIMITED', 429),
});

const certificateUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

type Handler = (req: AuthenticatedRequest) => Promise<[unknown, string]>;
const handle = (fn: Handler) => async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [data, message] = await fn(req);
    sendSuccess(res, data, message);
  } catch (error) {
    next(error);
  }
};

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const academicYear = z.string().regex(/^\d{4}-\d{4}$/, 'Academic year like 2025-2026');

router.get('/status', handle(async () => [aiFeaturesService.status(), 'AI status.']));

router.post(
  '/certificate',
  aiLimiter,
  certificateUpload.single('file'),
  handle(async (req) => {
    if (!req.file) throw AppError.badRequest('Choose the certificate file (PDF, JPG or PNG).');
    return [await aiFeaturesService.extractCertificate(req.file, req.user!, req), 'Certificate read. Check the details before saving.'];
  })
);

router.post(
  '/verify/:type/:id',
  aiLimiter,
  handle(async (req) => {
    const type = z.enum(['activity', 'publication']).parse(req.params.type);
    return [await aiFeaturesService.verifyRecord(type, objectId.parse(req.params.id), req.user!, req), 'Verification check complete.'];
  })
);

router.post(
  '/appraisal/:id/draft',
  aiLimiter,
  handle(async (req) => [
    await aiFeaturesService.draftSelfAppraisal(objectId.parse(req.params.id), req.user!, req),
    'Draft ready. Review and edit before saving.',
  ])
);

router.post(
  '/appraisal/:id/summary',
  aiLimiter,
  handle(async (req) => [await aiFeaturesService.summarizeAppraisal(objectId.parse(req.params.id), req.user!, req), 'Summary ready.'])
);

router.post(
  '/accreditation/criterion-3',
  aiLimiter,
  handle(async (req) => {
    const input = z.object({ academicYear, departmentId: objectId.optional().or(z.literal('')) }).parse(req.body);
    return [
      await aiFeaturesService.accreditationNarrative({ academicYear: input.academicYear, departmentId: input.departmentId || undefined }, req.user!, req),
      'Draft narrative ready. Review it before using it in the SSR.',
    ];
  })
);

router.post(
  '/ask',
  aiLimiter,
  handle(async (req) => {
    const { question } = z.object({ question: z.string().trim().min(5, 'Type a question').max(500) }).parse(req.body);
    return [await aiFeaturesService.ask(question, req.user!, req), 'Answer ready.'];
  })
);

router.post(
  '/mentoring/insights',
  aiLimiter,
  handle(async (req) => {
    const input = z
      .object({ academicYear: academicYear.optional().or(z.literal('')), mentorUserId: objectId.optional().or(z.literal('')) })
      .parse(req.body ?? {});
    return [
      await aiFeaturesService.mentoringInsights(
        { academicYear: input.academicYear || undefined, mentorUserId: input.mentorUserId || undefined },
        req.user!,
        req
      ),
      'Mentoring insights ready.',
    ];
  })
);

export default router;
