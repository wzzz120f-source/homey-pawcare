/**
 * 用户相关类型定义
 */

import type { Address, Image, TimeSlot, Rating } from './common';

/**
 * 用户角色
 */
export type UserRole = 'pet_owner' | 'service_provider' | 'service_worker' | 'admin';

/**
 * 用户认证状态
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error?: string;
}

/**
 * 用户基础信息
 */
export interface User {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  avatar?: Image;
  roles: UserRole[];
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 宠物主人档案
 */
export interface PetOwnerProfile extends User {
  addresses: Address[];
  favoriteProviders: string[]; // Provider IDs
  totalBookings: number;
  averageRating: number;
  paymentMethods: PaymentMethod[];
  emergencyContact?: EmergencyContact;
  preferences?: PetOwnerPreferences;
}

/**
 * 服务提供者档案
 */
export interface ServiceProviderProfile extends User {
  businessName: string;
  businessRegistration?: string;
  description: string;
  avatar: Image;
  coverImage?: Image;
  serviceAreas: Address[];
  services: ServiceType[];
  qualifications: Qualification[];
  insurance?: Insurance;
  averageRating: number;
  totalReviews: number;
  responseRate: number;
  acceptanceRate: number;
  totalEarnings: number;
  bankAccount?: BankAccount;
  availability: TimeSlot[];
  workingHours: TimeSlot[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 服务工作者档案
 */
export interface ServiceWorkerProfile extends User {
  serviceProviderId: string;
  bio: string;
  experience: number; // 年数
  qualifications: Qualification[];
  specialties: string[];
  averageRating: number;
  totalReviews: number;
  totalCompletedServices: number;
  availability: TimeSlot[];
  documents: Document[];
}

/**
 * 资格认证
 */
export interface Qualification {
  id: string;
  title: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  certificateUrl?: string;
  isVerified: boolean;
}

/**
 * 保险信息
 */
export interface Insurance {
  provider: string;
  policyNumber: string;
  coverageAmount: number;
  expiryDate: Date;
  isActive: boolean;
}

/**
 * 银行账户
 */
export interface BankAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  isVerified: boolean;
}

/**
 * 支付方式
 */
export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'debit_card' | 'alipay' | 'wechat_pay';
  last4?: string;
  expiryDate?: string;
  isDefault: boolean;
  isVerified: boolean;
}

/**
 * 紧急联系人
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

/**
 * 宠物主人偏好
 */
export interface PetOwnerPreferences {
  notificationSettings: NotificationSettings;
  languagePreference: string;
  privacyLevel: 'public' | 'friends_only' | 'private';
  autoRebook: boolean;
}

/**
 * 通知设置
 */
export interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  bookingReminders: boolean;
  reviewReminders: boolean;
  promotions: boolean;
}

/**
 * 服务类型
 */
export type ServiceType =
  | 'dog_walking'
  | 'cat_sitting'
  | 'pet_sitting'
  | 'pet_boarding'
  | 'grooming'
  | 'training'
  | 'veterinary'
  | 'pet_supplies';

/**
 * 文档（用于认证）
 */
export interface Document {
  id: string;
  type: 'id_card' | 'driver_license' | 'qualification' | 'insurance';
  name: string;
  url: string;
  expiryDate?: Date;
  isVerified: boolean;
  verifiedAt?: Date;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 注册请求
 */
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  roles: UserRole[];
}

/**
 * 认证响应
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * 密码重置确认
 */
export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
