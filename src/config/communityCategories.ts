export const POST_CATEGORIES = [
  { value: "all", label: "全部", icon: "✨" },
  { value: "cat", label: "猫咪", icon: "🐱" },
  { value: "dog", label: "狗狗", icon: "🐶" },
  { value: "exotic", label: "异宠", icon: "🦎" },
  { value: "science", label: "科普", icon: "📚" },
  { value: "life", label: "生活", icon: "🌿" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["value"];

export const HOT_TAGS = [
  "科学换粮日记",
  "新手养猫避雷",
  "宠物视角",
  "萌宠日常",
  "救助记录",
  "营养均衡",
  "驱虫科普",
];
