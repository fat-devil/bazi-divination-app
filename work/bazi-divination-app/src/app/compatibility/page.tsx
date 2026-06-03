"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { BaziPillar, BaziResult, ElementName } from "@/lib/bazi";
import { supabase } from "@/lib/supabase";

type GenderValue = "female" | "male" | "private";
type TimeModeValue = "standard" | "trueSolar";
type ViewMode = "select" | "report";

type BirthForm = {
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

type BirthRecord = {
  id: string;
  createdAt: string;
  form: BirthForm;
  result: BaziResult;
};

type CloudBaziRecord = {
  id: string;
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
  pillars_result: BaziResult["pillars"];
  bazi_result: BaziResult;
  created_at: string;
};

type CompatibilityRelation = {
  type: string;
  pair: string;
  positions: string;
  note: string;
};

type CompatibilityAnalysis = {
  dayMasterRelation: string;
  elementRows: Array<{ element: ElementName; left: number; right: number }>;
  stemRelations: CompatibilityRelation[];
  branchRelations: CompatibilityRelation[];
  groupRelations: CompatibilityRelation[];
  spousePalaceRelations: CompatibilityRelation[];
};

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
const branchTriCombines: Array<{ branches: string[]; element: ElementName }> = [
  { branches: ["申", "子", "辰"], element: "水" },
  { branches: ["亥", "卯", "未"], element: "木" },
  { branches: ["寅", "午", "戌"], element: "火" },
  { branches: ["巳", "酉", "丑"], element: "金" },
];
const branchMeetings: Array<{ branches: string[]; element: ElementName }> = [
  { branches: ["寅", "卯", "辰"], element: "木" },
  { branches: ["巳", "午", "未"], element: "火" },
  { branches: ["申", "酉", "戌"], element: "金" },
  { branches: ["亥", "子", "丑"], element: "水" },
];

function getGenderText(value: string) {
  const labels: Record<string, string> = {
    female: "女",
    male: "男",
    private: "暂不填写",
  };
  return labels[value] || value;
}

function toLocalRecord(record: CloudBaziRecord): BirthRecord {
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

function getCloudErrorText(message: string) {
  if (message.includes("permission denied for schema") || message.includes("permission denied for table")) {
    return "表已经存在，但当前登录用户没有访问权限。请重新运行 supabase/schema.sql。";
  }

  if (message.includes("bazi_profiles") || message.includes("relation") || message.includes("schema cache")) {
    return "云端命盘记录表还没有创建，或接口缓存尚未刷新。请确认已运行 supabase/schema.sql。";
  }

  if (message.includes("row-level security") || message.includes("violates row-level security")) {
    return "云端记录权限规则未通过。请重新运行 supabase/schema.sql 里的 RLS policy。";
  }

  return message;
}

function getRecordSummary(form: BirthForm) {
  return {
    date: `${form.year}-${form.month}-${form.day}`,
    time: `${form.hour}:${form.minute}`,
    place: [form.province, form.city, form.county].filter(Boolean).join(" "),
    genderText: getGenderText(form.gender),
    timeModeText: form.timeMode === "trueSolar" ? "真太阳时" : "北京时间",
  };
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

function getStemRelation(leftPillar: BaziPillar, rightPillar: BaziPillar, leftName: string, rightName: string) {
  const stemPair = getPairKey(leftPillar.gan, rightPillar.gan, Object.keys(stemCombines));

  if (!stemPair) {
    return [];
  }

  return [
    {
      type: "天干五合",
      pair: `${leftPillar.gan}${rightPillar.gan}`,
      positions: `${leftName}${leftPillar.label}-${rightName}${rightPillar.label}`,
      note: stemCombines[stemPair],
    },
  ];
}

function getBranchRelations(leftPillar: BaziPillar, rightPillar: BaziPillar, leftName: string, rightName: string) {
  const relations: CompatibilityRelation[] = [];
  const positions = `${leftName}${leftPillar.label}-${rightName}${rightPillar.label}`;
  const combinePair = getPairKey(leftPillar.zhi, rightPillar.zhi, Object.keys(branchCombines));
  const clashPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchClashes);
  const harmPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchHarms);
  const breakPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchBreaks);
  const punishPair = getPairKey(leftPillar.zhi, rightPillar.zhi, branchPunishes);

  if (combinePair) {
    relations.push({ type: "地支六合", pair: `${leftPillar.zhi}${rightPillar.zhi}`, positions, note: branchCombines[combinePair] });
  }

  if (clashPair) {
    relations.push({ type: "地支六冲", pair: `${leftPillar.zhi}${rightPillar.zhi}`, positions, note: `${leftPillar.zhi}${rightPillar.zhi}冲` });
  }

  if (punishPair) {
    relations.push({ type: "地支相刑", pair: `${leftPillar.zhi}${rightPillar.zhi}`, positions, note: `${leftPillar.zhi}${rightPillar.zhi}刑` });
  }

  if (harmPair) {
    relations.push({ type: "地支相害", pair: `${leftPillar.zhi}${rightPillar.zhi}`, positions, note: `${leftPillar.zhi}${rightPillar.zhi}害` });
  }

  if (breakPair) {
    relations.push({ type: "地支相破", pair: `${leftPillar.zhi}${rightPillar.zhi}`, positions, note: `${leftPillar.zhi}${rightPillar.zhi}破` });
  }

  return relations;
}

