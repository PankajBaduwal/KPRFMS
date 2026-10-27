import { Router } from 'express';
import { Institution } from '../models/Institution.js';
import { sendSuccess } from '../../utils/apiResponse.js';

const router = Router();

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Institution finder for the sign-in page. Lists ACTIVE institutions only, with public
 * details (name, code, city). Choosing one is discovery, not authorisation: credentials are
 * still checked against that institution's own account directory.
 */
router.get('/institutions', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim().slice(0, 80);
    const filter: Record<string, unknown> = { status: 'ACTIVE' };
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { code: rx }, { city: rx }];
    }
    const items = await Institution.find(filter)
      .select('code name type city state logo.url')
      .sort({ name: 1 })
      .limit(20)
      .lean();
    sendSuccess(
      res,
      items.map((i) => ({ code: i.code, name: i.name, type: i.type, city: i.city || '', state: i.state || '', logoUrl: i.logo?.url || '' })),
      'Institutions.'
    );
  } catch (error) {
    next(error);
  }
});

export default router;
