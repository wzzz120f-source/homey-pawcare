/**
 * 通用类型定义
 */

/**
 * API 响应基础类型
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId: string;
}

/**
 * API 错误信息
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 地理位置
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
}

/**
 * 地址信息
 */
export interface Address {
  id?: string;
  street: string;
  district: string;
  city: string;
  province: string;
  zipCode?: string;
  country?: string;
  location?: GeoLocation;
  label?: string; // "home" | "work" | "other"
}

/**
 * 操作结果
 */
export interface OperationResult<T = void> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * 时间范围
 */
export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

/**
 * 时间段（用于营业时间）
 */
export interface TimeSlot {
  dayOfWeek: number; // 0-6, 0 = Sunday
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  isAvailable: boolean;
}

/**
 * 评分信息
 */
export interface Rating {
  id: string;
  score: number; // 1-5
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 文件上传
 */
export interface FileUpload {
  file: File;
  url?: string;
  size?: number;
  mimeType?: string;
}

/**
 * 图片信息
 */
export interface Image {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  alt?: string;
}

/**
 * 通知类型
 */
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'provider_arriving'
  | 'message_received'
  | 'review_received'
  | 'payment_completed'
  | 'payment_failed';

/**
 * 通知
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

/**
 * 用户角色
 */
export type UserRole = 'pet_owner' | 'service_provider' | 'service_worker' | 'admin';

/**
 * 操作状态
 */
export type OperationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * 环境配置
 */
export interface AppConfig {
  appName: string;
  appVersion: string;
  apiTimeout: number;
  environment: 'development' | 'staging' | 'production';
  enableAnalytics: boolean;
  enableErrorTracking: boolean;
  enablePayment: boolean;
  enableLocationTracking: boolean;
}
