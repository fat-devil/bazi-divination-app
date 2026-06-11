# CloudBase / Webify 轻便部署说明

当前项目使用：
- 前端：Next.js 静态导出，部署到 Webify / CloudBase 静态托管
- 登录：自建账号密码体系，通过 CloudBase 云函数 `baziAuth`
- 云端记录：CloudBase 数据库，通过云函数 `baziRecords`
- AI 解读：通过 CloudBase 云函数 `baziAi` 调用 OpenAI-compatible 模型接口
- 后端服务器：不需要 ECS
- 独立 MySQL：不需要 RDS

## 1. CloudBase 控制台准备

创建数据库集合：

```text
bazi_users
bazi_sessions
bazi_profiles
bazi_ai_usage
bazi_ai_readings
```

生成匿名访问令牌：

```text
接入指引 -> 前端框架 -> React/Vite -> 生成 accessKey
```

把这个 accessKey 配到前端环境变量里。这个令牌用于让静态网页调用云函数，不等于匿名登录。

## 2. 部署云函数

部署这三个目录：

```text
cloudfunctions/baziAuth
cloudfunctions/baziRecords
cloudfunctions/baziAi
```

云函数都需要安装依赖，函数目录里的 `package.json` 已经声明：

```json
{
  "@cloudbase/node-sdk": "^2.11.0"
}
```

`baziAi` 额外需要在云函数环境变量中配置模型接口：

```env
AI_API_KEY=your-model-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=qwen3.5-plus
```

`AI_BASE_URL` 需要是 OpenAI-compatible API 根地址，不要包含 `/chat/completions`，云函数会自动拼接。

## 3. 环境变量

本地 `.env.local` 和 Webify 构建环境都需要：

```env
NEXT_PUBLIC_CLOUDBASE_ENV_ID=your-cloudbase-env-id
NEXT_PUBLIC_CLOUDBASE_REGION=ap-shanghai
NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY=your-cloudbase-access-key
```

## 4. 数据库权限

客户端不直接读写数据库，建议使用：

```text
cloudbase/database.rules.json
```

含义是：`bazi_users`、`bazi_sessions`、`bazi_profiles`、`bazi_ai_usage`、`bazi_ai_readings` 不允许前端直接读写，只允许云函数用服务端权限访问。

## 5. 构建静态网站

```bash
npm run build
```

输出目录：

```text
out
```

Webify 配置：
- 构建命令：`npm run build`
- 输出目录：`out`
- 环境变量：上面的三个 `NEXT_PUBLIC_CLOUDBASE_*`

## 6. 验收

- 注册账号：输入任意账号名，例如 `1302162670@qq.com`
- 登录账号：用同一个账号和密码登录
- 保存命盘：登录后生成排盘，再保存到云端
- 我的记录：读取、进入排盘、删除云端记录
- 合盘分析：从云端记录选择两张命盘生成分析
- AI 解盘：登录后生成单盘/合盘解读，确认每日次数提示和保存解读功能可用
