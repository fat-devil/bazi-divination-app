"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import hmtData from "china-division/dist/HK-MO-TW.json";
import pcaData from "china-division/dist/pca.json";
import { calculateBazi, type BaziPillar, type BaziResult, type ElementName } from "@/lib/bazi";
import { getAuthErrorText } from "@/lib/auth-errors";
import {
  getCloudStatusText,
  getCloudSuccessText,
  getGenderText,
  getRecordFingerprint,
  getRecordSummary,
  deleteCloudRecord,
  fetchCloudRecords,
  insertCloudRecord,
  toLocalRecord,
  type BirthForm,
  type BirthRecord,
  type CloudBaziRecord,
  type GenderValue,
} from "@/lib/cloud-records";
import { getApproxLongitude } from "@/lib/location";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ProvinceMap = Record<string, Record<string, string[]>>;
type ViewName = "input" | "report" | "records" | "auth" | "compatibility" | "compatibilityReport";

type CompatibilityRelation = {
  type: string;
  pair: string;
  positions: string;
  note: string;
};

type CompatibilityAnalysis = {
  dayMasterRelation: string;
  elementRows: Array<{
    element: ElementName;
    left: number;
    right: number;
  }>;
  crossRelations: CompatibilityRelation[];
  spousePalaceRelations: CompatibilityRelation[];
};

