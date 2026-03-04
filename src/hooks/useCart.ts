import { useState, useCallback } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  quantity: number;
  categoryId: string | null;
  merchantName: string;
}

// Simple in-memory cart (persisted in localStorage)
const CART_KEY = "pawcare_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const useCart = () => {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      let next: CartItem[];
      if (existing) {
        next = prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      } else {
        next = [...prev, { ...item, quantity: 1 }];
      }
      saveCart(next);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) => {
      const next = quantity <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity } : i));
      saveCart(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveCart(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_KEY);
  }, []);

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clearCart, totalAmount, totalItems };
};
