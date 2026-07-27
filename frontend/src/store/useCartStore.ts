import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  costPrice: number;
  stock: number;
  minStockAlert: number;
  image: string | null;
  categoryId: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartState {
  cart: CartItem[];
  discount: number; // flat discount amount in IDR
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
  discount: 0,

  addToCart: (product) => {
    set((state) => {
      const existing = state.cart.find((item) => item.product.id === product.id);
      
      if (existing) {
        // Enforce inventory stock limit
        if (existing.quantity >= product.stock) {
          return { cart: state.cart };
        }
        return {
          cart: state.cart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }

      if (product.stock <= 0) {
        return { cart: state.cart };
      }

      return { cart: [...state.cart, { product, quantity: 1 }] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }

    set((state) => {
      const item = state.cart.find((i) => i.product.id === productId);
      if (!item) return { cart: state.cart };

      // Enforce inventory stock limit
      const targetQty = Math.min(quantity, item.product.stock);

      return {
        cart: state.cart.map((i) =>
          i.product.id === productId ? { ...i, quantity: targetQty } : i
        ),
      };
    });
  },

  setDiscount: (amount) => {
    set({ discount: amount < 0 ? 0 : amount });
  },

  clearCart: () => {
    set({ cart: [], discount: 0 });
  },

  getSubtotal: () => {
    return get().cart.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    const total = subtotal - discount;
    return total < 0 ? 0 : total;
  },

  getItemCount: () => {
    return get().cart.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
