import { create } from 'zustand';

export interface OrderHistory {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'filled' | 'failed';
  orderId?: number;
  error?: string;
  isAutoTrading: boolean;
  pairId?: string; // 진입 주문과 스탑로스를 연결하기 위한 ID
}

interface OrderHistoryStore {
  orders: OrderHistory[];
  addOrder: (order: Omit<OrderHistory, 'id' | 'timestamp'>) => void;
  updateOrderStatus: (id: string, status: 'filled' | 'failed', error?: string) => void;
  clearHistory: () => void;
  loadFromStorage: () => void;
}

const STORAGE_KEY = 'trading_order_history';
const MAX_HISTORY_SIZE = 100; // 최대 100개까지만 저장

export const useOrderHistoryStore = create<OrderHistoryStore>((set, get) => ({
  orders: [],

  addOrder: (order) => {
    const newOrder: OrderHistory = {
      ...order,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };

    set((state) => {
      const updatedOrders = [newOrder, ...state.orders].slice(0, MAX_HISTORY_SIZE);
      // localStorage에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
      return { orders: updatedOrders };
    });
  },

  updateOrderStatus: (id, status, error) => {
    set((state) => {
      const updatedOrders = state.orders.map((order) =>
        order.id === id ? { ...order, status, error } : order
      );
      // localStorage에 저장
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedOrders));
      return { orders: updatedOrders };
    });
  },

  clearHistory: () => {
    set({ orders: [] });
    localStorage.removeItem(STORAGE_KEY);
  },

  loadFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const orders = JSON.parse(stored);
        set({ orders });
      }
    } catch (error) {
      console.error('Failed to load order history:', error);
    }
  },
}));
