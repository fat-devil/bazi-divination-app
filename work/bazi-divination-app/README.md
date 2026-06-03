# 八字排盘应用

这是一个基于 Next.js 和 Supabase 的八字排盘应用。

当前功能：

- 单人八字排盘
- 邮箱密码登录
- 云端命盘记录
- 从云端记录进入排盘
- 从云端记录选择两张命盘做合盘分析

部署说明见 [docs/deployment.md](docs/deployment.md)。

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. 开发阶段建议固定使用 `localhost:3000`，不要在 `localhost` 和 `127.0.0.1` 之间来回切换，因为浏览器会把它们当成两个不同站点，登录态不会互通。

Create `.env.local` from `.env.local.example` before using Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Build

```bash
npm run lint
npm run build
```

## Supabase

Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor before using cloud records.

## Deploy on Vercel

See [docs/deployment.md](docs/deployment.md).
