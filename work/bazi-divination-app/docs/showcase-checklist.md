# 作品展示验收清单

这份清单用于每次上线、发给朋友体验、或放进作品集前快速确认质量。

## 本地质量

- `npm run lint` 通过。
- `npm run build` 通过，并生成 `out` 静态目录。
- 首页首屏显示“八字排盘作品”，没有测试占位、乱码或旧平台文案。
- 375px 手机宽度下没有横向滚动，顶部导航和日期/地点选择器不溢出。

## 核心流程

- 输入默认资料后可以生成完整四柱。
- 选择“未知”出生信息时，页面显示信息不足提示，不崩溃。
- 登录、注册、退出登录文案清楚。
- 登录后可以保存命盘、读取我的记录、从记录进入排盘、删除记录。
- 至少两条记录时可以进入合盘分析。
- 单盘和合盘 AI 解读可以生成、显示剩余额度，并保存解读。

## CloudBase 部署

- 已创建集合：`bazi_users`、`bazi_sessions`、`bazi_profiles`、`bazi_ai_usage`、`bazi_ai_readings`。
- 已部署云函数：`baziAuth`、`baziRecords`、`baziAi`。
- Webify 配置了 `NEXT_PUBLIC_CLOUDBASE_ENV_ID`、`NEXT_PUBLIC_CLOUDBASE_REGION`、`NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY`。
- `baziAi` 云函数配置了 `AI_API_KEY`，以及需要时配置 `AI_BASE_URL`、`AI_MODEL`。
- 数据库规则已按 `cloudbase/database.rules.json` 禁止前端直接读写。

## 展示前最后一眼

- 用一个新账号完整走一遍注册、排盘、保存、AI 解盘、合盘。
- 确认错误提示是中文可读文案，不暴露密钥、堆栈或内部调试信息。
- 确认 README 和部署文档与当前 CloudBase 方案一致。
