/**
 * 预订相关类型定义
 */

import type { Address, Rating, Image } from './common';

/**
 * 预订状态
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

/**
 * 付款状态
 */
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'partial';

/**
 * 预订请求
 */
export interface BookingRequest {
  serviceProviderId: string;
  serviceType: string;
  petIds: string[];
  startTime: Date;
  endTime: Date;
  location: Address;
  specialRequests?: string;
  notes?: string;
}

/**
 * 预订详情
 */
export interface Booking {
  id: string;
  petOwnerId: string;
  serviceProviderId: string;
  serviceWorkerId?: string;
  serviceType: string;
  pets: string[]; // Pet IDs
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
  location: Address;
  estimatedDuration: number; // 分钟
  actualDuration?: number;
  specialRequests?: string;
  notes?: string;
  price: Price;
  payment: Payment;
  review?: Review;
  cancellation?: Cancellation;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 价格信息
 */
export interface Price {
  basePrice: number;
  addons: PriceAddon[];
  discount?: number;
  discountReason?: string;
  tax: number;
  totalPrice: number;
  currency: string; // "CNY"
}

/**
 * 价格附加项
 */
export interface PriceAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

/**
 * 支付信息
 */
export interface Payment {
  id: string;
  bookingId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  method: PaymentMethod;
  transactionId?: string;
  paidAt?: Date;
  refunds: Refund[];
}

/**
 * 支付方式
 */
export type PaymentMethod = 'credit_card' | 'debit_card' | 'alipay' | 'wechat_pay' | 'bank_transfer';

/**
 * 退款
 */
export interface Refund {
  id: string;
  amount: number;
  reason: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

/**
 * 取消信息
 */
export interface Cancellation {
  id: string;
  reason: string;
  cancelledBy: 'pet_owner' | 'service_provider' | 'admin';
  refundAmount: number;
  cancelledAt: Date;
}

/**
 * 评价
 */
export interface Review {
  id: string;
  bookingId: string;
  reviewerId: string;
  rating: number; // 1-5
  title: string;
  comment: string;
  photos?: Image[];
  response?: ReviewResponse;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 评价回复
 */
export interface ReviewResponse {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 预订统计
 */
export interface BookingStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  totalReviews: number;
}

/**
 * 服务记录
 */
export interface ServiceLog {
  id: string;
  bookingId: string;
  timestamp: Date;
  type: 'started' | 'in_progress' | 'completed' | 'issue';
  notes: string;
  photos?: Image[];
  location?: { latitude: number; longitude: number };
}

/**
 * 时间段信息
 */
export interface TimeSlotInfo {
  date: Date;
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  isAvailable: boolean;
  reason?: string; // 不可用原因
}

/**
 * 预订统计（服务商视角）
 */
export interface ProviderBookingStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalEarnings: number;
  averageRating: number;
  totalReviews: number;
  acceptanceRate: number;
}