function evaluateBranchGroups(left: BirthRecord, right: BirthRecord) {
  const branchItems = [left, right].flatMap((record) =>
    record.result.pillars.map((pillar) => ({
      branch: pillar.zhi,
      position: `${record.form.name}${pillar.label}`,
    })),
  );

  const createGroupRelation = (type: string, branches: string[], element: ElementName) => {
    const matched = branches.flatMap((branch) =>
      branchItems
        .filter((item) => item.branch === branch)
        .map((item) => item.position),
    );

    if (matched.length < 3 || !branches.every((branch) => branchItems.some((item) => item.branch === branch))) {
      return null;
    }

    return {
      type,
      pair: branches.join(""),
      positions: matched.join("、"),
      note: `${branches.join("")}${type.replace("地支", "")}${element}`,
    };
  };

  return [
    ...branchTriCombines.map((group) => createGroupRelation("地支三合", group.branches, group.element)),
    ...branchMeetings.map((group) => createGroupRelation("地支三会", group.branches, group.element)),
  ].filter((relation): relation is CompatibilityRelation => Boolean(relation));
}

function analyzeCompatibility(left: BirthRecord, right: BirthRecord): CompatibilityAnalysis {
  const leftCounts = countElements(left.result);
  const rightCounts = countElements(right.result);
  const stemRelations = left.result.pillars.flatMap((leftPillar) =>
    right.result.pillars.flatMap((rightPillar) =>
      getStemRelation(leftPillar, rightPillar, left.form.name, right.form.name),
    ),
  );
  const branchRelations = left.result.pillars.flatMap((leftPillar) =>
    right.result.pillars.flatMap((rightPillar) =>
      getBranchRelations(leftPillar, rightPillar, left.form.name, right.form.name),
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
    stemRelations,
    branchRelations,
    groupRelations: evaluateBranchGroups(left, right),
    spousePalaceRelations:
      leftDayPillar && rightDayPillar
        ? getBranchRelations(leftDayPillar, rightDayPillar, left.form.name, right.form.name)
        : [],
  };
}

function RelationList({ emptyText, relations }: { emptyText: string; relations: CompatibilityRelation[] }) {
  if (!relations.length) {
    return <p className="mt-3 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-600">{emptyText}</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-stone-500">
            <th className="py-2 pr-3 font-semibold">类型</th>
            <th className="py-2 pr-3 font-semibold">组合</th>
            <th className="py-2 pr-3 font-semibold">位置</th>
            <th className="py-2 pr-3 font-semibold">说明</th>
          </tr>
        </thead>
        <tbody>
          {relations.map((relation) => (
            <tr key={`${relation.type}-${relation.positions}-${relation.pair}`} className="border-b border-stone-100 align-top">
              <td className="py-2 pr-3 font-semibold text-stone-950">{relation.type}</td>
              <td className="py-2 pr-3 text-stone-700">{relation.pair}</td>
              <td className="py-2 pr-3 text-stone-700">{relation.positions}</td>
              <td className="py-2 pr-3 text-stone-700">{relation.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompatibilityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cloudRecords, setCloudRecords] = useState<CloudBaziRecord[]>([]);
  const [cloudStatus, setCloudStatus] = useState("");
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [reportIds, setReportIds] = useState<{ leftId: string; rightId: string } | null>(null);
  const records = useMemo(() => cloudRecords.map(toLocalRecord), [cloudRecords]);
  const mode: ViewMode = reportIds ? "report" : "select";
  const selectedLeftId = leftId || records[0]?.id || "";
  const selectedRightId =
    rightId && rightId !== selectedLeftId
      ? rightId
      : records.find((record) => record.id !== selectedLeftId)?.id || "";
  const leftRecord = records.find((record) => record.id === selectedLeftId);
  const rightRecord = records.find((record) => record.id === selectedRightId);
  const reportLeftRecord = records.find((record) => record.id === reportIds?.leftId);
  const reportRightRecord = records.find((record) => record.id === reportIds?.rightId);
  const analysis = reportLeftRecord && reportRightRecord ? analyzeCompatibility(reportLeftRecord, reportRightRecord) : null;

  const loadCloudRecords = useCallback(async () => {
    if (!supabase) {
      setCloudStatus("请先配置 Supabase 环境变量。");
      return;
    }

    setIsCloudLoading(true);
    setCloudStatus("");

    const { data, error } = await supabase
      .from("bazi_profiles")
      .select("*")
      .order("created_at", { ascending: false });

    setIsCloudLoading(false);

    if (error) {
      setCloudStatus(`读取云端记录失败：${getCloudErrorText(error.message)}`);
      return;
    }

    setCloudRecords((data || []) as CloudBaziRecord[]);
    setCloudStatus((data || []).length ? `已读取 ${(data || []).length} 条云端记录。` : "云端记录已连接，当前还没有保存过命盘。");
  }, []);

  useEffect(() => {
    if (!supabase) {
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
        setCloudStatus("请先登录，再从云端记录中选择两张命盘。");
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [loadCloudRecords]);

  function handleAnalyze() {
    if (!leftRecord || !rightRecord || leftRecord.id === rightRecord.id) {
      return;
    }

    setReportIds({ leftId: leftRecord.id, rightId: rightRecord.id });
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
        <Link href="/compatibility" className="inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-2 text-sm font-semibold text-white transition hover:bg-rose-800">
          合盘分析
        </Link>
        <Link href="/auth" className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700">
          {user ? "账户" : "登录"}
        </Link>
      </nav>

      {mode === "select" && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6">
            <p className="text-sm font-medium text-rose-700">合盘分析</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">从云端记录导入两张命盘</h1>
          </header>

          {!user ? (
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="rounded-md border border-dashed border-stone-300 p-6 text-sm leading-6 text-stone-600">
                请先登录，再从云端记录中选择两张命盘进行合盘。
              </div>
              <Link href="/auth" className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-rose-800">
                去登录
              </Link>
            </section>
          ) : isCloudLoading ? (
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="rounded-md bg-stone-50 p-6 text-sm leading-6 text-stone-600">正在读取云端记录...</div>
            </section>
          ) : records.length < 2 ? (
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="rounded-md border border-dashed border-stone-300 p-6 text-sm leading-6 text-stone-600">
                合盘至少需要两条云端记录。请先回到排盘页生成命盘，并点击“保存到云端”。
              </div>
              {cloudStatus && <p className="mt-4 text-sm leading-6 text-rose-700">{cloudStatus}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-rose-800">
                  去排盘
                </Link>
                <button
                  type="button"
                  onClick={loadCloudRecords}
                  className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
                >
                  刷新
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-6 text-stone-600">已读取 {records.length} 条云端记录。</p>
                <button
                  type="button"
                  onClick={loadCloudRecords}
                  className="h-9 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700"
                >
                  刷新
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  A 方
                  <select value={selectedLeftId} onChange={(event) => setLeftId(event.target.value)} className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500">
                    {records.map((record) => {
                      const summary = getRecordSummary(record.form);
                      return (
                        <option key={record.id} value={record.id}>
                          {record.form.name} · {summary.date} {summary.time}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  B 方
                  <select value={selectedRightId} onChange={(event) => setRightId(event.target.value)} className="h-11 rounded-md border border-stone-300 px-3 text-base outline-none transition focus:border-rose-500">
                    {records.map((record) => {
                      const summary = getRecordSummary(record.form);
                      return (
                        <option key={record.id} value={record.id}>
                          {record.form.name} · {summary.date} {summary.time}
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {leftRecord && rightRecord && leftRecord.id === rightRecord.id && (
                <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-800">请选择两条不同记录进行合盘。</p>
              )}

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!leftRecord || !rightRecord || leftRecord.id === rightRecord.id}
                className="mt-5 h-11 w-full rounded-md bg-stone-950 px-4 text-base font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-stone-300"
              >
                开始合盘分析
              </button>
            </section>
          )}
        </section>
      )}

      {mode === "report" && reportLeftRecord && reportRightRecord && analysis && (
        <section className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-700">合盘分析</p>
              <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-normal">
                {reportLeftRecord.form.name} 与 {reportRightRecord.form.name}
              </h1>
            </div>
            <button type="button" onClick={() => setReportIds(null)} className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition hover:border-rose-500 hover:text-rose-700">
              返回修改
            </button>
          </header>

          <div className="grid gap-5">
            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">双方命盘</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[reportLeftRecord, reportRightRecord].map((record) => {
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
              <p className="mt-3 rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">{analysis.dayMasterRelation}</p>
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">五行统计</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 pr-3 font-semibold">五行</th>
                      <th className="py-2 pr-3 font-semibold">{reportLeftRecord.form.name}</th>
                      <th className="py-2 pr-3 font-semibold">{reportRightRecord.form.name}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.elementRows.map((row) => (
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
              <RelationList emptyText="双方日支之间未见明显地支关系。" relations={analysis.spousePalaceRelations} />
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">天干关系</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">五合</p>
              <RelationList emptyText="双方天干之间未见五合。" relations={analysis.stemRelations} />
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">地支关系</h2>
              <p className="mt-1 text-sm leading-6 text-stone-500">六合、冲、刑、害、破</p>
              <RelationList emptyText="双方地支之间未见六合、冲、刑、害、破。" relations={analysis.branchRelations} />
            </section>

            <section className="rounded-lg border border-stone-300 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-semibold">三合三会</h2>
              <RelationList emptyText="双方组合中未见完整三合或三会。" relations={analysis.groupRelations} />
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
