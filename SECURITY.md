# Security Policy / 安全策略

## Supported versions / 支持版本

| Version | Status |
|---|---|
| 0.6.7 | Supported / 支持 |
| < 0.6.7 | Unsupported / 停止维护 |

Security fixes are released as a new patch version. Published tags and Release assets remain immutable.

安全修复将递增补丁版本发布；已经发布的标签和 Release 资产保持不变。

## Private reporting / 私密报告

Please use GitHub's **[private vulnerability reporting](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/security/advisories/new)** for security-sensitive reports.

涉及安全的问题请通过 GitHub **[私密漏洞报告](https://github.com/ROOT94-MAX/DiscordAIMessageCleaner/security/advisories/new)** 提交。

Useful details:

- Plugin, BetterDiscord, Discord, and operating-system versions.
- Minimal reproduction steps and the expected/actual behavior.
- Redacted diagnostics and relevant console errors.
- Whether deletion, export, AI requests, or settings persistence is involved.

建议附上：插件、BetterDiscord、Discord 与操作系统版本；最小复现步骤；预期与实际行为；完成脱敏的诊断信息和控制台错误；以及问题是否涉及删除、导出、AI 请求或配置持久化。

## Sensitive data / 敏感信息

Never include API keys, login credentials, authorization headers, private endpoints, unredacted message content, guild/channel/user identifiers, or backup/export files in a public issue. Replace them with placeholders before attaching logs.

公开 Issue 中请勿提交 API Key、登录凭据、Authorization 请求头、私有端点、真实消息正文、服务器/频道/用户标识符以及备份或导出文件；上传日志前请先替换为占位符。

Security-sensitive examples include confirmation bypasses, deletion after dismissal, deletion of unintended messages, credential or message-content exposure, unsafe file writes, code execution, and requests sent to an unexpected endpoint.

典型安全问题包括：绕过确认、关闭弹窗后仍删除、删除非预期消息、凭据或消息内容泄露、不安全文件写入、代码执行，以及请求被发送到非预期端点。

There is currently no bug-bounty program. Reports are handled on a best-effort basis, and confirmed fixes will be documented in the corresponding Release.

本项目目前没有漏洞赏金计划；确认后的修复会记录在对应 Release 中。
