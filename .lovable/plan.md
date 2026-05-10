## 目标

围绕「接单大厅 / 语音聊天 / 服务打卡」三个模块做体验和稳健性强化，全部为前端改动，不动数据库。

---

## 1. 接单大厅卡片（`src/pages/DriverHallPage.tsx`）

- 在每张订单卡新增「查看路线详情」可折叠面板（基于本地 `expandedId` 状态，不引入新依赖）：
  - 起点 / 终点完整地址（不再 `truncate`）
  - 距离 / 预计耗时 / 预计净收益的**计算口径说明**：`净收益 = max(driver_fare, total_amount, km × ¥2.5) × (1 − 15% 平台佣金)`，平均车速 30km/h
  - 一键「复制订单摘要」按钮：用 `navigator.clipboard.writeText` 写入订单号、起终点、距离、ETA、净收益的多行文本，复制成功 toast 提示
- **并发保护强化**：
  - `grabbing` 状态保留，同时给「一键接单」按钮加 `aria-disabled` 与 `pointer-events-none`
  - 新增 `lockRef = useRef<Set<string>>(new Set())`，`grab(id)` 入口处先判断是否已锁，避免极快双击在同一渲染帧绕过 React state
  - 抢单失败：保留当前列表中的订单（不立即清空），用 `await load()` 重新拉取，**保持滚动位置**：在调用 `load` 前后记录并恢复 `window.scrollY`（或 `main` 容器 scrollTop）

## 2. 语音录制弹窗（`src/pages/ChatPage.tsx`）

- 倒计时改为可视进度：`MAX_REC_SEC = 60`，到时**不再直接发送**，而是切换状态 `recPhase: "recording" | "review"`
  - 录音中：到 60s 自动 `mr.stop()` 并保留 `chunks` 在内存，弹窗切到「重录 / 发送」选择
  - 用户点击「发送」才执行上传 + 写消息；点「重录」清空 chunks 并重新 `startRecord`
- 用户主动停止录音也进入 review 阶段（在 review 阶段提供本地 `<audio>` 试听）
- 新增「撤回最近一条未送达语音」入口：
  - 维护 `lastVoiceMsgRef`：发送语音成功后记录 `{id, sentAt}`
  - 在底部工具条加一个小型「撤回」按钮，仅在最近 30 秒内、且最后一条语音由当前用户发送时显示
  - 点击后调用 `supabase.from('chat_messages').delete().eq('id', ...)` 并本地从 `msgs` 列表移除（RLS 已限制 sender 自删）
- 弹窗 UI 调整：录音中显示秒数 + 60s 进度条；review 阶段显示「重录 / 发送」两个等权按钮

## 3. 服务打卡缺失项跳转 + 二次校验（`src/components/ServiceCheckinChecklist.tsx`）

- 在每个 `<li>` 行加 `id="checkin-row-{key}"` 与 `ref` 收集，便于跨区域定位
- 顶部缺失项警告条中的项目改为可点击 chip：
  - 点击后 `scrollIntoView({behavior:'smooth', block:'center'})` 到对应行
  - 并对该行加临时 `ring-2 ring-amber-400` 高亮 1.5s（通过 `highlightKey` 状态）
  - 同时如果该项未拍照，自动触发 `trigger(key)` 调起拍照 input（移动端直接进相机）
- 「确认结单」二次校验：
  - 在 `AlertDialog` 打开前再 `await load()` 拉一次最新打卡数据，重新计算 `missing`
  - 若仍有缺失，直接关闭对话框，toast 提示并滚动到第一个缺失项
  - 若齐全才显示对话框 → `handleComplete` 调用 RPC

## 技术细节

- 仅前端改动，文件清单：
  - `src/pages/DriverHallPage.tsx`
  - `src/pages/ChatPage.tsx`
  - `src/components/ServiceCheckinChecklist.tsx`
- 不新增依赖；使用现有 shadcn `AlertDialog`、`Button`、`Badge`、`lucide-react` 图标（新增 `Copy`、`ChevronDown`、`Undo2`、`RotateCcw` 等）
- 撤回语音依赖现有 RLS：`chat_messages` 允许 sender 自删（若策略缺失，撤回会失败并 toast 报错，不破坏发送流程）

完成后回复一句话总结。