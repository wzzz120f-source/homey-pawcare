

## 修复结账时购物车下拉看不全

**问题**：在商城点购物车图标后弹出的"购物车抽屉"是一个**居中 Dialog**（`max-w-md max-h-[80vh]`），里面又嵌了一层 `max-h-[50vh] overflow-y-auto` 的商品列表。当商品较多 / 视口较小 / 移动端浏览器地址栏占位时：

1. Dialog 居中定位 + `translate(-50%, -50%)`，内容超过视口高度时**底部"去结算"按钮和合计金额被裁掉**且无法滚动到（外层蒙层吞掉滚动手势）。
2. 内层 `50vh` + 头部 + 底部按钮加起来可能超过外层 `80vh`，footer 被挤出 Dialog 边界。

## 修改方案（仅 1 个文件）

**文件**：`src/pages/ShopPage.tsx` —— 购物车抽屉部分（约 389-459 行）

把居中 Dialog 改成**底部弹起的 Sheet（bottom sheet）**，更符合移动端"购物车"交互习惯，并用 flex 列布局让中间商品区自适应填充剩余空间，保证标题和"去结算"按钮永远固定可见可点。

具体改动：

1. 引入 `@/components/ui/sheet`（项目已存在）。
2. 将购物车抽屉从 `<Dialog>/<DialogContent>` 替换为 `<Sheet>/<SheetContent side="bottom">`。
3. `SheetContent` 使用 `h-[85vh] flex flex-col p-0`，结构为：
   - `SheetHeader`（固定高度，`shrink-0`，含标题和数量）
   - 商品列表容器：`flex-1 overflow-y-auto px-5 py-3 space-y-3`（自适应剩余高度，唯一滚动区）
   - 底部结算栏：`shrink-0 px-5 py-4 border-t bg-card`，含合计 + 清空 + 去结算按钮，并加 `pb-[env(safe-area-inset-bottom)]` 适配 iPhone 小白条
4. 移除内层 `max-h-[50vh]` 限制，改由 flex 布局接管。
5. 商品列表条目本身样式保持不变（图标 / 数量 +/- / 删除按钮）。

## 验证方式

改完后：
- 桌面端 904×681：购物车从底部弹起，占 85% 视口高，"去结算"按钮始终可见。
- 加 6+ 件商品：中间列表内部滚动，标题和底部按钮固定。
- 点"去结算"跳转 `/payment` 流程不变。

## 不影响范围

- 商品详情 Dialog、商家详情 Dialog、PaymentPage 优惠券 Dialog 都不动。
- `useCart` hook、结算跳转参数、订单写入逻辑全部保持原样。

