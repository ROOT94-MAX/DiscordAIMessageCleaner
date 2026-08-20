# DiscordAIMessageCleaner 架构文档

对应版本：v0.6.5 ｜ 更新日期：2026-08-21
本文描述**当前实现**，随代码同步更新；最初的实现计划（历史文档）见 [PLAN.md](./PLAN.md)。

## 1. 项目定位与安全模型

用 AI 审查并删除**当前登录账号自己**在 Discord 发过的历史消息。安全模型是全部设计的出发点：

- 只搜索、只审查、只删除自己的消息；他人消息永不删除。
- 删除不可逆，因此永不静默删除：先审后删 → 人工勾选 → 二次确认 → 可选 JSON 备份 → 节流执行。
- AI 只见文本（表情转 `:name:`、附件转文件名占位符），图片/附件内容不上传。
- 消息内容只发往用户自配的 AI 端点，无遥测；日志不落消息正文与密钥。

## 2. 运行环境与约束

- BetterDiscord ≥ 1.13，桌面版 Discord。只依赖 BdApi，无第三方库。
- 交付物为单文件 `DiscordAIMessageCleaner.plugin.js`，UTF-8 无 BOM（带 BOM 会破坏 BD 的插件头解析）。
- i18n 文案直接使用 UTF-8 中文；zh-CN / en-US 双语。
- 许可 GPL-2.0。

## 3. 仓库结构与构建管线

```
src/header.js                BD 元数据头 + IIFE 包装开头（@version 在此）
src/sections/NN-*.js         24 个分区模块，文件名编号 = 拼装顺序 = 依赖顺序
src/footer.js                IIFE 包装收尾
tools/build.js               确定性构建：零依赖、零转换，按文件名序逐字节拼装出根目录插件文件
tools/verify.js              三条不变量：src 重建与产物逐字节一致；产物通过 node --check；@version == PLUGIN_VERSION
tools/smoke_test.js          离线冒烟：桩化 BdApi 跑生命周期、设置页各标签渲染、配置迁移
tools/test_harness.js        离线功能测试（21 项）：注入方式暴露内部服务，用假 REST/假 AI 驱动
.github/workflows/verify.yml 每次推送跑 verify + 两套测试
```

**开发规则**：只改 `src/`，然后 `node tools/build.js`；绝不手改根目录产物（verify 会拒绝）。改版本号需同步四处：`src/header.js` 的 `@version`、`01-constants.js` 的 `PLUGIN_VERSION`、两份 README 的徽章与"当前版本"行。

## 4. 模块地图与依赖方向

后区可用前区，反向禁止。**铁律：只有 07 适配器允许触碰 Discord 内部模块**（webpack 查找、store、REST、搜索端点）；每个 getter 惰性查找、缓存、失败返回 null 并记入 `health()`。AIService 只用 `BdApi.Net.fetch` 且每次显式传 `timeout`。

| 模块 | 职责 |
|---|---|
| 01-constants | 插件常量、支持的频道/消息类型、AI 平台预置表、默认配置 |
| 02-bound-api-logger | 绑定 BdApi 实例、ReactDOM、日志 |
| 03-small-utils | 纯函数工具（deepMerge、节流 sleep、token 估算、stripEmojiTags…） |
| 04-i18n | zh-CN / en-US 平面键值表 + 内置审查策略模板 |
| 05-settings-store | 配置加载/深合并/250ms 防抖持久化 |
| 06-snowflake-util | 雪花 ID ↔ 时间戳 |
| 07-discord-adapter | **唯一的 Discord 内部触点层**（REST、stores、聊天按钮组件、模态系统） |
| 08-channel-context | 频道上下文归一化（服务器/DM/群聊、名称解析） |
| 09-errors | PluginError 错误码体系 |
| 10-message-service | 逐页拉取 + 429 退避 + 作者/类型过滤 + 续扫游标（回退路径） |
| 10b-search-service | 按 `author_id` 走内部搜索端点（频道/全服务器）、202 索引等待、SEARCH_UNAVAILABLE 回退信号 |
| 11-normalizer | 原始消息 → {id, channelId, content, attachments{url,isImage}, edited} |
| 12-review-batcher | 按条数+字符预算切审查批次、token 估算 |
| 13-ai-service | 多平台配置解析、验证/取模型、并发工作池审查、容错判定解析（解析失败进重试桶，绝不误标） |
| 14a-delete-service | 单并发节流删除队列：404=跳过、403=中止全队、429 风暴自动暂停、逐条 channelId 路由 |
| 14b-export-service | 删除前备份/删除记录 JSON，三级保存链（openDialog → saveWithDialog → Downloads） |
| 15-styles | `--damc-*` 设计令牌层（映射 Discord CSS 变量）+ 全部组件样式 |
| 16-lifecycle-registries | Disposables/ActiveRuns；**ReviewSession**（后台审查会话，唯一写入点）；**MiniPill**（悬浮胶囊，锚定聊天输入框列并避让其他悬浮元素）；**ScanCache**（误关弹窗恢复） |
| 17-ui-react-helpers | h、Btn、ProgressStrip 等 |
| 18-ui-chat-button | 输入框按钮组件 |
| 19-ui-cleaner-modal | 清理弹窗：状态机、结果列表、表情/缩略图渲染、灯箱（body Portal） |
| 20-chat-entry | 三入口：按钮注入（webpack patch，DOM 兜底）、右键菜单 ×3、`/aiclean` 命令 |
| 21-settings-panel | 自绘 React 设置面板：AI 平台 / 审查策略 / 清理行为 / 诊断 |
| 22-plugin-class | start/stop 生命周期、onSwitch、openCleaner |

