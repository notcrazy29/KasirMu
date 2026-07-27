import { Router } from 'express';
import {
  createCategory,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getProductByBarcode,
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
} from '../controllers/product';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { checkLimit } from '../middlewares/subscription';


const router = Router();

router.use(authenticate);

// Categories
router.post(
  '/categories',
  authorize(['OWNER']),
  checkLimit('category', (req) => req.body.storeId),
  validateRequest(createCategorySchema),
  createCategory
);
router.get('/categories', getCategories);

// Products
router.post(
  '/',
  authorize(['OWNER']),
  checkLimit('product', (req) => req.body.storeId),
  validateRequest(createProductSchema),
  createProduct
);

router.put('/:id', authorize(['OWNER']), validateRequest(updateProductSchema), updateProduct);
router.delete('/:id', authorize(['OWNER']), deleteProduct);
router.get('/', getProducts);
router.get('/barcode/:barcode', getProductByBarcode);

export default router;
