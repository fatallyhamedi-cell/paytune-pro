import { Router } from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public: fetch all active categories
router.get('/', listCategories);

// Protected Admin: manage categories
router.post('/', authenticate, createCategory);
router.put('/:id', authenticate, updateCategory);
router.delete('/:id', authenticate, deleteCategory);

export default router;
