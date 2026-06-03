import { Solar } from "lunar-typescript";

export type BirthInput = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender?: string;
  useTrueSolarTime?: boolean;
  longitude?: number;
};

export type ElementName = "木" | "火" | "土" | "金" | "水";

export type BaziPillar = {
  label: string;
  value: string;
  gan: string;
  zhi: string;
  hideGan: string[];
  wuXing: string;
  naYin: string;
  shiShenGan: string;
  shiShenZhi: string[];
  diShi: string;
  xun: string;
  xunKong: string;
};

export type RelationItem = {
  type: string;
  pair: string;
  positions: string;
  note: string;
};

export type BaziResult = {
  pillars: BaziPillar[];
  dayMaster: string;
  dayMasterElement: ElementName | "未知";
  relations: RelationItem[];
  timeInfo: {
    mode: "北京时间" | "真太阳时";
    displayTime: string;
    longitude: number;
    offsetMinutes: number;
  };
};

type RawPillar = BaziPillar;

const GAN_ELEMENTS: Record<string, ElementName> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const STEM_COMBINES: Record<string, string> = {
  甲己: "甲己合土",
  乙庚: "乙庚合金",
  丙辛: "丙辛合水",
  丁壬: "丁壬合木",
  戊癸: "戊癸合火",
};

const BRANCH_COMBINES: Record<string, string> = {
  子丑: "子丑合土",
  寅亥: "寅亥合木",
  卯戌: "卯戌合火",
  辰酉: "辰酉合金",
  巳申: "巳申合水",
  午未: "午未合土",
};

const BRANCH_CLASHES = ["子午", "丑未", "寅申", "卯酉", "辰戌", "巳亥"];
const BRANCH_HARMS = ["子未", "丑午", "寅巳", "卯辰", "申亥", "酉戌"];
const BRANCH_BREAKS = ["子酉", "卯午", "辰丑", "戌未", "寅亥", "巳申"];
const BRANCH_PUNISHES = ["子卯", "寅巳", "巳申", "申寅", "丑戌", "戌未", "未丑", "辰辰", "午午", "酉酉", "亥亥"];
const BRANCH_TRI_COMBINES: Array<{ branches: string[]; element: ElementName }> = [
  { branches: ["申", "子", "辰"], element: "水" },
  { branches: ["亥", "卯", "未"], element: "木" },
  { branches: ["寅", "午", "戌"], element: "火" },
  { branches: ["巳", "酉", "丑"], element: "金" },
];
const BRANCH_MEETINGS: Array<{ branches: string[]; element: ElementName }> = [
  { branches: ["寅", "卯", "辰"], element: "木" },
  { branches: ["巳", "午", "未"], element: "火" },
  { branches: ["申", "酉", "戌"], element: "金" },
  { branches: ["亥", "子", "丑"], element: "水" },
];

export function calculateBazi(input: BirthInput): BaziResult {
  const timeInfo = resolveSolarTime(input);
  const { year, month, day, hour, minute } = timeInfo.parts;
  const eightChar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
    .getLunar()
    .getEightChar();
  const pillars: RawPillar[] = [
    {
      label: "年柱",
      value: eightChar.getYear(),
      gan: eightChar.getYearGan(),
      zhi: eightChar.getYearZhi(),
      hideGan: eightChar.getYearHideGan(),
      wuXing: eightChar.getYearWuXing(),
      naYin: eightChar.getYearNaYin(),
      shiShenGan: eightChar.getYearShiShenGan(),
      shiShenZhi: eightChar.getYearShiShenZhi(),
      diShi: eightChar.getYearDiShi(),
      xun: eightChar.getYearXun(),
      xunKong: eightChar.getYearXunKong(),
    },
    {
      label: "月柱",
      value: eightChar.getMonth(),
      gan: eightChar.getMonthGan(),
      zhi: eightChar.getMonthZhi(),
      hideGan: eightChar.getMonthHideGan(),
      wuXing: eightChar.getMonthWuXing(),
      naYin: eightChar.getMonthNaYin(),
      shiShenGan: eightChar.getMonthShiShenGan(),
      shiShenZhi: eightChar.getMonthShiShenZhi(),
      diShi: eightChar.getMonthDiShi(),
      xun: eightChar.getMonthXun(),
      xunKong: eightChar.getMonthXunKong(),
    },
    {
      label: "日柱",
      value: eightChar.getDay(),
      gan: eightChar.getDayGan(),
      zhi: eightChar.getDayZhi(),
      hideGan: eightChar.getDayHideGan(),
      wuXing: eightChar.getDayWuXing(),
      naYin: eightChar.getDayNaYin(),
      shiShenGan: "日主",
      shiShenZhi: eightChar.getDayShiShenZhi(),
      diShi: eightChar.getDayDiShi(),
      xun: eightChar.getDayXun(),
      xunKong: eightChar.getDayXunKong(),
    },
    {
      label: "时柱",
      value: eightChar.getTime(),
      gan: eightChar.getTimeGan(),
      zhi: eightChar.getTimeZhi(),
      hideGan: eightChar.getTimeHideGan(),
      wuXing: eightChar.getTimeWuXing(),
      naYin: eightChar.getTimeNaYin(),
      shiShenGan: eightChar.getTimeShiShenGan(),
      shiShenZhi: eightChar.getTimeShiShenZhi(),
      diShi: eightChar.getTimeDiShi(),
      xun: eightChar.getTimeXun(),
      xunKong: eightChar.getTimeXunKong(),
    },
  ];
  const dayMaster = eightChar.getDayGan();

  return {
    pillars,
    dayMaster,
    dayMasterElement: GAN_ELEMENTS[dayMaster] || "未知",
    relations: evaluateRelations(pillars),
    timeInfo: {
      mode: input.useTrueSolarTime ? "真太阳时" : "北京时间",
      displayTime: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      longitude: timeInfo.longitude,
      offsetMinutes: timeInfo.offsetMinutes,
    },
  };
}