## 5. Discord 内部触点与修复要点

| 触点 | 失效表现 | 降级/修复 |
|---|---|---|
| 聊天按钮行组件（bySource 双串 + `.A`） | 输入框按钮消失 | 自动降级 DOM 注入 + toast；右键菜单/命令仍可用 |
| REST 模块（动词形状 → bySource 两级） | 扫描/删除报"无法定位请求模块" | 调整 07 区两级策略数组 |
| 搜索端点 `/guilds/{id}/messages/search` | SEARCH_UNAVAILABLE | 频道范围自动回退逐页扫描（toast）；服务器范围提示切频道模式；DM 恒走扫描 |
| BD 确认模态（`damc-confirm-wide` 托管） | 弹窗无响应 | 见总结插件同款修复手册 |
| Stores（Channel/SelectedChannel/Guild/Permission/Locale/User） | 各自功能降级 | 权限预检返回 unknown、名称回退 ID 等 |

诊断页展示各触点 ok/missing 与入口状态，可一键复制诊断 JSON。

**已知坑（务必遵守）**：BD 弹窗的 onConfirm/onCancel/onClose 在关闭动画后**异步**触发，跨关闭传递状态必须用"回调自己消费的一次性标志"；弹窗卡片带 CSS transform，内部 `position: fixed` 会退化为卡片相对定位，全屏覆盖层（灯箱）必须 `ReactDOM.createPortal` 到 `document.body`；弹窗底部的下拉必须向上展开且用 mousedown 选中。

## 6. 核心数据流

```
入口（按钮 / 右键菜单 / /aiclean）
  → [setup]    范围（当前频道|整个服务器，仅服务器内可选）+ 时间段
  → [fetching] 服务器内走 SearchService（author_id 过滤，702ms/页节流，
               失败回退 MessageService 逐页扫描）；DM 恒走扫描
  → [results]  勾选列表（三态全选、只看命中、频道下拉筛选、表情/缩略图/灯箱）
               ├─ AI 审查：并发工作池逐批判定 → 命中标注+自动勾选
               │   可「后台运行」：关弹窗，ReviewSession 继续跑，MiniPill 显示进度
               ├─ 继续扫描更早的消息（cancelled/capped 时，resumeCursor 续扫合并）
               └─ 删除选中 → 二次确认 → 备份门(ask/always/never) → [deleting]
  → [deleting] 单并发节流 + 暂停/恢复 + 429 风暴自动暂停
  → [done]     成功/跳过/失败报告 + 删除记录导出；已删项从工作集移除
```

**状态归属**：审查管道只写模块级 `ReviewSession`（弹窗是订阅视图），这是"后台运行"能存活的原因；`ScanCache` 按频道缓存最近扫描结果，误关弹窗（背板/Esc）重开即恢复；取消语义 = 每次运行一个 AbortController（ActiveRuns 登记），stop() 逆序清理。

## 7. AI 审查契约

- 批次载荷：`[{i, time, text, att}]`，text 经 stripEmojiTags 截断 1500 字符。
- 输出契约：仅 JSON `{"verdicts":[{"i","v","c","s","r"}]}`，只含 v=true 项。
- 容错解析：剥围栏 → JSON.parse → 最外层花括号重试 → 仍失败整批进重试桶（UI 可重试失败批次），**绝不因解析失败误标违规**；索引白名单校验，未知类别归 other。
- 并发：`review.concurrency`（默认 3，1-8）工作池；429/5xx 单批有界重试。
- 审查前 token 估算超 `confirmAboveTokens` 先确认；判定理由跟随界面语言。

## 8. 配置模式（settings v1，要点）

`general.interfaceLanguage`；`ai.{provider, providers{apiKey,baseUrl,model,models[]}, custom[], temperature(固定默认), maxOutputTokens, aiIdleTimeoutMs}`（与总结插件 v2 同构，模型列表持久化）；`review.{concurrency, policyId, policies[], policyPrompt(旧字段自动迁移进策略库), batchSize, batchCharBudget, confirmAboveTokens, includeEdited}`；`fetch.{maxMessages, pageDelayMs}`；`delete.{pacingMs, maxPerRun, backupBeforeDelete}`。未知字段丢弃、默认值深合并、250ms 防抖写入、stop() 强制 flush。

## 9. 测试与发布纪律

- 每次改动：`node tools/build.js` → `node tools/verify.js` → 两套测试全绿 → 复制到 BD plugins 实测 → **本地 git 提交（快照，可回退）**。
- **`git push` 与 GitHub Release 只在用户于 Discord 实测确认后执行**，绝不自动发布。
- 发布后发现问题的版本：修复版沿用同一版本号替换发布（删除坏 Release+标签后重发），不跳号。
- 本地分支：`release`（跟踪 origin/main，公开干净历史）；`master`/`dev-history`（完整开发历史，永不推送）。

## 10. 路线图

深分页时间窗自动切分（>5000 条）→ 删除阶段也支持后台运行 → 定时自动巡检 → 发送前实时拦截（独立开关）→ 附件视觉审查（vision 模型）。
