/**
 * 内容安全检测：拦截个人收款码/二维码/支付方式相关文字
 */

const PAYMENT_KEYWORDS = [
  // 微信支付宝相关
  "微信号", "微信支付", "支付宝", "alipay", "wechat pay",
  "扫一扫", "扫码支付", "扫我", "扫码转账",
  "收款码", "付款码", "收钱码", "二维码转账",
  "私信付款", "私聊红包", "加微信付", "加我微信",
  // 银行账号
  "银行卡号", "工商银行", "建设银行", "招商银行", "农业银行",
  // 数字钱包
  "私转", "微信转账", "线下交易",
];

// 微信号、QQ号、手机号、银行卡号正则
const PATTERNS = [
  /\b\d{11}\b/g, // 手机号
  /\b\d{16,19}\b/g, // 银行卡号
  /(微信|wx|vx|v信|薇信)[\s::]*[a-zA-Z0-9_-]{4,}/gi,
  /\bQQ[\s::]*\d{5,12}\b/gi,
];

export interface SafetyResult {
  safe: boolean;
  violations: string[];
}

export function checkTextSafety(text: string): SafetyResult {
  if (!text) return { safe: true, violations: [] };
  const lower = text.toLowerCase();
  const violations: string[] = [];

  for (const kw of PAYMENT_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      violations.push(`命中敏感词：${kw}`);
    }
  }

  for (const pattern of PATTERNS) {
    if (pattern.test(text)) {
      violations.push("疑似手机号/账号信息");
      break;
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * 简单图片二维码启发式检测：通过文件名暗示
 * 真正的 QR 检测需要 jsQR 等库，本轮先用占位策略，
 * 在客户端给出温和提示，并允许平台自动审核标记。
 */
export function checkImageHint(file: File): SafetyResult {
  const name = file.name.toLowerCase();
  const violations: string[] = [];
  if (/(qr|qrcode|二维码|收款|付款|wechatpay|alipay)/.test(name)) {
    violations.push("文件名疑似收款/二维码");
  }
  return { safe: violations.length === 0, violations };
}

/**
 * 生成虚拟中间号（占位，供寻宠雷达使用）
 * 真实场景需要接入隐私号服务（阿里云/腾讯云号码隐私保护）
 */
export function generateVirtualPhone(seed: string): string {
  // 9 位虚拟前缀 + 后4位 hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const last4 = String(hash % 10000).padStart(4, "0");
  return `400-PET-${last4}`;
}