function resolveSolarTime(input: BirthInput) {
  const baseParts = {
    year: Number(input.year),
    month: Number(input.month),
    day: Number(input.day),
    hour: Number(input.hour),
    minute: Number(input.minute),
  };
  const longitude = input.longitude ?? 120;
  const offsetMinutes = input.useTrueSolarTime ? Math.round((longitude - 120) * 4) : 0;
  const date = new Date(
    Date.UTC(
      baseParts.year,
      baseParts.month - 1,
      baseParts.day,
      baseParts.hour,
      baseParts.minute + offsetMinutes,
      0,
    ),
  );

  return {
    longitude,
    offsetMinutes,
    parts: {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    },
  };
}

function evaluateRelations(pillars: RawPillar[]) {
  const relations: RelationItem[] = [];

  for (let i = 0; i < pillars.length; i += 1) {
    for (let j = i + 1; j < pillars.length; j += 1) {
      const left = pillars[i];
      const right = pillars[j];
      const positions = `${left.label}-${right.label}`;
      const stemPair = getPairKey(left.gan, right.gan, Object.keys(STEM_COMBINES));
      const combinePair = getPairKey(left.zhi, right.zhi, Object.keys(BRANCH_COMBINES));
      const clashPair = getPairKey(left.zhi, right.zhi, BRANCH_CLASHES);
      const harmPair = getPairKey(left.zhi, right.zhi, BRANCH_HARMS);
      const breakPair = getPairKey(left.zhi, right.zhi, BRANCH_BREAKS);
      const punishPair = getPairKey(left.zhi, right.zhi, BRANCH_PUNISHES);

      if (stemPair) {
        relations.push(createRelation("天干五合", `${left.gan}${right.gan}`, positions, STEM_COMBINES[stemPair]));
      }

      if (combinePair) {
        relations.push(createRelation("地支六合", `${left.zhi}${right.zhi}`, positions, BRANCH_COMBINES[combinePair]));
      }

      if (clashPair) {
        relations.push(createRelation("地支六冲", `${left.zhi}${right.zhi}`, positions, `${left.zhi}${right.zhi}冲`));
      }

      if (harmPair) {
        relations.push(createRelation("地支相害", `${left.zhi}${right.zhi}`, positions, `${left.zhi}${right.zhi}害`));
      }

      if (breakPair) {
        relations.push(createRelation("地支相破", `${left.zhi}${right.zhi}`, positions, `${left.zhi}${right.zhi}破`));
      }

      if (punishPair) {
        relations.push(createRelation("地支相刑", `${left.zhi}${right.zhi}`, positions, `${left.zhi}${right.zhi}刑`));
      }
    }
  }

  return mergeRelations([...relations, ...evaluateBranchGroups(pillars)]);
}

function evaluateBranchGroups(pillars: RawPillar[]) {
  const relations: RelationItem[] = [];
  const branches = pillars.map((pillar) => pillar.zhi);
  const positions = (matched: string[]) =>
    pillars
      .filter((pillar) => matched.includes(pillar.zhi))
      .map((pillar) => pillar.label)
      .join("-");

  BRANCH_TRI_COMBINES.forEach((group) => {
    const matched = group.branches.filter((branch) => branches.includes(branch));

    if (matched.length === 3) {
      relations.push(createRelation("地支三合", group.branches.join(""), positions(group.branches), `${group.branches.join("")}三合${group.element}`));
    } else if (matched.length === 2) {
      relations.push(createRelation("地支半合", matched.join(""), positions(matched), `${matched.join("")}半合${group.element}`));
    }
  });

  BRANCH_MEETINGS.forEach((group) => {
    const matched = group.branches.filter((branch) => branches.includes(branch));

    if (matched.length === 3) {
      relations.push(createRelation("地支三会", group.branches.join(""), positions(group.branches), `${group.branches.join("")}三会${group.element}`));
    }
  });

  return relations;
}

function createRelation(type: string, pair: string, positions: string, note: string): RelationItem {
  return { type, pair, positions, note };
}

function getPairKey(left: string, right: string, pairs: string[]) {
  return pairs.find((pair) => pair === `${left}${right}` || pair === `${right}${left}`);
}

function mergeRelations(relations: RelationItem[]) {
  const grouped = relations.reduce<Record<string, RelationItem[]>>((result, relation) => {
    const key = `${relation.positions}-${relation.pair}`;
    result[key] = result[key] || [];
    result[key].push(relation);
    return result;
  }, {});

  return Object.values(grouped).map((items) => {
    if (items.length === 1) {
      return items[0];
    }

    const first = items[0];
    return {
      type: items.map((item) => item.type).join("并"),
      pair: first.pair,
      positions: first.positions,
      note: items.map((item) => item.note).join("、"),
    };
  });
}
