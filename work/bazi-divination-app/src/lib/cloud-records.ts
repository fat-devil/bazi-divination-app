import type { BaziResult } from "@/lib/bazi";
import { getAuthToken } from "@/lib/auth-client";
import { callCloudBaseFunction, isCloudBaseConfigured } from "@/lib/cloudbase";

export type GenderValue = "female" | "male" | "private";
export type TimeModeValue = "standard" | "trueSolar";

export type BirthForm = {
  name: string;
  gender: GenderValue;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  province: string;
  city: string;
  county: string;
  timeMode: TimeModeValue;
  note: string;
};

export type BirthRecord = {
  id: string;
  createdAt: string;
  form: BirthForm;
  result: BaziResult;
};

export type CloudBaziRecord = {
  id: string;
  _id?: string;
  user_id?: string;
  name: string;
  gender: GenderValue;
  birth_date: string;
  birth_time: string;
  birth_place: string;
  province: string | null;
  city: string | null;
  county: string | null;
  longitude: number | null;
  use_true_solar_time: boolean;
  profile_fingerprint?: string | null;
  pillars_result: BaziResult["pillars"];
  bazi_result: BaziResult;
  ai_reading_content?: string | null;
  ai_reading_updated_at?: string | null;
  created_at: string;
};

export type AiReadingTarget = {
  scope: "single" | "compatibility";
  profileId?: string;
  leftProfileId?: string;
  rightProfileId?: string;
};

export type CloudAiReading = {
  id: string;
  _id?: string;
  user_id?: string;
  target_key: string;
  scope: AiReadingTarget["scope"];
  profile_id?: string;
  left_profile_id?: string;
  right_profile_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type CloudRecordsResult = {
  ok?: boolean;
  record?: CloudBaziRecord;
  records?: CloudBaziRecord[];
  reading?: CloudAiReading | null;
  saved?: boolean;
  updated?: boolean;
  error?: string;
};

export function getGenderText(value: string) {
  const labels: Record<string, string> = {
    female: "女",
    male: "男",
    private: "未知",
  };

  return labels[value] || value;
}

export function getRecordSummary(form: BirthForm) {
  const place = [form.province, form.city, form.county].filter(Boolean).join(" ");

  return {
    date: `${form.year}-${form.month}-${form.day}`,
    time: `${form.hour}:${form.minute}`,
    place: place || "未知",
    genderText: getGenderText(form.gender),
    timeModeText: form.timeMode === "trueSolar" ? "真太阳时" : "北京时间",
  };
}

export function getRecordFingerprint(form: BirthForm) {
  return [
    form.gender,
    form.year,
    form.month,
    form.day,
    form.hour,
    form.minute,
    form.province,
    form.city,
    form.county,
    form.timeMode,
  ].join("|");
}

export function getBirthDate(form: BirthForm) {
  return `${form.year}-${form.month}-${form.day}`;
}

export function getBirthTime(form: BirthForm) {
  return `${form.hour}:${form.minute}:00`;
}

export function toLocalRecord(record: CloudBaziRecord): BirthRecord {
  const [year, month, day] = record.birth_date.split("-");
  const [hour = "00", minute = "00"] = record.birth_time.split(":");

  return {
    id: record.id || record._id || "",
    createdAt: record.created_at,
    form: {
      name: record.name,
      gender: record.gender,
      year,
      month,
      day,
      hour,
      minute,
      province: record.province || "",
      city: record.city || "",
      county: record.county || "",
      timeMode: record.use_true_solar_time ? "trueSolar" : "standard",
      note: "",
    },
    result: record.bazi_result,
  };
}

export function getCloudErrorText(message: string) {
  if (message.includes("unauthenticated")) {
    return "CloudBase 拒绝了前端调用云函数。请检查 Webify 环境变量 NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY 是否配置后重新部署，以及云函数权限是否允许前端调用。";
  }

  if (message.includes("duplicate key") || message.includes("已保存过")) {
    return "这条命盘已经保存过了，不需要重复保存。";
  }

  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("Access denied")) {
    return "无法连接 CloudBase。请检查环境 ID、Web 安全域名、匿名访问令牌和网络。";
  }

  if (
    message.includes("bazi_profiles") ||
    message.includes("bazi_users") ||
    message.includes("bazi_sessions") ||
    message.includes("collection") ||
    message.includes("not exist")
  ) {
    return "CloudBase 集合还没有创建。请创建 bazi_users、bazi_sessions、bazi_profiles 三个集合。";
  }

  if (message.includes("请先登录") || message.includes("登录已过期")) {
    return "请先登录，再使用云端记录。";
  }

  return message;
}

