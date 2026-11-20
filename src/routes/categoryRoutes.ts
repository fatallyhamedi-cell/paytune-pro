import { Router } from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { authenticate, checkRole } from '../middleware/auth';

const router = Router();

// Public: fetch all active categories
router.get('/', listCategories);

// Protected Master Admin: manage categories
router.post('/', authenticate, checkRole('master'), createCategory);
router.put('/:id', authenticate, checkRole('master'), updateCategory);
router.delete('/:id', authenticate, checkRole('master'), deleteCategory);

export default router;
