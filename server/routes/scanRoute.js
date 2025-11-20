import { Router } from 'express';
import { scanWebsite } from '../controllers/scanController.js';
import { analyzeUrl } from '../controllers/analyzeUrlController.js';

const router = Router();

router.get('/scan', scanWebsite);
router.get('/analyze-url', analyzeUrl);

export default router;




