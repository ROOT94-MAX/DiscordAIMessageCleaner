# DiscordAIMessageCleaner 实现计划

> **历史文档**：这是 2026-08-20 立项时的实现计划，保留作设计决策的出处；里程碑 M1–M5 均已完成，之后的功能（后台审查、可续扫描、频道筛选、悬浮胶囊等）不在本文中。**当前架构的权威描述见 [ARCHITECTURE.md](./ARCHITECTURE.md)**（随代码同步更新）。

版本：v0.1（规划稿）｜ 日期：2026-08-20
参考项目：同作者的 DiscordChannelExportSummary（频道总结/导出插件，v0.8.5，下称"总结插件"）

## 1. 目标与非目标

**一句话**：在任意频道 / 私信 / 群聊中，一键让 AI 审查"我自己发过的历史消息"，把命中违规策略的消息列出来，经确认后自动删除。

**目标**：
- 支持服务器文本频道 / 公告频道 / 线程 / 私信(DM) / 群聊(Group DM)——比总结插件多出 DM 支持。
- 只审查、只删除**当前登录账号自己发的消息**，永不触碰他人消息。
- 违规标准由用户自定义（审查策略提示词可编辑，内置默认模板）。
- AI 端点复用总结插件的多平台方案（OpenAI / DeepSeek / Gemini / Ollama / LM Studio + 自定义，OpenAI 兼容协议）。
- 删除不可逆，因此安全设计是第一优先级：默认"先审后删 + 人工勾选确认"，删除前可一键导出备份。
- 只依赖 BdApi，交付物为单文件 `.plugin.js`，UTF-8 无 BOM。（2026-08-21 起源码模块化到 `src/`，由 `tools/build.js` 确定性拼装为单文件，构建零依赖、零转换。）

**非目标（v1）**：
- 不做"实时拦截"（发送前审查）——只做历史消息清理。
- 不做他人消息批量清理（自己的消息支持全服务器范围，见 M5）。
- 不做定时自动巡检（路线图）。

**M5 已实现（v0.4.0）搜索模式**：SearchService 用 Discord 内部搜索端点按 `author_id` 直接搜自己的消息，支持"当前频道 / 整个服务器"切换；每页 700ms 节流、429 退避、索引未就绪(202)等待重试；深分页（offset>5000）暂不支持（按上限截断提示）。搜索失败：频道范围自动回退逐页扫描（toast 提示），服务器范围提示切换频道模式；DM/群聊始终走逐页扫描。删除按每条消息自己的 channelId 路由。

## 2. 复用策略

总结插件 22 个分区中，约 60% 可直接搬运或小改。铁律不变：**只有 DiscordAdapter 允许触碰 Discord 内部模块；AIService 只用 `BdApi.Net.fetch`**。

| 总结插件分区 | 处置 | 说明 |
|---|---|---|
| 01 CONSTANTS | 改 | 新增删除节流常量、批次大小、单次删除上限 |
| 02 Logger / 03 Utils | 搬运 | 原样 |
| 04 I18N | 重写文案 | 框架不变（zh-CN/en-US 平面键值表），键全部换新 |
| 05 SettingsStore | 搬运+改 schema | 多平台 AI 配置(v2)结构原样保留，新增 review/delete 配置组 |
| 06 SnowflakeUtil | 搬运 | 原样 |
| 07 DiscordAdapter | 搬运+扩展 | 新增 `UserStore`（getCurrentUser）触点；REST 已含 `del` |
| 08 ChannelContext | 改 | supported 判定扩展到 DM(1)/GroupDM(3)，DM 跳过权限预检 |
| 09 Errors | 搬运 | 原样 |
| 10 MessageService | 搬运+扩展 | 分页/429/abort 逻辑原样；`_finish` 增加 authorId 过滤 |
| 11 Normalizer | 精简 | 保留 id/ts/content/attachments/edited/replyTo，去掉 reactions 等总结特有字段 |
| 12 TranscriptBuilder | 替换 | 换成 ReviewBatcher：把消息切成 AI 审查批次 |
| 13 AIService | 传输层搬运，业务层重写 | normalizeBaseUrl / timeout:null+空闲计时 / 多平台 config() 原样；summarize 换成 review()（非流式，返回结构化判定） |
| 14 ExportService | 精简保留 | 用于"删除前备份导出"（JSON） |
| 15 Styles | 搬运 | 设计令牌层改前缀 `--damc-*` |
| 16 Lifecycle | 搬运 | Disposables / ActiveRuns 原样 |
| 17 UI React helpers | 搬运 | 原样 |
| 18 ChatButton / 20 ChatEntry | 搬运+改 | 图标换掉；**DM 也要显示按钮**（总结插件刻意在 DM 隐藏，此处放开） |
| 19 SummaryModal | 重写 | 换成 ReviewModal，状态机见第 4 节 |
| 21 SettingsPanel | 框架搬运 | AI 平台页原样复用；新增"审查策略"与"删除安全"两个标签页 |
| 22 Plugin 类 | 搬运+改名 | start/stop/热重载骨架不变 |
| （新增）DeleteService | 新写 | 见第 6 节，全插件唯一的新服务 |

