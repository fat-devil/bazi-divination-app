# 八字排盘应用

这是一个面向好友体验和国内网络访问的 Next.js 八字排盘应用。前端静态导出后部署到 Webify / CloudBase，账号登录和云端记录通过 CloudBase 云函数与数据库完成。

当前功能：
- 单人八字排盘
- 北京时间 / 真太阳时排盘
- 自建账号密码注册/登录，不使用邮箱验证码
- CloudBase 云端命盘记录
- 从云端记录进入排盘
- 从云端记录选择两张命盘做合盘分析
- 单盘与合盘 AI 解读，模型密钥只保存在云函数环境变量中

部署说明见 [docs/deployment.md](docs/deployment.md)。

## 本地开发

```bash
npm install
npm run dev
```

创建 `.env.local`：

```env
NEXT_PUBLIC_CLOUDBASE_ENV_ID=your-cloudbase-env-id
NEXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai
NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY=your-cloudbase-access-key
```

`NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY` 是 CloudBase 接入指引里生成的匿名访问令牌，用于让静态前端调用云函数。

## CloudBase

需要创建数据库集合：

```text
bazi_users
bazi_sessions
bazi_profiles
bazi_ai_usage
bazi_ai_readings
```

需要部署云函数：

```text
cloudfunctions/baziAuth
cloudfunctions/baziRecords
cloudfunctions/baziAi
```

客户端不直接读写数据库，数据库规则可以按 `cloudbase/database.rules.json` 配成前端不可直接读写，所有访问由云函数完成。

`baziAi` 还需要在云函数环境变量中配置模型接口：

```env
AI_API_KEY=your-model-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=qwen3.5-plus
```

## Build

```bash
npm run lint
npm run build
```
