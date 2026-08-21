<div align="center">

# DiscordAIMessageCleaner

[简体中文](README.md) | [English](README.en.md)

[![平台](https://img.shields.io/badge/Platform-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.com)
[![加载器](https://img.shields.io/badge/Loader-BetterDiscord-4E5D94?style=flat-square)](https://betterdiscord.app)
[![版本](https://img.shields.io/badge/Version-0.6.8-success?style=flat-square)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner)
[![依赖](https://img.shields.io/badge/Dependency-None-brightgreen?style=flat-square)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner)
[![验证](https://img.shields.io/github/actions/workflow/status/ROOT94-MAX/DiscordAIMessageCleaner/verify.yml?branch=main&style=flat-square&label=verify)](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/actions/workflows/verify.yml)
[![许可证](https://img.shields.io/badge/License-GPL%20v2-blue?style=flat-square)](./LICENSE)

一款 BetterDiscord 插件，用 AI 审查并清理**你自己**在 Discord 里发过的历史消息：按账号搜索、自定义策略审查、备份后确认删除。

**当前版本：v0.6.8** · **运行环境：BetterDiscord（无需第三方库）**

[下载稳定版](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/latest/download/DiscordAIMessageCleaner.plugin.js) · [English](README.en.md) · [架构文档](./ARCHITECTURE.md)

</div>

## 为什么使用它

聊天里发过的违规、隐私、口嗨消息，散落在很多频道，手动一条条翻找删除既慢又容易漏。DiscordAIMessageCleaner 把这件事变成三步：搜出你自己的消息、AI 按你的标准挑出该删的、你确认后安全删除。

- **只碰自己的消息：**按当前登录账号的 ID 搜索，只命中你自己发的；他人消息仅用于只读上下文，永不删除。
- **一次覆盖整个服务器：**范围可切「当前频道 / 整个服务器」，服务器范围一次扫遍所有你可见的频道，不必逐个进。
- **违规标准你说了算：**内置六类模板（辱骂 / 隐私 / 色情 / 政治 / 广告 / 其他），也能保存多套命名策略随时切换。
- **删除安全第一：**先审后删、人工勾选、二次确认、可选 MD / TXT / JSON 导出；删除严格单并发 + 节流 + 限流自动暂停 + 单次上限。永不静默删除。
- **单文件安装：**只依赖 BetterDiscord 自带的 `BdApi`，无第三方库；模块化源码确定性构建为一份可读的插件单文件。

## 核心功能

- **按账号搜索：**服务器范围借用 Discord 客户端自身的搜索接口按 `author_id` 过滤，跨频道直接拿到你自己的消息，而非拉全频道再本地筛。
- **AI 审查：**逐批送任意 OpenAI 兼容模型判定，命中项标注违规类别、严重度与理由并自动勾选；解析失败的批次进重试队列，绝不误标。
- **后台运行：**审查慢时可最小化为悬浮胶囊，继续聊天，完成后点胶囊回到结果。
- **结果整理：**「只看命中」过滤、服务器范围按频道下拉筛选、消息内自定义表情与图片缩略图（点击放大），手动增减勾选。
- **可续扫描：**扫描被取消或达到上限时，可从上次位置继续扫描更早的消息，已勾选与已判定的结果全部保留。
- **安全删除：**二次确认 → 可选 MD / TXT / JSON 导出 → 保存成功后节流删除，进度可暂停 / 取消，结束给出成功 / 跳过 / 失败报告。

## 支持的 AI 服务商

任意 OpenAI 兼容端点均可，各平台独立保存密钥与模型，一键切换：

| Key | 服务商 | 凭证 | 说明 |
| --- | --- | :---: | --- |
| `openai` | OpenAI | API Key | 官方或兼容网关 |
| `deepseek` | DeepSeek | API Key | 默认 `deepseek-chat` |
| `gemini` | Google Gemini | API Key | 官方 OpenAI 兼容端点 |
| `ollama` | Ollama | 无 | 本地模型，内容不出本机 |
| `lmstudio` | LM Studio | 无 | 本地模型，内容不出本机 |
| 自定义 | 任意兼容服务 | Base URL / Model / Key | 自建或第三方网关 |

## 快速安装

### 前置条件

1. 桌面版 Discord 客户端。
2. [BetterDiscord](https://betterdiscord.app/)（≥ 1.13）。

### 安装步骤

1. [从最新稳定版 Release 下载 `DiscordAIMessageCleaner.plugin.js`](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/releases/latest/download/DiscordAIMessageCleaner.plugin.js)。
2. 把文件放进 BetterDiscord 插件目录（Discord → **用户设置** → **BetterDiscord** → **插件** → 「Open Plugins Folder」可直接打开）。
3. 在插件列表启用 **DiscordAIMessageCleaner**。
4. 打开插件设置 → **AI 平台**，选一个平台填入 API Key 与模型（本地 Ollama / LM Studio 无需密钥），点「验证配置」确认连通。

文件编码为 UTF-8 无 BOM；自行编辑保存时勿引入 BOM，否则 BD 无法识别插件头。

## 使用方法

三种入口任选其一打开清理窗口：聊天输入框左侧的扫帚图标、频道 / 私信右键菜单「AI 消息清理」、斜杠命令 `/aiclean`。

一次完整流程：

1. **选范围**：当前频道 / 整个服务器（仅服务器内可选），再选时间段（1 天 / 7 天 / 30 天 / 全部 / 自定义），点「扫描我的消息」。
2. **审查**：点「AI 审查」逐批判定；命中消息标注类别、严重度与理由并自动勾选。慢时可点「后台运行」。
3. **筛选与勾选**：切「只看命中」，服务器范围按频道下拉筛选，手动增减勾选。
4. **删除**：点「删除选中」→ 二次确认（明示不可逆）→ 勾选导出并选择 Markdown / TXT / JSON → 系统保存框保存成功 → 节流删除，结束给出报告。

## 设置项

设置面板分四个标签：

| 标签 | 内容 |
| --- | --- |
| AI 平台 | 预置 5 家 + 任意自定义平台；Base URL / API Key / 模型；获取模型列表、验证配置 |
| 审查策略 | 界面语言、审查策略提示词库（内置模板 + 命名自定义）、每批消息数、审查前确认阈值、AI 空闲超时 |
| 清理行为 | 消息扫描（最大扫描数、是否审查已编辑消息）、删除安全（删除间隔、单次上限、备份模式） |
| 诊断 | 版本、BetterDiscord 版本、各内部触点健康状态、一键复制诊断信息 |

## 工作原理与固有限制

- **搜索是未公开接口：**所有对 Discord 内部的调用都收敛在适配器层。客户端更新导致搜索失效时，当前频道范围自动退回逐页扫描（有提示），整个服务器范围会提示改用当前频道；私信 / 群聊本就走逐页扫描。
- **删除走客户端自身通道：**删除自己的消息不需要管理权限，插件不接触、不存储你的登录 token。
- **AI 只看文本：**发送给模型的是消息文本（自定义表情转 `:name:`、附件转文件名占位符），图片 / 附件内容不上传，既省 token 又更稳。
- **深度分页上限：**Discord 搜索接口最多回溯约 5000 条，超出会截断并提示，可配合时间范围分次处理。
- **批量删除是风控敏感操作：**默认单并发、每条间隔 1200ms + 随机抖动，连续触发限流会自动暂停。不建议把间隔调太低。

## 导出兼容性修复（v0.6.7）

- 修复 v0.6.6 在部分环境中“保存接口没有返回文件路径，却被误报为成功”的问题。
- 保存链现在依次尝试 BetterDiscord 保存对话框、Discord 原生保存对话框和 Downloads 回退；只有目标文件真实存在且 UTF-8 字节数一致时才报告成功。
- 保存对话框使用绝对 Downloads 默认路径及所选格式过滤器；兼容 `saveWithDialog2`、旧 `saveWithDialog` 及多种取消字段。
- 补齐 `sanitizeFilename`，服务器/频道名称含空格或特殊字符时也能正常打开保存框；删除完成页不再重复提供“导出删除记录”。
- 保存实现对齐总结插件的运行时约束，只使用 BetterDiscord 中可用的 `fs`、`path` 与 `USERPROFILE/HOME`；移除会被插件加载器误解析成相对路径的 `os` / `buffer` 引用。
- 失败方向保持安全：请求了删除前备份时，取消或所有保存方式均失败都会放弃删除。

## 设置说明图标（v0.6.8）

- 字段级辅助说明收进统一的圆形信息图标；图标紧跟标题文字末尾，保持 5px 间距、视觉居中并轻微上移 1px，不进入整行右侧的输入控件区域。
- 鼠标悬停与键盘聚焦均显示 Discord 风格 Tooltip；组件缺失时回退到原生 `title` 提示。
- 策略内容、并发数、确认阈值、已编辑消息、删除间隔和删除上限使用该模式；诊断等组级说明继续直接显示。

## 安全与隐私

- 删除**不可逆**。默认「先审后删 + 人工勾选 + 二次确认」，绝不静默删除；建议首次把备份模式设为「每次询问」，先导出 MD / TXT / JSON 再删。
- API Key 以明文存于本地插件配置文件（BD 存储机制限制），勿在共享电脑上填写重要密钥；本地服务可留空。
- 消息内容只发送到**你自己配置的 AI 端点**，无任何遥测或第三方上报；用本地模型可做到内容完全不出本机。
- 日志只记录进度与结果，不写入消息正文与密钥。
- 自动化批量删除有触发 Discord 风控的固有风险，请自行控制频率、量力而行。
- 安全问题请按 [SECURITY.md](./SECURITY.md) 私密报告；公开 Issue 中不要粘贴 API Key、登录凭据或真实消息正文。

## 文件结构

```
DiscordAIMessageCleaner.plugin.js   构建产物：安装用的插件单文件
src/                                模块化源码（header / 24 个分区模块 / footer）
src/sections/                       01-constants … 22-plugin-class，按依赖顺序编号
tools/build.js                      确定性构建：把 src/ 拼装为插件单文件（零依赖、零转换）
tools/verify.js                     校验源码与产物逐字节一致、语法、版本号一致
tools/smoke_test.js                 离线冒烟测试（生命周期 + 设置页渲染 + 迁移）
tools/test_harness.js               离线功能测试（删除队列 / 搜索 / 批处理 / 判定解析等）
ARCHITECTURE.md                     架构文档（模块地图、数据流、触点清单，随代码同步更新）
REGRESSION.md                       发版前的人工回归清单（含删除链路的安全走查流程）
SECURITY.md                         支持版本、漏洞私密报告方式与脱敏要求
PLAN.md                             最初的实现计划（历史文档）
```

## 开发

要求 Node.js 18+，无任何 npm 依赖：

```bash
node tools/build.js        # 由 src/ 生成插件单文件
node tools/verify.js       # 源码/产物一致性、语法、版本号
node tools/smoke_test.js   # 冒烟测试
node tools/test_harness.js # 功能测试
```

修改代码请编辑 `src/sections/` 下的分区模块，然后重新构建；**请勿直接编辑生成的插件文件**（`verify` 会发现并拒绝）。分区间依赖严格单向：后区可用前区，反向禁止；只有 `07-discord-adapter` 允许触碰 Discord 内部模块。CI（GitHub Actions）在每次推送时自动执行以上全部校验。

`main` 受 GitHub Ruleset 保护。请从非 `main` 分支发起 Pull Request，等待 `verify` 通过后再合并；直接更新、强推和删除 `main` 均被规则拦截。

## 致谢

- 架构与实现参照同作者的频道总结插件 DiscordChannelExportSummary（同样是原生 BdApi、单文件、无库依赖）。

## 开源协议

本项目使用 [GNU General Public License v2.0](./LICENSE)。再分发和衍生作品必须保持 GPL v2.0 兼容。