## 3. 模块地图（分区编号）

```
UI 层        ChatEntry(20)    ReviewModal(19)    SettingsPanel(21)
                  │                 │                    │
服务层       MessageService(10)  AIService(13)    DeleteService(14a)
             Normalizer(11)    ReviewBatcher(12)  ExportService(14b)
                  │                 │                    │
底层         DiscordAdapter(07)   BdApi.Net         openDialog/fs
横切         CONSTANTS(01) Logger(02) Utils(03) I18N(04)
             SettingsStore(05) SnowflakeUtil(06) Styles(15)
             Disposables/ActiveRuns(16) Plugin 类(22)
```

依赖方向同总结插件：后区可用前区，反向禁止。分区横幅注释 `==== NN. NAME ====` 保持一致，便于两个项目互相对照维护。

## 4. 核心数据流与弹窗状态机

```
入口（聊天按钮 / 频道与DM右键菜单 / /aiclean 命令）
  → ReviewModal.open（BdApi.UI.showConfirmationModal 托管，宽版）
  → [setup]    范围选择（1d/7d/30d/全部≤上限/自定义）+ 审查策略预览
               + 上限提示；未配置 AI 时横幅提示并禁用主按钮
  → [fetching] MessageService.fetchRange（复用分页/限流/取消）
               → _finish 过滤 author.id === currentUser.id 且 type ∈ {0,19}
               单条进度带 + 内联取消；0 条自己的消息 → [empty]
  → [reviewing] ReviewBatcher 切批 → AIService.review 逐批（进度"批 i/K"）
               每批返回 verdict[]，容错解析；单批失败可重试/跳过
  → [results]  命中列表：每条 = 勾选框 + 时间 + 内容摘录 + 违规类别 + AI理由
               全选/全不选/按类别筛选；未命中折叠可展开复核
               工具栏：[导出备份] [删除选中 N 条]
  → 删除确认（二次确认框：明示不可逆 + 条数）
  → [deleting] DeleteService 顺序删除：进度 x/N + 暂停/取消
  → [done]     报告：成功 n / 失败 m（失败原因逐条列出）+ [导出记录]
```

**取消语义**：完全继承总结插件——每次运行一个 AbortController（ActiveRuns 登记），拉取/审查/删除三阶段全部可中断；删除阶段取消 = 停在当前条，已删除的不回滚（如实报告）；关闭弹窗 abortAll；stop() 逆序清理。

## 5. AI 审查契约（ReviewBatcher + AIService.review）

- **批处理**：每批默认 40 条（`review.batchSize`），按字符预算二次约束（默认 12000 字符/批）。发送内容 = `[{index, time, text, hasAttachment}]`，**不发他人消息**，上下文缺失是已知代价（路线图：可选携带前后各1条他人消息作语境，默认关）。
- **提示词**：system = 用户可编辑的审查策略（默认模板给出常见类别：辱骂攻击、隐私泄露、色情、政治敏感、广告拉人、其他自定义），user = 批次 JSON + 输出格式指令。
- **输出契约**：要求模型仅返回 JSON：`{"verdicts":[{"index":0,"violation":true,"category":"privacy","severity":1-3,"reason":"≤50字"}]}`，只需返回 violation=true 的条目。
- **容错解析**：剥离 markdown 代码围栏 → JSON.parse → 失败则正则提取最外层 `{...}` 再试 → 仍失败按"该批解析失败"处理（UI 提供重试该批/跳过该批，绝不因解析失败误标违规）。index 越界/重复丢弃。
- **传输**：非流式（`stream:false`），复用总结插件的 `timeout:null` + 空闲计时器（审查批次小，空闲阈值降为 60s）、429/5xx 重试策略、Key 为空不发 Authorization。
- **成本闸门**：审查前显示估算（条数 × 均长 → token 粗估），超过 `review.confirmAboveTokens`（默认 32000）先停在确认提示。

## 6. DeleteService（新增，安全核心）

```js
// 唯一职责：把已确认的 message id 列表安全地删掉
DeleteService.run(context, ids, hooks) → {deleted[], failed[{id, code, detail}], cancelled}
```

- **通道**：`rest.del({url: "/channels/{channelId}/messages/{messageId}"})`——删除自己的消息不需要 MANAGE_MESSAGES，仅需频道可见。
- **节流**：严格顺序、单并发。默认间隔 `delete.pacingMs = 1200ms` + 0–300ms 随机抖动（可调 800–5000）。批量删除是 Discord 风控敏感行为，宁慢勿快，UI 明示预计耗时。
- **429**：按 `retry_after` 等待 + 500ms 余量重试同一条 ≤3 次；**连续 3 条都触发 429 → 自动暂停**并提示用户（防止风控升级）。
- **失败分类**：404（已被删）计入 skipped 不算失败；403/401 → 中止整个队列（权限态变了）；5xx 重试 2 次后计失败继续下一条。
- **硬上限**：单次运行最多删除 `delete.maxPerRun`（默认 200，上限 1000），超出的让用户分次执行。
- **可暂停/恢复/取消**：删除循环每条之间检查 signal 与 pause 标志。
- **审计日志**：每条删除结果（id、时间戳、内容摘录前 50 字、结果）留在内存运行记录中，[done] 页可导出 JSON；日志文件永不写消息全文。

