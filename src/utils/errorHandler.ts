/**
 * 错误处理工具
 */

import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

/**
 * 自定义错误类
 */
export class AppErrorClass extends Error implements AppError {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 常见错误
 */
export const ErrorCodes = {
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // 验证错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  WEAK_PASSWORD: 'WEAK_PASSWORD',

  // 资源错误
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // 业务错误
  BOOKING_ERROR: 'BOOKING_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  LOCATION_ERROR: 'LOCATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // 系统错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
};

/**
 * 错误映射
 */
const errorMap: Record<string, { statusCode: number; message: string }> = {
  [ErrorCodes.UNAUTHORIZED]: {
    statusCode: 401,
    message: '未授权，请登录',
  },
  [ErrorCodes.FORBIDDEN]: {
    statusCode: 403,
    message: '禁止访问',
  },
  [ErrorCodes.INVALID_CREDENTIALS]: {
    statusCode: 401,
    message: '用户名或密码错误',
  },
  [ErrorCodes.SESSION_EXPIRED]: {
    statusCode: 401,
    message: '会话已过期，请重新登录',
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    statusCode: 400,
    message: '验证失败',
  },
  [ErrorCodes.INVALID_EMAIL]: {
    statusCode: 400,
    message: '邮箱格式无效',
  },
  [ErrorCodes.INVALID_PHONE]: {
    statusCode: 400,
    message: '电话号码格式无效',
  },
  [ErrorCodes.WEAK_PASSWORD]: {
    statusCode: 400,
    message: '密码强���不足',
  },
  [ErrorCodes.NOT_FOUND]: {
    statusCode: 404,
    message: '资源不存在',
  },
  [ErrorCodes.ALREADY_EXISTS]: {
    statusCode: 409,
    message: '资源已存在',
  },
  [ErrorCodes.CONFLICT]: {
    statusCode: 409,
    message: '请求冲突',
  },
  [ErrorCodes.BOOKING_ERROR]: {
    statusCode: 400,
    message: '预订失败',
  },
  [ErrorCodes.PAYMENT_ERROR]: {
    statusCode: 400,
    message: '支付失败',
  },
  [ErrorCodes.LOCATION_ERROR]: {
    statusCode: 400,
    message: '位置信息错误',
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    statusCode: 503,
    message: '服务暂时不可用',
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    statusCode: 500,
    message: '服务器内部错误',
  },
  [ErrorCodes.DATABASE_ERROR]: {
    statusCode: 500,
    message: '数据库错误',
  },
  [ErrorCodes.NETWORK_ERROR]: {
    statusCode: 503,
    message: '网络连接失败',
  },
};

/**
 * 创建错误
 */
export function createError(
  code: string,
  message?: string,
  details?: Record<string, any>
): AppErrorClass {
  const errorInfo = errorMap[code];
  const statusCode = errorInfo?.statusCode || 500;
  const msg = message || errorInfo?.message || '未知错误';

  return new AppErrorClass(msg, code, statusCode, details);
}

/**
 * 处理错误
 */
export function handleError(error: any): AppError {
  if (error instanceof AppErrorClass) {
    return error;
  }

  if (error instanceof Error) {
    logger.error('Unhandled error', error);
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message || '发生未知错误',
      statusCode: 500,
    };
  }

  logger.error('Unknown error', String(error));
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: '发生未知错误',
    statusCode: 500,
  };
}

/**
 * 是否是 API 错误
 */
export function isApiError(error: any): error is AppError {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    'statusCode' in error
  );
}
