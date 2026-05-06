/**
 * 环境变量配置
 */

export const env = {
  // Supabase
  supabase: {
    projectId: import.meta.env.VITE_SUPABASE_PROJECT_ID || '',
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },

  // 应用配置
  app: {
    name: import.meta.env.VITE_APP_NAME || '萌宠到家',
    version: import.meta.env.VITE_APP_VERSION || '0.1.0',
    apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10),
  },

  // 第三方服务
  services: {
    amap: {
      apiKey: import.meta.env.VITE_AMAP_API_KEY || '',
    },
    alipay: {
      appId: import.meta.env.VITE_ALIPAY_APP_ID || '',
    },
    wechatPay: {
      merchantId: import.meta.env.VITE_WECHAT_PAY_MERCHANT_ID || '',
    },
  },

  // 功能开关
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    errorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
    payment: import.meta.env.VITE_ENABLE_PAYMENT === 'true',
    locationTracking: import.meta.env.VITE_ENABLE_LOCATION_TRACKING === 'true',
  },

  // 环境
  environment: (import.meta.env.VITE_ENV || 'development') as
    | 'development'
    | 'staging'
    | 'production',

  // 判断环境
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};

/**
 * 验证环境变量
 */
export function validateEnv(): string[] {
  const errors: string[] = [];

  if (!env.supabase.projectId) {
    errors.push('VITE_SUPABASE_PROJECT_ID is not set');
  }

  if (!env.supabase.publishableKey) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set');
  }

  if (!env.supabase.url) {
    errors.push('VITE_SUPABASE_URL is not set');
  }

  return errors;
}
