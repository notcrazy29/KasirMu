import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../middlewares/auth';
import { z } from 'zod';
import { emitToStore } from '../services/socket';

// Validation Schemas
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Category name is required'),
    storeId: z.string().uuid('Invalid Store ID'),
  }),
});

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Product name is required'),
    barcode: z.string().optional(),
    description: z.string().optional(),
    price: z.number().positive('Price must be greater than 0'),
    costPrice: z.number().nonnegative('Cost price cannot be negative'),
    stock: z.number().int().nonnegative('Stock cannot be negative'),
    minStockAlert: z.number().int().nonnegative('Min stock alert cannot be negative'),
    image: z.string().optional(),
    storeId: z.string().uuid('Invalid Store ID'),
    categoryId: z.string().uuid().optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    barcode: z.string().optional(),
    description: z.string().optional(),
    price: z.number().positive().optional(),
    costPrice: z.number().nonnegative().optional(),
    stock: z.number().int().nonnegative().optional(),
    minStockAlert: z.number().int().nonnegative().optional(),
    image: z.string().optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

// Category Handlers
export const createCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, storeId } = req.body;

    const existing = await prisma.category.findUnique({
      where: { name_storeId: { name, storeId } },
    });

    if (existing) {
      return res.status(400).json({ message: 'Category already exists in this store' });
    }

    const category = await prisma.category.create({
      data: { name, storeId },
    });

    return res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    const categories = await prisma.category.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });

    return res.json({ categories });
  } catch (error) {
    next(error);
  }
};

// Product Handlers
export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const {
      name,
      barcode,
      description,
      price,
      costPrice,
      stock,
      minStockAlert,
      image,
      storeId,
      categoryId,
    } = req.body;

    // Check unique barcode in store if barcode provided
    if (barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode_storeId: { barcode, storeId } },
      });
      if (existingBarcode) {
        return res.status(400).json({ message: 'Product with this barcode already exists in this store' });
      }
    }

    const product = await prisma.product.create({
      data: {
        name,
        barcode,
        description,
        price,
        costPrice,
        stock,
        minStockAlert,
        image,
        storeId,
        categoryId,
      },
    });

    // Create stock log for initial stock
    if (stock > 0) {
      await prisma.stockLog.create({
        data: {
          productId: product.id,
          type: 'IN',
          quantity: stock,
          description: 'Initial stock addition',
          userId,
        },
      });
    }

    emitToStore(storeId, 'stock_update', { productId: product.id, newStock: product.stock });

    return res.status(201).json({ product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { stock, ...otherData } = req.body;

    const dataToUpdate: any = { ...otherData };
    
    // Perform manual stock log adjust if stock changes
    if (stock !== undefined && stock !== existingProduct.stock) {
      dataToUpdate.stock = stock;
      const difference = stock - existingProduct.stock;
      const logType = difference > 0 ? 'IN' : 'OUT';
      
      await prisma.stockLog.create({
        data: {
          productId: id,
          type: logType,
          quantity: Math.abs(difference),
          description: `Manual adjustment by user`,
          userId,
        },
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });

    if (stock !== undefined) {
      emitToStore(product.storeId, 'stock_update', { productId: product.id, newStock: product.stock });
    }

    return res.json({ product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await prisma.product.delete({ where: { id } });

    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string;
    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    const products = await prisma.product.findMany({
      where: { storeId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    return res.json({ products });
  } catch (error) {
    next(error);
  }
};

export const getProductByBarcode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { barcode } = req.params;
    const storeId = req.query.storeId as string;

    if (!storeId) {
      return res.status(400).json({ message: 'Store ID query parameter is required' });
    }

    const product = await prisma.product.findUnique({
      where: { barcode_storeId: { barcode, storeId } },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json({ product });
  } catch (error) {
    next(error);
  }
};
