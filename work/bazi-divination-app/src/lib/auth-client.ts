import { callCloudBaseFunction, isCloudBaseConfigured } from "@/lib/cloudbase";

const SESSION_KEY = "bazi_custom_session";

export type AppUser = {
  id: string;
  account: string;
};

type AuthSession = {
  token: string;
  user: AppUser;
};

type AuthFunctionResult = {
  ok?: boolean;
  token?: string;
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  error?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    try {
      return getErrorMessage(JSON.parse(error));
    } catch {
      return error;
    }
  }

  if (error && typeof error === "object") {
    const value = error as { code?: string; msg?: string; message?: string; error?: string };
    const message = value.msg || value.message || value.error;

    if (message) {
      return value.code ? `${value.code}: ${message}` : message;
    }

    return JSON.stringify(error);
  }

  return String(error);
}

function toResult(user: AppUser | null, error?: unknown) {
  return {
    data: { user },
    error: error ? { message: getErrorMessage(error) } : null,
  };
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function setStoredSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

function toAppUser(user: AuthFunctionResult["user"]): AppUser | null {
  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    account: user.username || user.email || "账号用户",
  };
}

async function callAuth(action: "register" | "login" | "verify", data: object) {
  return callCloudBaseFunction<AuthFunctionResult>("baziAuth", { action, ...data });
}

export function getAuthToken() {
  return getStoredSession()?.token || "";
}

export async function getCurrentUser() {
  if (!isCloudBaseConfigured()) {
    return toResult(null, "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。");
  }

  const session = getStoredSession();

  if (!session?.token) {
    return toResult(null);
  }

  try {
    const result = await callAuth("verify", { token: session.token });

    if (!result.ok || result.error) {
      clearStoredSession();
      return toResult(null, result.error);
    }

    const user = toAppUser(result.user);

    if (!user) {
      clearStoredSession();
      return toResult(null);
    }

    setStoredSession({ token: session.token, user });
    return toResult(user);
  } catch {
    return toResult(session.user);
  }
}

export async function signInWithPassword(values: { account: string; password: string }) {
  if (!isCloudBaseConfigured()) {
    return toResult(null, "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。");
  }

  try {
    const result = await callAuth("login", {
      username: normalizeUsername(values.account),
      password: values.password,
    });

    if (!result.ok || result.error || !result.token) {
      return toResult(null, result.error || "登录失败。");
    }

    const user = toAppUser(result.user);

    if (!user) {
      return toResult(null, "登录返回的用户信息不完整。");
    }

    setStoredSession({ token: result.token, user });
    return toResult(user);
  } catch (error) {
    return toResult(null, error);
  }
}

export async function signUpWithPassword(values: { account: string; password: string }) {
  if (!isCloudBaseConfigured()) {
    return toResult(null, "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。");
  }

  try {
    const result = await callAuth("register", {
      username: normalizeUsername(values.account),
      password: values.password,
    });

    if (!result.ok || result.error || !result.token) {
      return toResult(null, result.error || "注册失败。");
    }

    const user = toAppUser(result.user);

    if (!user) {
      return toResult(null, "注册返回的用户信息不完整。");
    }

    setStoredSession({ token: result.token, user });
    return toResult(user);
  } catch (error) {
    return toResult(null, error);
  }
}

export async function signOut() {
  clearStoredSession();
  return toResult(null);
}
