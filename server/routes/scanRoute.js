import { Router } from 'express';
import { scanWebsite } from '../controllers/scanController.js';
import { analyzeUrl, analyzeUrlStream } from '../controllers/analyzeUrlController.js';

const router = Router();

router.get('/scan', scanWebsite);
router.get('/analyze-url', analyzeUrl);
router.get('/analyze-url-stream', analyzeUrlStream);

export default router;




