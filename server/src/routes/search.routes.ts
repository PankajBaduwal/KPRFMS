import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { globalSearchHandler } from '../controllers/search.controller.js';

const router = Router();

// All searches require authentication and respect RBAC
router.get('/', requireAuth, globalSearchHandler);

export default router;
