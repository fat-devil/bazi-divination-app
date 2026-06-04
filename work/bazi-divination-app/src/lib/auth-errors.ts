export function getAuthErrorText(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "邮箱或密码不正确。如果这是刚注册的账号，请确认 Supabase 的 Confirm email 已关闭，或先完成邮箱确认。";
  }

  if (message.includes("Email not confirmed")) {
    return "邮箱还没有确认。请关闭 Supabase 的 Confirm email，或先打开确认邮件。";
  }

  if (message.includes("User already registered")) {
    return "这个邮箱已经注册过，请直接登录；如果忘记密码，可联系管理员重置。";
  }

  if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("网络请求失败")) {
    return "无法连接 Supabase。请检查 Vercel 环境变量：NEXT_PUBLIC_SUPABASE_URL 必须是项目根地址，例如 https://xxxx.supabase.co；NEXT_PUBLIC_SUPABASE_ANON_KEY 必须是 anon/public key。修改后需要重新部署。";
  }

  return message;
}
