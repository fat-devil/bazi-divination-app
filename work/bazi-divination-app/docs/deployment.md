# 部署说明

这个项目是 Next.js 应用。本地开发时使用 `npm run dev`，只能通过本机地址在当前电脑访问。建议统一使用 `http://localhost:3000`。要做成真实网站，需要部署到 Vercel、Netlify、服务器等线上平台。

当前推荐先用 Vercel，因为它对 Next.js 支持最直接。

## 1. 本地开发和真实网站的区别

本地开发：

```bash
npm run dev
```

特点：

- 只在当前电脑运行
- 网址通常是 `http://localhost:3000`
- 关闭终端或电脑后，网站就不能访问
- 适合开发、调试、改代码

注意：`http://localhost:3000` 和 `http://127.0.0.1:3000` 在浏览器里是两个不同的站点。Supabase 登录态、浏览器缓存、localStorage 不会互通。比如你在 `localhost` 登录后，打开 `127.0.0.1` 会被视为未登录，依赖登录的按钮会提示先登录。开发阶段建议只固定使用一个地址，优先使用 `localhost:3000`。

线上部署：

- 代码上传到托管平台
- 平台负责构建和运行
- 生成公网网址，例如 `https://your-app.vercel.app`
- 其他设备也可以访问
- 不依赖你的电脑一直开着

## 2. 上线前检查

本地先确认可以构建：

```bash
npm run lint
npm run build
```

如果这两步通过，说明代码可以进入部署流程。

## 3. Vercel 部署步骤

1. 把项目上传到 GitHub。
2. 登录 Vercel。
3. 选择 `Add New Project`。
4. 导入这个 GitHub 仓库。
5. Framework Preset 选择 `Next.js`，通常 Vercel 会自动识别。
6. 添加环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

7. 点击 Deploy。

部署完成后，Vercel 会给一个公网地址，例如：

```text
https://your-project.vercel.app
```

## 4. Supabase 生产配置

确认 Supabase 已经运行过：

```sql
supabase/schema.sql
```

也就是已经创建：

- `public.bazi_profiles`
- RLS policy
- `authenticated` 表权限

如果之后要使用邮箱确认、重置密码、邮箱链接等功能，需要在 Supabase 后台配置：

Authentication -> URL Configuration

Site URL 填线上地址，例如：

```text
https://your-project.vercel.app
```

Redirect URLs 可加入：

```text
https://your-project.vercel.app/**
```

当前账号密码登录不依赖魔法链接，但建议先配置好，后续做重置密码会用到。

## 5. 环境变量注意事项

`.env.local` 只用于本地，不会自动带到 Vercel。

部署时必须在 Vercel Project Settings -> Environment Variables 里手动添加：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

不要把 `.env.local` 提交到 GitHub。

## 6. 当前线上数据流

当前版本的数据逻辑：

- 登录：Supabase Auth 邮箱密码登录
- 排盘：只生成结果，不自动保存
- 保存：点击“保存到云端”后写入 `bazi_profiles`
- 我的记录：从 Supabase 云端读取
- 合盘：从 Supabase 云端记录读取两张命盘

这套逻辑适合继续扩展 AI 解盘和用户私有数据。
