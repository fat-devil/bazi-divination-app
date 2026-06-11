export function getAuthErrorText(message: string) {
  if (message.includes("EXCEED_AUTHORITY")) {
    return "CloudBase 权限不足。请重新上传新版 baziAuth / baziRecords 云函数，并确认这两个云函数允许前端调用。";
  }

  if (message.includes("unauthenticated")) {
    return "CloudBase 拒绝了前端调用云函数。请检查 Webify 环境变量 NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY 是否配置后重新部署，以及云函数权限是否允许前端调用。";
  }

  if (message.includes("账号或密码不正确") || message.includes("Invalid login credentials") || message.includes("USER_PASSWORD_NOT_MATCH")) {
    return "账号或密码不正确。";
  }

  if (message.includes("already") || message.includes("USER_EXIST") || message.includes("已经注册")) {
    return "这个账号已经注册过，请直接登录。";
  }

  if (message.includes("登录已过期")) {
    return "登录已过期，请重新登录。";
  }

  if (message.includes("密码至少") || message.includes("password")) {
    return message;
  }

  if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("网络请求失败")) {
    return "无法连接 CloudBase。请检查环境 ID、匿名访问令牌、Web 安全域名和网络。";
  }

  if (message.includes("baziAuth") || message.includes("baziRecords") || message.includes("function")) {
    return "CloudBase 云函数还没有部署或无法调用，请先部署 baziAuth 和 baziRecords。";
  }

  return message;
}