export function getCloudStatusText(action: string, message: string) {
  const text = getCloudErrorText(message);
  return `${action}失败：${text}${text === message ? "" : `（原始错误：${message}）`}`;
}

export function getCloudSuccessText(count: number) {
  return count > 0 ? `已读取 ${count} 条云端记录。` : "云端记录已连接，当前还没有保存过命盘。";
}

function getLoginTokenResult() {
  const token = getAuthToken();

  if (!token) {
    return { token: "", error: { message: "请先登录。" } };
  }

  return { token, error: null };
}

export async function fetchCloudRecords() {
  if (!isCloudBaseConfigured()) {
    return { data: [], error: { message: "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。" } };
  }

  const { token, error } = getLoginTokenResult();

  if (error) {
    return { data: [], error };
  }

  try {
    const result = await callCloudBaseFunction<CloudRecordsResult>("baziRecords", {
      action: "list",
      token,
    });

    if (!result.ok) {
      return { data: [], error: { message: result.error || "读取云端记录失败。" } };
    }

    return { data: result.records || [], error: null };
  } catch (cloudError) {
    return { data: [], error: { message: cloudError instanceof Error ? cloudError.message : String(cloudError) } };
  }
}

export async function deleteCloudRecord(recordId: string) {
  if (!isCloudBaseConfigured()) {
    return { error: { message: "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。" } };
  }

  const { token, error } = getLoginTokenResult();

  if (error) {
    return { data: null, error };
  }

  try {
    const result = await callCloudBaseFunction<CloudRecordsResult>("baziRecords", {
      action: "delete",
      token,
      recordId,
    });

    if (!result.ok) {
      return { error: { message: result.error || "删除云端记录失败。" } };
    }

    return { error: null };
  } catch (cloudError) {
    return { error: { message: cloudError instanceof Error ? cloudError.message : String(cloudError) } };
  }
}

export async function insertCloudRecord(values: {
  form: BirthForm;
  result: BaziResult;
  longitude: number | null;
}) {
  if (!isCloudBaseConfigured()) {
    return { error: { message: "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。" } };
  }

  const { token, error } = getLoginTokenResult();

  if (error) {
    return { error };
  }

  const summary = getRecordSummary(values.form);

  try {
    const result = await callCloudBaseFunction<CloudRecordsResult>("baziRecords", {
      action: "create",
      token,
      record: {
        name: values.form.name,
        gender: values.form.gender,
        birth_date: getBirthDate(values.form),
        birth_time: getBirthTime(values.form),
        birth_place: summary.place,
        province: values.form.province,
        city: values.form.city,
        county: values.form.county,
        longitude: values.longitude,
        use_true_solar_time: values.form.timeMode === "trueSolar",
        profile_fingerprint: getRecordFingerprint(values.form),
        pillars_result: values.result.pillars,
        bazi_result: values.result,
        created_at: new Date().toISOString(),
      },
    });

    if (!result.ok) {
      return { error: { message: result.error || "云端保存失败。" } };
    }

    return { data: result.record || null, error: null };
  } catch (cloudError) {
    return { data: null, error: { message: cloudError instanceof Error ? cloudError.message : String(cloudError) } };
  }
}

export async function fetchAiReading(target: AiReadingTarget) {
  if (!isCloudBaseConfigured()) {
    return { data: null, error: { message: "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。" } };
  }

  const { token, error } = getLoginTokenResult();

  if (error) {
    return { data: null, error };
  }

  try {
    const result = await callCloudBaseFunction<CloudRecordsResult>("baziRecords", {
      action: "getAiReading",
      token,
      target,
    });

    if (!result.ok) {
      return { data: null, error: { message: result.error || "读取 AI 解盘失败。" } };
    }

    return { data: result.reading || null, error: null };
  } catch (cloudError) {
    return { data: null, error: { message: cloudError instanceof Error ? cloudError.message : String(cloudError) } };
  }
}

export async function upsertAiReading(values: {
  target: AiReadingTarget;
  content: string;
}) {
  if (!isCloudBaseConfigured()) {
    return { data: null, error: { message: "请先配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID。" } };
  }

  const { token, error } = getLoginTokenResult();

  if (error) {
    return { data: null, error };
  }

  try {
    const result = await callCloudBaseFunction<CloudRecordsResult>("baziRecords", {
      action: "upsertAiReading",
      token,
      target: values.target,
      content: values.content,
    });

    if (!result.ok) {
      return { data: null, error: { message: result.error || "保存 AI 解盘失败。" } };
    }

    return {
      data: {
        reading: result.reading || null,
        saved: Boolean(result.saved),
        updated: Boolean(result.updated),
      },
      error: null,
    };
  } catch (cloudError) {
    return { data: null, error: { message: cloudError instanceof Error ? cloudError.message : String(cloudError) } };
  }
}
