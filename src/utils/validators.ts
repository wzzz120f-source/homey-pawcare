/**
 * 数据验证工具
 */

export const Validators = {
  /**
   * 验证邮箱格式
   */
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * 验证电话号码（中国格式）
   */
  phone: (phone: string): boolean => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  },

  /**
   * 验证密码强度
   * 至少8个字符，包含大小写字母、数字和特殊字符
   */
  passwordStrength: (password: string): boolean => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    return (
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  },

  /**
   * 验证 URL
   */
  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 验证正整数
   */
  positiveInteger: (value: any): boolean => {
    return Number.isInteger(value) && value > 0;
  },

  /**
   * 验证数字范围
   */
  numberRange: (value: number, min: number, max: number): boolean => {
    return value >= min && value <= max;
  },

  /**
   * 验证字符串长度
   */
  stringLength: (value: string, min: number, max: number): boolean => {
    return value.length >= min && value.length <= max;
  },

  /**
   * 验证日期
   */
  date: (date: any): boolean => {
    if (!(date instanceof Date)) {
      return false;
    }
    return !isNaN(date.getTime());
  },

  /**
   * 验证过去的日期
   */
  pastDate: (date: Date): boolean => {
    return date < new Date();
  },

  /**
   * 验证未来的日期
   */
  futureDate: (date: Date): boolean => {
    return date > new Date();
  },

  /**
   * 验证数组不为空
   */
  nonEmptyArray: (arr: any[]): boolean => {
    return Array.isArray(arr) && arr.length > 0;
  },

  /**
   * 验证对象不为空
   */
  nonEmptyObject: (obj: any): boolean => {
    return (
      obj &&
      typeof obj === 'object' &&
      Object.keys(obj).length > 0
    );
  },
};