type WheelPickerProps = {
  label: string;
  name: keyof BirthForm;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

const chinaAreas = { ...(pcaData as ProvinceMap), ...(hmtData as ProvinceMap) };
const provinceOptions = Object.keys(chinaAreas);
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 1899 }, (_, index) =>
  String(currentYear - index),
);
const monthOptions = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const dayOptions = Array.from({ length: 31 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const hourOptions = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const minuteOptions = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const elementOptions: ElementName[] = ["木", "火", "土", "金", "水"];
const elementGenerates: Record<ElementName, ElementName> = {
  木: "火",
  火: "土",
  土: "金",
  金: "水",
  水: "木",
};
const elementControls: Record<ElementName, ElementName> = {
  木: "土",
  土: "水",
  水: "火",
  火: "金",
  金: "木",
};
const stemCombines: Record<string, string> = {
  甲己: "甲己合土",
  乙庚: "乙庚合金",
  丙辛: "丙辛合水",
  丁壬: "丁壬合木",
  戊癸: "戊癸合火",
};
const branchCombines: Record<string, string> = {
  子丑: "子丑合土",
  寅亥: "寅亥合木",
  卯戌: "卯戌合火",
  辰酉: "辰酉合金",
  巳申: "巳申合水",
  午未: "午未合土",
};
const branchClashes = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
const branchHarms = ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"];
const branchBreaks = ["子酉", "卯午", "辰丑", "戌未", "寅亥", "巳申"];
const branchPunishes = ["子卯", "寅巳", "巳申", "申寅", "丑戌", "戌未", "未丑", "辰辰", "午午", "酉酉", "亥亥"];

const initialProvince = provinceOptions[0] || "";
const initialCity = Object.keys(chinaAreas[initialProvince] || {})[0] || "";
const initialCounty = chinaAreas[initialProvince]?.[initialCity]?.[0] || "";
const initialForm: BirthForm = {
  name: "",
  gender: "female",
  year: "2000",
  month: "01",
  day: "01",
  hour: "08",
  minute: "00",
  province: initialProvince,
  city: initialCity,
  county: initialCounty,
  timeMode: "standard",
  note: "",
};

const initialBazi = getBaziResult(initialForm);

function getBaziResult(form: BirthForm) {
  return calculateBazi({
    year: form.year,
    month: form.month,
    day: form.day,
    hour: form.hour,
    minute: form.minute,
    gender: form.gender,
    useTrueSolarTime: form.timeMode === "trueSolar",
    longitude: getApproxLongitude(form.province),
  });
}

function normalizeForm(form: BirthForm): BirthForm {
  return {
    ...form,
    name: form.name.trim() || "体验用户",
    note: form.note.trim(),
  };
}

function formatSavedTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPairKey(left: string, right: string, pairs: string[]) {
  return pairs.find((pair) => pair === `${left}${right}` || pair === `${right}${left}`);
}

function countElements(result: BaziResult) {
  const counts = Object.fromEntries(elementOptions.map((element) => [element, 0])) as Record<ElementName, number>;

  result.pillars.forEach((pillar) => {
    pillar.wuXing.split("").forEach((element) => {
      if (elementOptions.includes(element as ElementName)) {
        counts[element as ElementName] += 1;
      }
    });
  });

  return counts;
}

function describeDayMasterRelation(left: BirthRecord, right: BirthRecord) {
  const leftElement = left.result.dayMasterElement;
  const rightElement = right.result.dayMasterElement;

  if (leftElement === "未知" || rightElement === "未知") {
    return "日主五行存在未知项，暂不判断生克关系。";
  }

  if (leftElement === rightElement) {
    return `${left.form.name}日主为${left.result.dayMaster}${leftElement}，${right.form.name}日主为${right.result.dayMaster}${rightElement}，双方日主五行相同。`;
  }

  if (elementGenerates[leftElement] === rightElement) {
    return `${left.form.name}日主${leftElement}生${right.form.name}日主${rightElement}。`;
  }

  if (elementGenerates[rightElement] === leftElement) {
    return `${right.form.name}日主${rightElement}生${left.form.name}日主${leftElement}。`;
  }

  if (elementControls[leftElement] === rightElement) {
    return `${left.form.name}日主${leftElement}克${right.form.name}日主${rightElement}。`;
  }

  if (elementControls[rightElement] === leftElement) {
    return `${right.form.name}日主${rightElement}克${left.form.name}日主${leftElement}。`;
  }

  return "双方日主五行未形成直接生克关系。";
}

function getCrossRelation(leftPillar: BaziPillar, rightPillar: BaziPillar, leftName: string, rightName: string) {
  const relations: CompatibilityRelation[] = [];
  const positions = `${leftName}${leftPillar.label}-${rightName}${rightPillar.label}`;
  const stemPair = getPairKey(leftPillar.gan, rightPillar.gan, Object.keys(stemCombines));
  const combinePair = getPairKey(leftPillar.zhi, rightPillar.zhi, Object.keys(branchCombines));
  const clashPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchClashes);
  const harmPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchHarms);
  const breakPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchBreaks);
  const punishPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchPunishes);

  if (stemPair) {
    relations.push({
      type: "天干五合",
      pair: `${leftPillar.gan}${rightPillar.gan}`,
      positions,
      note: stemCombines[stemPair],
    });
  }

  if (combinePair) {
    relations.push({
      type: "地支六合",
      pair: `${leftPillar.zhi}${rightPillar.zhi}`,
      positions,
      note: branchCombines[combinePair],
    });
  }

  if (clashPair) {
    relations.push({
      type: "地支六冲",
      pair: `${leftPillar.zhi}${rightPillar.zhi}`,
      positions,
      note: `${leftPillar.zhi}${rightPillar.zhi}冲`,
    });
  }

  if (harmPair) {
    relations.push({
      type: "地支相害",
      pair: `${leftPillar.zhi}${rightPillar.zhi}`,
      positions,
      note: `${leftPillar.zhi}${rightPillar.zhi}害`,
    });
  }

  if (breakPair) {
    relations.push({
      type: "地支相破",
      pair: `${leftPillar.zhi}${rightPillar.zhi}`,
      positions,
      note: `${leftPillar.zhi}${rightPillar.zhi}破`,
    });
  }

  if (punishPair) {
    relations.push({
      type: "地支相刑",
      pair: `${leftPillar.zhi}${rightPillar.zhi}`,
      positions,
      note: `${leftPillar.zhi}${rightPillar.zhi}刑`,
    });
  }

  return relations;
}

