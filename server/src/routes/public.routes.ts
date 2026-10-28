import { Router } from 'express';
import { Faculty } from '../models/Faculty.js';
import { Department } from '../models/Department.js';
import { Publication } from '../models/Publication.js';
import { AcademicActivity } from '../models/AcademicActivity.js';
import { InstitutionSettings, DEFAULT_ACCENT_COLOR, DEFAULT_TIMEZONE, OPTIONAL_MODULE_KEYS } from '../models/InstitutionSettings.js';
import { AppError } from '../utils/AppError.js';
import { brandingService } from '../services/branding.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { PRODUCT_NAME, PRODUCT_FULL_NAME } from '../config/brand.js';
import { requireTenant } from '../tenancy/context.js';
import { allowedEmailDomains } from '../services/institution-domains.js';

const router = Router();

/** Totals only (no names or records) for the public home page; cached for 10 minutes. */
// Per institution: totals of one college must never be served to another
const cache = new Map<string, { at: number; data: Record<string, number> }>();
const TTL_MS = 10 * 60 * 1000;

router.get('/overview', async (_req, res, next) => {
  try {
    const key = requireTenant().code;
    let entry = cache.get(key);
    if (!entry || Date.now() - entry.at > TTL_MS) {
      const [faculty, departments, publications, activities] = await Promise.all([
        Faculty.countDocuments(),
        Department.countDocuments({ isActive: true }),
        Publication.countDocuments({ verificationStatus: 'VERIFIED' }),
        AcademicActivity.countDocuments({ status: 'VERIFIED' }),
      ]);
      entry = { at: Date.now(), data: { faculty, departments, publications, activities } };
      cache.set(key, entry);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    sendSuccess(res, entry.data, 'Public overview.');
  } catch (error) {
    next(error);
  }
});

/**
 * Branding for the sign-in and home pages: the product name plus this college's own name,
 * logo and email domain from Admin > Settings. Public information only.
 */
router.get('/institution', async (_req, res, next) => {
  try {
    const s = await InstitutionSettings.findOne()
      .select('name shortCode tagline logoUrl websiteUrl city state address contactEmail contactPhone affiliation accentColor timezone maintenanceMode enabledModules')
      .lean();
    res.setHeader('Cache-Control', 'public, max-age=60');
    sendSuccess(
      res,
      {
        productName: PRODUCT_NAME,
        productFullName: PRODUCT_FULL_NAME,
        name: s?.name || 'Your Institution',
        shortCode: s?.shortCode || 'INST',
        tagline: s?.tagline || '',
        affiliation: s?.affiliation || '',
        logoUrl: s?.logoUrl || '',
        websiteUrl: s?.websiteUrl || '',
        city: s?.city || '',
        state: s?.state || '',
        contactEmail: s?.contactEmail || '',
        contactPhone: s?.contactPhone || '',
        address: s?.address || '',
        accentColor: s?.accentColor || DEFAULT_ACCENT_COLOR,
        timezone: s?.timezone || DEFAULT_TIMEZONE,
        maintenanceMode: Boolean(s?.maintenanceMode),
        enabledModules: Array.isArray(s?.enabledModules) ? s!.enabledModules : OPTIONAL_MODULE_KEYS,
        emailDomains: await allowedEmailDomains(),
        emailDomain: (await allowedEmailDomains())[0],
      },
      'Institution branding.'
    );
  } catch (error) {
    next(error);
  }
});

/** The institution's uploaded logo (public: the sign-in page shows it). */
router.get('/logo', async (_req, res, next) => {
  try {
    const logo = await brandingService.logoPath();
    if (!logo) throw AppError.notFound('No logo has been uploaded.');
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.sendFile(logo.file);
  } catch (error) {
    next(error);
  }
});

export default router;
