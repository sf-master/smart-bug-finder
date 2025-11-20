import { Router } from 'express';
import { scanWebsite } from '../controllers/scanController.js';

const router = Router();

router.get('/scan', scanWebsite);

export default router;