function analyzeCompatibility(left: BirthRecord, right: BirthRecord): CompatibilityAnalysis {
  const leftCounts = countElements(left.result);
  const rightCounts = countElements(right.result);
  const crossRelations = left.result.pillars.flatMap((leftPillar) =>
    right.result.pillars.flatMap((rightPillar) =>
      getCrossRelation(leftPillar, rightPillar, left.form.name, right.form.name),
    ),
  );
  const leftDayPillar = left.result.pillars.find((pillar) => pillar.label === "日柱");
  const rightDayPillar = right.result.pillars.find((pillar) => pillar.label === "日柱");

  return {
    dayMasterRelation: describeDayMasterRelation(left, right),
    elementRows: elementOptions.map((element) => ({
      element,
      left: leftCounts[element],
      right: rightCounts[element],
    })),
    crossRelations,
    spousePalaceRelations:
      leftDayPillar && rightDayPillar
        ? getCrossRelation(leftDayPillar, rightDayPillar, left.form.name, right.form.name).filter((relation) =>
            relation.type.startsWith("地支"),
          )
        : [],
  };
}

function WheelPicker({ label, name, options, value, onChange }: WheelPickerProps) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-stone-500">{label}</p>
      <select
        name={name}
        size={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-40 w-full overflow-y-auto rounded-md border border-stone-200 bg-stone-50 p-2 text-center text-sm font-medium text-stone-700 outline-none transition focus:border-rose-500 [scrollbar-width:thin]"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
            className="rounded-md px-2 py-3 text-center checked:bg-stone-950 checked:text-white"
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function RelationCards({ emptyText, relations }: { emptyText: string; relations: CompatibilityRelation[] }) {
  if (!relations.length) {
    return <p className="mt-3 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-600">{emptyText}</p>;
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {relations.map((relation) => (
        <article key={`${relation.type}-${relation.positions}-${relation.pair}`} className="rounded-md border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-rose-700">{relation.type}</span>
            <span className="text-sm font-semibold text-stone-950">{relation.pair}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-700">{relation.positions}</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-stone-950">{relation.note}</p>
        </article>
      ))}
    </div>
  );
}

function navItemClass(isActive: boolean) {
  return isActive
    ? "inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-2 text-sm font-semibold text-white transition hover:bg-rose-800"
    : "inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700";
}

export default function Home() {
  const [view, setView] = useState<ViewName>("input");
  const [form, setForm] = useState<BirthForm>(initialForm);
  const [readingForm, setReadingForm] = useState<BirthForm>(normalizeForm(initialForm));
  const [readingResult, setReadingResult] = useState<BaziResult>(initialBazi);
  const [recordSearch, setRecordSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState("排盘结果尚未保存。登录后可手动保存到云端记录。");
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [cloudRecords, setCloudRecords] = useState<CloudBaziRecord[]>([]);
  const [cloudStatus, setCloudStatus] = useState("");
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [compatLeftId, setCompatLeftId] = useState("");
  const [compatRightId, setCompatRightId] = useState("");
  const [compatReportIds, setCompatReportIds] = useState<{ leftId: string; rightId: string } | null>(null);

  const supabaseReady = isSupabaseConfigured;
  const cityOptions = useMemo(() => Object.keys(chinaAreas[form.province] || {}), [form.province]);
  const countyOptions = useMemo(() => chinaAreas[form.province]?.[form.city] || [], [form.province, form.city]);
  const formSummary = getRecordSummary(form);
  const readingSummary = getRecordSummary(readingForm);
  const records = useMemo(() => cloudRecords.map(toLocalRecord), [cloudRecords]);
  const visibleCloudRecords = cloudRecords.filter((record) =>
    record.name.toLowerCase().includes(recordSearch.trim().toLowerCase()),
  );
  const compatLeftRecord = records.find((record) => record.id === compatLeftId);
  const compatRightRecord = records.find((record) => record.id === compatRightId);
  const compatReportLeftRecord = records.find((record) => record.id === compatReportIds?.leftId);
  const compatReportRightRecord = records.find((record) => record.id === compatReportIds?.rightId);
  const compatibilityAnalysis =
    compatReportLeftRecord && compatReportRightRecord && compatReportLeftRecord.id !== compatReportRightRecord.id
      ? analyzeCompatibility(compatReportLeftRecord, compatReportRightRecord)
      : null;
  const loadCloudRecords = useCallback(async () => {
    if (!supabase) {
      return;
    }

    setIsCloudLoading(true);
    setCloudStatus("");

    const { data, error } = await fetchCloudRecords(supabase);

    setIsCloudLoading(false);

    if (error) {
      setCloudStatus(getCloudStatusText("读取云端记录", error.message));
      return;
    }

    setCloudRecords(data);
    setCloudStatus(getCloudSuccessText(data.length));
  }, []);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        loadCloudRecords();
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        loadCloudRecords();
      } else {
        setCloudRecords([]);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadCloudRecords, supabaseReady]);

  useEffect(() => {
    const syncHashView = () => {
      if (window.location.hash === "#records") {
        setView("records");
      }
    };

    const timer = window.setTimeout(syncHashView, 0);
    window.addEventListener("hashchange", syncHashView);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", syncHashView);
    };
  }, []);

  function updateForm<K extends keyof BirthForm>(key: K, value: BirthForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateProvince(province: string) {
    const nextCity = Object.keys(chinaAreas[province] || {})[0] || "";
    const nextCounty = chinaAreas[province]?.[nextCity]?.[0] || "";
    setForm((current) => ({ ...current, province, city: nextCity, county: nextCounty }));
  }

  function updateCity(city: string) {
    const nextCounty = chinaAreas[form.province]?.[city]?.[0] || "";
    setForm((current) => ({ ...current, city, county: nextCounty }));
  }

  function showView(nextView: ViewName) {
    if (nextView === "compatibility" && records.length >= 2) {
      const nextLeftId = compatLeftId || records[0].id;
      const nextRightId =
        compatRightId && compatRightId !== nextLeftId
          ? compatRightId
          : records.find((record) => record.id !== nextLeftId)?.id || "";
      setCompatLeftId(nextLeftId);
      setCompatRightId(nextRightId);
    }

    setView(nextView);

    if (nextView === "records") {
      window.history.replaceState(null, "", "#records");
    } else if (window.location.hash === "#records") {
      window.history.replaceState(null, "", window.location.pathname);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveCloudRecord(nextForm: BirthForm, nextResult: BaziResult) {
    if (!supabase || !user) {
      return;
    }

    const longitude = getApproxLongitude(nextForm.province);
    const { error } = await insertCloudRecord(supabase, {
      userId: user.id,
      form: nextForm,
      result: nextResult,
      longitude,
    });

    if (error) {
      setSaveStatus(getCloudStatusText("云端保存", error.message));
      return;
    }

    setSaveStatus("已保存到你的云端命盘记录。");
    loadCloudRecords();
  }

  function validateAuthForm() {
    if (!supabase) {
      setAuthStatus("请先配置 Supabase 环境变量。");
      return false;
    }

    if (!authEmail.trim()) {
      setAuthStatus("请先输入邮箱。");
      return false;
    }

    if (authPassword.length < 6) {
      setAuthStatus("密码至少需要 6 位。");
      return false;
    }

    return true;
  }

  async function handlePasswordSignIn() {
    if (!validateAuthForm() || !supabase) {
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus("正在登录...");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthStatus(`登录失败：${getAuthErrorText(error.message)}`);
        return;
      }

      setAuthStatus("登录成功。");
    } catch (error) {
      setAuthStatus(`登录失败：${getAuthErrorText(error instanceof Error ? error.message : "网络请求失败")}`);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handlePasswordSignUp() {
    if (!validateAuthForm() || !supabase) {
      return;
    }

    setIsAuthSubmitting(true);
    setAuthStatus("正在创建账号...");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthStatus(`注册失败：${getAuthErrorText(error.message)}`);
        return;
      }

      if (!data.session) {
        setAuthStatus("账号已创建。若 Supabase 开启了邮箱确认，请先到后台关闭 Confirm email，或打开确认邮件。");
        return;
      }

      setAuthStatus("注册成功，已登录。");
    } catch (error) {
      setAuthStatus(`注册失败：${getAuthErrorText(error instanceof Error ? error.message : "网络请求失败")}`);
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setAuthStatus("已退出登录。");
    setCloudRecords([]);
  }

  function handleGenerate() {
    const nextForm = normalizeForm(form);
    const nextResult = getBaziResult(nextForm);
    setReadingForm(nextForm);
    setReadingResult(nextResult);
    setSaveStatus(
      user
        ? "排盘结果已生成。点击保存命盘后，才会写入云端记录。"
        : "排盘结果已生成。请先登录，再手动保存到云端记录。",
    );
    showView("report");
  }

  async function handleSaveRecord() {
    if (!supabase || !user) {
      setSaveStatus("请先登录，再保存到云端记录。");
      return;
    }

    const fingerprint = getRecordFingerprint(readingForm);

    if (cloudRecords.some((record) => getRecordFingerprint(toLocalRecord(record).form) === fingerprint)) {
      setSaveStatus("这条命盘已保存过，没有重复新增。可到我的记录中直接进入排盘。");
      return;
    }

    setSaveStatus("正在保存到你的云端命盘记录...");
    await saveCloudRecord(readingForm, readingResult);
  }

  function handleOpenCloudRecord(record: CloudBaziRecord) {
    const localRecord = toLocalRecord(record);
    setReadingForm(localRecord.form);
    setReadingResult(localRecord.result);
    setSaveStatus("当前排盘来自你的云端命盘记录。");
    showView("report");
  }

  async function handleDeleteCloudRecord(recordId: string) {
    if (!supabase || !user) {
      return;
    }

    const { error } = await deleteCloudRecord(supabase, recordId);

    if (error) {
      setCloudStatus(getCloudStatusText("删除云端记录", error.message));
      return;
    }

    setCloudStatus("已删除云端记录。");
    loadCloudRecords();
  }

  function handleGenerateCompatibility() {
    if (!compatLeftRecord || !compatRightRecord || compatLeftRecord.id === compatRightRecord.id) {
      return;
    }

    setCompatReportIds({ leftId: compatLeftRecord.id, rightId: compatRightRecord.id });
    showView("compatibilityReport");
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-stone-950">
      <nav className="mx-auto grid w-full max-w-5xl grid-cols-4 gap-2 px-5 pt-5 md:px-8">
        <button
          type="button"
          onClick={() => showView("input")}
          className={navItemClass(view === "input" || view === "report")}
        >
          排盘输入
        </button>
        <button
          type="button"
          onClick={() => showView("records")}
          className={navItemClass(view === "records")}
        >
          我的记录
        </button>
        <Link
          href="/compatibility"
          className={navItemClass(false)}
        >
          合盘分析
        </Link>
        <Link
          href="/auth"
          className={navItemClass(view === "auth")}
        >
          {user ? "账户" : "登录"}
        </Link>
      </nav>

      {view === "auth" && (
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
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  密码
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    placeholder="至少 6 位"
                    className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                  <input
                    type="checkbox"
                    checked={showAuthPassword}
                    onChange={(event) => setShowAuthPassword(event.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-stone-950"
                  />
                  显示密码
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handlePasswordSignIn}
                    disabled={isAuthSubmitting}
                    className="h-11 rounded-md bg-stone-950 px-4 text-base font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {isAuthSubmitting ? "处理中..." : "登录"}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordSignUp}
                    disabled={isAuthSubmitting}
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
            {authStatus && <p className="mt-4 text-sm leading-6 text-rose-700">{authStatus}</p>}
          </section>
        </section>
      )}

      {view === "input" && (
        <section className="mx-auto w-full max-w-4xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-8">
            <p className="text-sm font-medium text-rose-700">八字排盘 MVP</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
              输入出生信息，生成高准确度排盘。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-700">
              当前版本只展示固定规则可推导的排盘结果，减少推断性分析，优先保证准确性。
            </p>
          </header>

          <form className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                姓名
                <input
                  name="name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="例如：小林"
                  className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-stone-700">
                性别
                <select
                  name="gender"
                  value={form.gender}
                  onChange={(event) => updateForm("gender", event.target.value as GenderValue)}
                  className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                >
                  <option value="female">女</option>
                  <option value="male">男</option>
                  <option value="private">暂不填写</option>
                </select>
              </label>
            </div>

            <section className="mt-5 rounded-md border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">出生日期</h2>
                <p className="text-sm font-medium text-rose-700">{formSummary.date}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <WheelPicker label="年" name="year" options={yearOptions} value={form.year} onChange={(value) => updateForm("year", value)} />
                <WheelPicker label="月" name="month" options={monthOptions} value={form.month} onChange={(value) => updateForm("month", value)} />
                <WheelPicker label="日" name="day" options={dayOptions} value={form.day} onChange={(value) => updateForm("day", value)} />
              </div>
            </section>

            <section className="mt-5 rounded-md border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">出生时间</h2>
                <p className="text-sm font-medium text-rose-700">{formSummary.time}</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <WheelPicker label="时" name="hour" options={hourOptions} value={form.hour} onChange={(value) => updateForm("hour", value)} />
                <WheelPicker label="分" name="minute" options={minuteOptions} value={form.minute} onChange={(value) => updateForm("minute", value)} />
              </div>
            </section>

            <section className="mt-5 rounded-md border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">出生地</h2>
                <p className="text-right text-sm font-medium text-rose-700">{formSummary.place}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <WheelPicker label="省" name="province" options={provinceOptions} value={form.province} onChange={updateProvince} />
                <WheelPicker label="市" name="city" options={cityOptions} value={form.city} onChange={updateCity} />
                <WheelPicker label="县区" name="county" options={countyOptions} value={form.county} onChange={(value) => updateForm("county", value)} />
              </div>
            </section>

            <section className="mt-5 rounded-md border border-stone-200 p-4">
              <h2 className="text-base font-semibold">排盘设置</h2>
              <div className="mt-4 grid gap-3">
                <label className="flex items-start gap-3 rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                  <input
                    type="radio"
                    name="timeMode"
                    value="standard"
                    checked={form.timeMode === "standard"}
                    onChange={() => updateForm("timeMode", "standard")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-stone-950">使用北京时间</span>
                    <span>直接按用户输入的出生时间排盘。</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md bg-stone-50 p-3 text-sm leading-6 text-stone-700">
                  <input
                    type="radio"
                    name="timeMode"
                    value="trueSolar"
                    checked={form.timeMode === "trueSolar"}
                    onChange={() => updateForm("timeMode", "trueSolar")}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-semibold text-stone-950">使用真太阳时校正</span>
                    <span>根据出生地近似经度校正时间后排盘。</span>
                  </span>
                </label>
              </div>
            </section>

            <label className="mt-5 grid gap-2 text-sm font-medium text-stone-700">
              备注
              <textarea
                name="note"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                rows={3}
                placeholder="例如：出生时间来源、是否需要复核、关系背景等"
                className="resize-none rounded-md border border-stone-300 px-3 py-2 text-base leading-6 outline-none transition focus:border-rose-500"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              className="mt-5 h-11 w-full rounded-md bg-stone-950 px-4 text-base font-semibold text-white transition hover:bg-rose-800"
            >
              查询并生成排盘
            </button>
          </form>
        </section>
      )}

      {view === "report" && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700">{readingForm.name}的排盘</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">固定规则排盘</h1>
            </div>
            <button
              type="button"
              onClick={() => showView("input")}
              className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
            >
              返回修改资料
            </button>
          </header>

          <div className="grid gap-5">
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-500">基础信息</p>
                  <h2 className="mt-1 text-2xl font-semibold">本次排盘记录</h2>
                </div>
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">点击查询后生成</p>
              </div>

              <div className="mt-4 grid gap-2 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700 sm:grid-cols-2">
                <p>姓名：<span>{readingForm.name}</span></p>
                <p>性别：<span>{readingSummary.genderText}</span></p>
                <p>出生日期：<span>{readingSummary.date}</span></p>
                <p>出生时间：<span>{readingSummary.time}</span></p>
                <p>出生地：<span>{readingSummary.place}</span></p>
                <p>排盘方式：<span>{readingResult.timeInfo.mode}</span></p>
                <p>排盘时间：<span>{readingResult.timeInfo.displayTime}</span></p>
                <p className="sm:col-span-2">备注：<span>{readingForm.note || "未填写"}</span></p>
                <p>
                  经度校正：<span>{readingResult.timeInfo.longitude.toFixed(1)}°E</span>，
                  <span>{readingResult.timeInfo.offsetMinutes} 分钟</span>
                </p>
              </div>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-500">云端记录</p>
                  <h2 className="mt-1 text-2xl font-semibold">保存当前命盘</h2>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRecord}
                  className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-rose-800"
                >
                  保存到云端
                </button>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">{saveStatus}</p>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="rounded-md border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                日主：<span>{readingResult.dayMaster}</span>，<span>{readingResult.dayMasterElement}</span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {readingResult.pillars.map((pillar) => (
                  <article key={pillar.label} className="rounded-md border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-stone-500">{pillar.label}</p>
                      <p className="text-2xl font-semibold text-stone-950">{pillar.value}</p>
                    </div>

                    <div className="mt-4 rounded-md border border-stone-200 bg-white p-3">
                      <p className="text-xs font-semibold text-stone-500">标准排盘</p>
                      <div className="mt-2 grid gap-1 text-xs leading-5 text-stone-600">
                        <p>天干：<span>{pillar.gan}</span>，地支：<span>{pillar.zhi}</span></p>
                        <p>藏干：<span>{pillar.hideGan.join("、") || "无"}</span></p>
                        <p>五行：<span>{pillar.wuXing}</span></p>
                        <p>纳音：<span>{pillar.naYin}</span></p>
                        <p>天干十神：<span>{pillar.shiShenGan}</span></p>
                        <p>地支十神：<span>{pillar.shiShenZhi.join("、") || "无"}</span></p>
                        <p>十二长生：<span>{pillar.diShi}</span></p>
                        <p>旬：<span>{pillar.xun}</span></p>
                        <p>旬空：<span>{pillar.xunKong}</span></p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">合冲刑害</h2>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-stone-700">
                {readingResult.relations.length ? (
                  readingResult.relations.map((relation) => (
                    <p key={`${relation.type}-${relation.pair}-${relation.positions}`}>
                      <span className="font-semibold text-stone-950">{relation.type}</span>
                      ：{relation.positions}，{relation.note}
                    </p>
                  ))
                ) : (
                  <p>未见明显合冲刑害。</p>
                )}
              </div>
            </section>
          </div>
        </section>
      )}

      {view === "records" && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700">我的记录</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">我的命盘记录</h1>
            </div>
            <button
              type="button"
              onClick={() => showView("input")}
              className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-rose-800"
            >
              新建排盘
            </button>
          </header>

          <section className="mb-5 rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-500">云端记录</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {user ? `${cloudRecords.length} 条记录` : "登录后可用"}
                </h2>
              </div>
              {user ? (
                <button
                  type="button"
                  onClick={loadCloudRecords}
                  className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
                >
                  刷新
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => showView("auth")}
                  className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-rose-800"
                >
                  去登录
                </button>
              )}
            </div>

            {isCloudLoading && <p className="mt-4 text-sm leading-6 text-stone-600">正在读取云端记录...</p>}
            {cloudStatus && <p className="mt-4 text-sm leading-6 text-rose-700">{cloudStatus}</p>}

            {user && (
              <>
                <label className="mt-5 grid gap-2 text-sm font-medium text-stone-700">
                  按姓名搜索
                  <input
                    name="recordSearch"
                    value={recordSearch}
                    onChange={(event) => setRecordSearch(event.target.value)}
                    placeholder="输入姓名或昵称"
                    className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                  />
                </label>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {recordSearch.trim() ? `找到 ${visibleCloudRecords.length} 条匹配记录。` : "显示全部云端记录。"}
                </p>
              </>
            )}

            {user && !isCloudLoading && cloudRecords.length === 0 && (
              <div className="mt-5 rounded-md border border-dashed border-stone-300 p-6 text-sm leading-6 text-stone-600">
                还没有云端命盘记录。完成排盘后，点击“保存到云端”才会保存到这里。
              </div>
            )}

            {user && cloudRecords.length > 0 && visibleCloudRecords.length === 0 && (
              <div className="mt-5 rounded-md border border-dashed border-stone-300 p-6 text-sm leading-6 text-stone-600">
                没有匹配的云端记录。
              </div>
            )}

            {user && cloudRecords.length > 0 && (
              <div className="mt-5 grid gap-3">
                {visibleCloudRecords.map((record) => {
                  const pillarText = record.pillars_result.map((pillar) => pillar.value).join("  ");
                  return (
                    <article key={record.id} className="rounded-md border border-stone-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold text-stone-950">{record.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-600">
                            {getGenderText(record.gender)} · {record.birth_date} {record.birth_time.slice(0, 5)} · {record.birth_place}
                          </p>
                          <p className="mt-3 text-lg font-semibold tracking-normal text-stone-950">{pillarText}</p>
                          <p className="mt-1 text-sm leading-6 text-stone-600">
                            日主 {record.bazi_result.dayMaster} · {record.bazi_result.dayMasterElement} · 保存于 {formatSavedTime(record.created_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenCloudRecord(record)}
                            className="h-9 rounded-md bg-stone-950 px-3 text-sm font-semibold text-white transition hover:bg-rose-800"
                          >
                            进入排盘
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCloudRecord(record.id)}
                            className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      )}

      {view === "compatibility" && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700">合盘分析</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">从记录导入两张命盘</h1>
            </div>
            <button
              type="button"
              onClick={() => showView("records")}
              className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
            >
              查看记录
            </button>
          </header>

          {records.length < 2 ? (
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="rounded-md border border-dashed border-stone-300 p-6 text-sm leading-6 text-stone-600">
                合盘至少需要两条已保存记录。请先保存两张命盘，再回到这里选择双方。
              </div>
            </section>
          ) : (
            <div className="grid gap-5">
              <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    A 方
                    <select
                      value={compatLeftId}
                      onChange={(event) => setCompatLeftId(event.target.value)}
                      className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                    >
                      {records.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.form.name} · {getRecordSummary(record.form).date} {getRecordSummary(record.form).time}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    B 方
                    <select
                      value={compatRightId}
                      onChange={(event) => setCompatRightId(event.target.value)}
                      className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500"
                    >
                      {records.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.form.name} · {getRecordSummary(record.form).date} {getRecordSummary(record.form).time}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {compatLeftRecord && compatRightRecord && compatLeftRecord.id === compatRightRecord.id && (
                  <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800">
                    请选择两条不同记录进行合盘。
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleGenerateCompatibility}
                  disabled={!compatLeftRecord || !compatRightRecord || compatLeftRecord.id === compatRightRecord.id}
                  className="mt-5 h-11 w-full rounded-md bg-stone-950 px-4 text-base font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  开始合盘分析
                </button>
              </section>
            </div>
          )}
        </section>
      )}

      {view === "compatibilityReport" && compatReportLeftRecord && compatReportRightRecord && compatibilityAnalysis && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700">合盘分析</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">
                {compatReportLeftRecord.form.name} 与 {compatReportRightRecord.form.name}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => showView("compatibility")}
              className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
            >
              返回修改
            </button>
          </header>

          <div className="grid gap-5">
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">双方命盘</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[compatReportLeftRecord, compatReportRightRecord].map((record) => {
                  const summary = getRecordSummary(record.form);
                  return (
                    <article key={record.id} className="rounded-md border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-stone-950">{record.form.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-stone-600">
                            {summary.genderText} · {summary.date} {summary.time}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-rose-700">
                          {record.result.dayMaster}{record.result.dayMasterElement}
                        </p>
                      </div>
                      <p className="mt-3 text-xl font-semibold tracking-normal text-stone-950">
                        {record.result.pillars.map((pillar) => pillar.value).join("  ")}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">日主关系</h2>
              <p className="mt-3 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                {compatibilityAnalysis!.dayMasterRelation}
              </p>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">五行统计</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-3 font-semibold">五行</th>
                      <th className="py-2 pr-3 font-semibold">{compatReportLeftRecord.form.name}</th>
                      <th className="py-2 pr-3 font-semibold">{compatReportRightRecord.form.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compatibilityAnalysis!.elementRows.map((row) => (
                      <tr key={row.element} className="border-b border-stone-100">
                        <td className="py-2 pr-3 font-semibold text-stone-950">{row.element}</td>
                        <td className="py-2 pr-3 text-stone-700">{row.left}</td>
                        <td className="py-2 pr-3 text-stone-700">{row.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">配偶宫关系</h2>
              <RelationCards emptyText="双方日支之间未见明显合冲刑害。" relations={compatibilityAnalysis!.spousePalaceRelations} />
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">双方合冲刑害</h2>
              <RelationCards emptyText="双方四柱之间未见明显合冲刑害。" relations={compatibilityAnalysis!.crossRelations} />
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
