import type { BaziResult } from "@/lib/bazi";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  created_at: string;
};

export function getGenderText(value: string) {
  const labels: Record<string, string> = {
    female: "女",
    male: "男",
    private: "暂不填写",
  };

  return labels[value] || value;
}

export function getRecordSummary(form: BirthForm) {
  return {
    date: `${form.year}-${form.month}-${form.day}`,
    time: `${form.hour}:${form.minute}`,
    place: [form.province, form.city, form.county].filter(Boolean).join(" "),
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
    id: record.id,
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
  if (message.includes("duplicate key") || message.includes("bazi_profiles_user_fingerprint_key")) {
    return "这条命盘已经保存过了，不需要重复保存。";
  }

  if (message.includes("permission denied for schema") || message.includes("permission denied for table")) {
    return "表已经存在，但前端登录用户没有访问权限。请重新运行 supabase/schema.sql，重点是 GRANT 和 RLS policy。";
  }

  if (message.includes("bazi_profiles") || message.includes("relation") || message.includes("schema cache")) {
    return "云端命盘记录表还没有创建。请到 Supabase 的 SQL Editor 运行项目里的 supabase/schema.sql。";
  }

  if (message.includes("row-level security") || message.includes("violates row-level security")) {
    return "云端记录权限规则未通过。请重新运行 supabase/schema.sql 里的 RLS policy。";
  }

  if (message.includes("JWT") || message.includes("permission denied")) {
    return "当前登录会话或数据库权限异常。请重新登录，并确认 bazi_profiles 表已启用正确的 RLS policy。";
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

export async function fetchCloudRecords(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("bazi_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return { data: (data || []) as CloudBaziRecord[], error };
}

export async function deleteCloudRecord(supabase: SupabaseClient, recordId: string) {
  return supabase.from("bazi_profiles").delete().eq("id", recordId);
}

export async function insertCloudRecord(
  supabase: SupabaseClient,
  values: {
    userId: string;
    form: BirthForm;
    result: BaziResult;
    longitude: number;
  },
) {
  const summary = getRecordSummary(values.form);

  return supabase.from("bazi_profiles").insert({
    user_id: values.userId,
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
  });
}
