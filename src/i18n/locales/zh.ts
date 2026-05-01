// Chinese (Simplified) locale
const zh = {
  common: {
    back: "返回",
    retry: "重试",
    cancel: "取消",
    confirm: "确认",
    save: "保存",
    saveDraft: "保存草稿",
    customerService: "转人工客服",
    copy: "一键复制",
    copied: "已复制错误详情",
    copyFailed: "复制失败，请手动选择文字复制",
    language: "语言",
  },
  language: {
    zh: "中文",
    en: "English",
  },
  booking: {
    title: "预约详情",
    pickupTab: "宠物接送",
    homeTab: "上门服务",
    storeTab: "门店寄养",
    pickupAddress: "接送地址",
    pickupSection: "选择接送方式",
    submit: "确认预约",
    addressSummary: "地址摘要",
  },
  errors: {
    title: "出现问题",
    subtitle: "请根据下面的提示重试，问题持续可联系客服并附上错误详情。",
    addressSearch: {
      label: "地址搜索失败",
      hint: "无法解析当前输入的地址，请检查拼写或更换关键字后重试。",
    },
    routePlanning: {
      label: "路线规划失败",
      hint: "高德路径规划返回异常，已按起步价估算，请稍后重试。",
    },
    orderSubmit: {
      label: "订单提交失败",
      hint: "下单服务暂不可用，请稍后重试或联系人工客服。",
    },
    aiAdvice: {
      rateLimit: "请求过于频繁，已显示离线兜底建议。",
      credit: "AI 额度不足，已显示离线兜底建议。",
      offline: "AI 服务暂时不可用，已显示离线兜底建议。",
    },
    retryAction: "重试",
    copyDetails: "一键复制错误详情",
    detailsLabel: "错误详情",
  },
} as const;

export default zh;
export type Translation = typeof zh;
