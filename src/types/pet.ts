/**
 * 宠物相关类型定义
 */

import type { Image } from './common';

/**
 * 宠物类型
 */
export type PetType = 'dog' | 'cat' | 'rabbit' | 'bird' | 'fish' | 'other';

/**
 * 宠物体型
 */
export type PetSize = 'small' | 'medium' | 'large' | 'extra_large';

/**
 * 宠物性别
 */
export type PetGender = 'male' | 'female' | 'unknown';

/**
 * 宠物档案
 */
export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  type: PetType;
  breed: string;
  color?: string;
  size: PetSize;
  gender: PetGender;
  dateOfBirth: Date;
  weight?: number; // kg
  microchipId?: string;
  avatar?: Image;
  photos: Image[];
  medicalHistory: MedicalRecord[];
  vaccinations: Vaccination[];
  allergies: Allergy[];
  dietaryRestrictions?: string[];
  behaviors?: Behavior[];
  temperament: string;
  specialNeeds?: string;
  emergencyContact?: PetEmergencyContact;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 医疗记录
 */
export interface MedicalRecord {
  id: string;
  petId: string;
  date: Date;
  type: 'examination' | 'treatment' | 'surgery' | 'vaccination' | 'other';
  diagnosis: string;
  treatment: string;
  veterinarian: string;
  clinic: string;
  notes?: string;
  attachments?: string[]; // URLs
}

/**
 * 预防接种
 */
export interface Vaccination {
  id: string;
  petId: string;
  name: string; // "Rabies", "DHPP", etc.
  date: Date;
  expiryDate?: Date;
  veterinarian: string;
  clinic: string;
  certificateUrl?: string;
}

/**
 * 过敏信息
 */
export interface Allergy {
  id: string;
  petId: string;
  allergen: string; // "peanuts", "chicken", etc.
  severity: 'mild' | 'moderate' | 'severe';
  symptoms: string[];
  treatment?: string;
  notes?: string;
}

/**
 * 行为记录
 */
export interface Behavior {
  id: string;
  petId: string;
  type: string; // "barking", "aggression", "anxiety", etc.
  trigger?: string;
  severity: 'mild' | 'moderate' | 'severe';
  notes: string;
}

/**
 * 宠物紧急联系人
 */
export interface PetEmergencyContact {
  veterinarian: {
    name: string;
    phone: string;
    clinic: string;
  };
  alternateContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

/**
 * 宠物健康统计
 */
export interface PetHealthStats {
  petId: string;
  lastCheckup?: Date;
  nextCheckup?: Date;
  vaccinationStatus: 'up_to_date' | 'pending' | 'overdue';
  lastVaccination?: Date;
  nextVaccinationDue?: Date;
  recentIssues: string[];
}

/**
 * 宠物创建请求
 */
export interface CreatePetRequest {
  name: string;
  type: PetType;
  breed: string;
  size: PetSize;
  gender: PetGender;
  dateOfBirth: Date;
  weight?: number;
  color?: string;
  temperament?: string;
  specialNeeds?: string;
}

/**
 * 宠物更新请求
 */
export interface UpdatePetRequest {
  name?: string;
  breed?: string;
  size?: PetSize;
  weight?: number;
  color?: string;
  temperament?: string;
  specialNeeds?: string;
}
