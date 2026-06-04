"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getAuthErrorText } from "@/lib/auth-errors";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function AuthPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  function validateForm() {
    if (!supabase) {
      setStatus("请先配置 Supabase 环境变量。");
      return false;
    }

    if (!email.trim()) {
      setStatus("请先输入邮箱。");
      return false;
    }

    if (password.length < 6) {
      setStatus("密码至少需要 6 位。");
      return false;
    }

    return true;
  }

  async function handleSignIn() {
    if (!validateForm() || !supabase) {
      return;
    }

    setIsSubmitting(true);
    setStatus("正在登录...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setStatus(`登录失败：${getAuthErrorText(error.message)}`);
        return;
      }

      setStatus("登录成功。");
    } catch (error) {
      setStatus(`登录失败：${getAuthErrorText(error instanceof Error ? error.message : "网络请求失败")}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (!validateForm() || !supabase) {
      return;
    }

    setIsSubmitting(true);
    setStatus("正在创建账号...");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setStatus(`注册失败：${getAuthErrorText(error.message)}`);
        return;
      }

      if (!data.session) {
        setStatus("账号已创建。若 Supabase 开启了邮箱确认，请先到后台关闭 Confirm email，或打开确认邮件。");
        return;
      }

      setStatus("注册成功，已登录。");
    } catch (error) {
      setStatus(`注册失败：${getAuthErrorText(error instanceof Error ? error.message : "网络请求失败")}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setStatus("已退出登录。");
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-stone-950">
      <nav className="mx-auto grid w-full max-w-5xl grid-cols-4 gap-2 px-5 pt-5 md:px-8">
        <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700">
          排盘输入
        </Link>
        <Link href="/#records" className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700">
          我的记录
        </Link>
        <Link href="/compatibility" className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700">
          合盘分析
        </Link>
        <Link href="/auth" className="inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-2 text-sm font-semibold text-white transition hover:bg-rose-800">
          {user ? "账户" : "登录"}
        </Link>
      </nav>

      <section className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
        <header className="mb-6">
          <p className="text-sm font-medium text-rose-700">账户登录</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">账号密码登录</h1>
        </header>

        <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
          {!isSupabaseConfigured ? (
            <div className="rounded-md border border-dashed border-stone-300 p-5 text-sm leading-6 text-stone-600">
              还没有配置 Supabase。请根据 `.env.local.example` 填写 `NEXT_PUBLIC_SUPABASE_URL` 和
              `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
            </div>
          ) : user ? (
            <div className="grid gap-4">
              <div className="rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                当前已登录：<span className="font-semibold text-stone-950">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
              >
                退出登录
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                邮箱
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                密码
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-stone-950"
                />
                显示密码
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isSubmitting}
                  className="h-11 rounded-md bg-stone-950 px-4 text-base font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {isSubmitting ? "处理中..." : "登录"}
                </button>
                <button
                  type="button"
                  onClick={handleSignUp}
                  disabled={isSubmitting}
                  className="h-11 rounded-md border border-stone-300 bg-white px-4 text-base font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                >
                  注册账号
                </button>
              </div>

              <p className="text-sm leading-6 text-stone-600">
                当前使用 Supabase 邮箱密码登录，不再发送魔法链接邮件。
              </p>
            </div>
          )}
          {status && <p className="mt-4 text-sm leading-6 text-rose-700">{status}</p>}
        </section>
      </section>
    </main>
  );
}
