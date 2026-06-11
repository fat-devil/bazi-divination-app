const envId = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID?.trim();
const region = process.env.NEXT_PUBLIC_CLOUDBASE_REGION?.trim();
const accessKey = process.env.NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY?.trim();

type CloudBaseApp = {
  auth: (options?: { persistence: "local" | "session" | "none" }) => unknown;
  callFunction: <T = unknown>(options: { name: string; data?: object; parse?: boolean }) => Promise<{ result?: T }>;
};

let app: CloudBaseApp | null = null;

export function isCloudBaseConfigured() {
  return Boolean(envId);
}

export async function getCloudBaseApp() {
  if (!envId) {
    throw new Error("请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。");
  }

  if (typeof window === "undefined") {
    throw new Error("CloudBase SDK 只能在浏览器中初始化。");
  }

  if (!app) {
    const cloudbase = (await import("@cloudbase/js-sdk")).default;
    const initializedApp = cloudbase.init({
      env: envId,
      ...(region ? { region } : {}),
      ...(accessKey ? { accessKey } : {}),
      timeout: 15000,
    }) as unknown as CloudBaseApp;

    initializedApp.auth({
      persistence: "local",
    });

    app = initializedApp;
  }

  return app;
}

export async function callCloudBaseFunction<T>(name: string, data?: object) {
  const cloudbaseApp = await getCloudBaseApp();
  const response = await cloudbaseApp.callFunction<T>({ name, data, parse: true });

  return response.result as T;
}