## 7. 配置模式（config.json schema v1）

```
settings {
  settingsVersion: 1,
  ai: { …与总结插件 v2 完全同构（provider/providers/custom/温度等共享参数）… },
  review: {
    policyPrompt: "",            // 空 = 用内置默认模板
    categories: ["abuse","privacy","nsfw","politics","ad","custom"],  // 勾选启用
    batchSize: 40, batchCharBudget: 12000,
    confirmAboveTokens: 32000,
    includeEdited: true          // 是否审查已编辑消息的当前内容
  },
  fetch: { maxMessages: 2000, pageDelayMs: 300 },
  delete: { pacingMs: 1200, maxPerRun: 200, backupBeforeDelete: "ask" }, // ask|always|never
  ui: { language: "auto", showChatButton: true }
}
```

沿用总结插件机制：默认值深合并、未知字段丢弃、250ms 防抖写入、stop() 强制 flush。`ai` 结构同构意味着两个插件的平台配置可手工互拷。

## 8. 错误分类表

| 错误码 | 触发 | 行为 |
|---|---|---|
| REST_UNAVAILABLE | 适配器两级查找失败 | 错误框指向诊断页 |
| NO_PERMISSION | 预检 false / REST 403（拉取阶段） | 错误框，中止 |
| FETCH_FAILED | 拉取网络错误 | 错误框，可重试 |
| AI_CONFIG_MISSING | BaseURL/Model 为空 | setup 横幅 + 禁用主按钮 |
| AI_HTTP_(status) | 审查端点非 2xx | 该批可重试/跳过 |
| AI_PARSE_FAILED | 判定 JSON 解析失败 | 该批可重试/跳过，绝不误标 |
| DELETE_FORBIDDEN | 删除阶段 403/401 | 中止队列，报告已删数 |
| DELETE_RATELIMIT_STORM | 连续 3 条 429 | 自动暂停，用户手动恢复 |
| CANCELLED | 用户取消 | 静默回退，如实报告部分结果 |

## 9. 测试与发布流程

复用总结插件 `tools/test_harness.js` 模式：桩化 BdApi + 假 REST + 假 AI 端点，离线驱动真实内部服务。新增测试重点：

1. 作者过滤：混合消息中只留 currentUser 且 type∈{0,19}。
2. ReviewBatcher 切批边界（条数上限、字符预算、单条超长截断）。
3. verdict 解析容错：正常 / 带围栏 / 混入废话 / 半截 JSON / index 越界。
4. DeleteService：节流间隔、429 重试、429 风暴自动暂停、404 记 skipped、403 中止、abort 中断点。
5. 配置迁移与深合并。
6. 2000 条规模性能。

发布流程同总结插件：`node --check` → 测试台全绿 → i18n 键完备性检查 → 复制到 BD plugins 热重载 → 回归清单走查 → bump 版本 → git 提交。项目从第一天起建 git 仓库（吸取源目录磁盘故障丢代码的教训），ARCHITECTURE.md 随代码同步更新。

## 10. 里程碑

- **M1 骨架 + 拉取**：分区骨架、适配器（含 UserStore）、设置存储、拉取并过滤自己的消息、弹窗 setup/fetching/results（无 AI，列表全量展示自己的消息，允许手动勾选）。此时已是可用的"手动清理器"。
- **M2 AI 审查**：ReviewBatcher + AIService.review + 判定解析 + results 页违规标注/类别筛选 + 设置面板审查策略页。
- **M3 删除与安全**：DeleteService + 二次确认 + 备份导出 + 删除进度/暂停/报告 + 审计导出。
- **M4 打磨**：i18n 补全、诊断页、测试台补齐全绿、回归清单、README/ARCHITECTURE 文档。

每个里程碑结束都是一个可热重载验证的完整插件。

## 11. 风险清单

| 风险 | 缓解 |
|---|---|
| 批量删除触发 Discord 风控 | 严格单并发 + 1200ms 起步节流 + 抖动 + 429 风暴自动暂停 + 单次硬上限 |
| AI 误判导致误删 | 默认人工勾选确认，永不静默删除；解析失败不标违规；备份导出 |
| 长历史拉取慢（DM 数年记录） | maxMessages 上限 + 截断提示 + 路线图接搜索 API |
| Discord 客户端更新破坏内部触点 | 全部收敛在 DiscordAdapter，沿用总结插件的修复手册模式 |
| 隐私：消息内容外发 | 仅发给用户自配端点；支持本地 Ollama/LM Studio；日志不落消息内容 |

## 12. 开放决策（当前按默认值执行，可改）

1. 插件名暂定 `DiscordAIMessageCleaner`（`.plugin.js` 同名）。
2. v1 不做"全自动删除"模式（审查后跳过人工勾选直接删）——风险过高，如确有需要在 M4 后作为显式开关加入，且仍保留二次确认。
3. DM 群聊里按钮与右键菜单均启用；服务器频道沿用总结插件的注入点。
