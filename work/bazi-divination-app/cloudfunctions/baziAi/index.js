const https = require("https");
const crypto = require("crypto");
const cloudbase = require("@cloudbase/node-sdk");

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "qwen3.5-plus";
const DAILY_LIMIT = 10;
const GLOBAL_LIMIT = 100;
const MAX_INPUT_CHARS = 14000;
const MAX_OUTPUT_TOKENS = 1300;
const REQUEST_TIMEOUT_MS = 90000;
const USERS = "bazi_users";
const SESSIONS = "bazi_sessions";
const USAGE = "bazi_ai_usage";

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});
const db = app.database();

function ok(payload) {
  return { ok: true, ...payload };
}

function fail(error, payload = {}) {
  return { ok: false, error, ...payload };
}

function getConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function verifyToken(token) {
  if (!token) {
    return null;
  }

  const sessionResult = await db
    .collection(SESSIONS)
    .where({ token_hash: hashToken(token) })
    .limit(1)
    .get();
  const session = sessionResult.data && sessionResult.data[0] ? sessionResult.data[0] : null;

  if (!session || session.expires_at < new Date().toISOString()) {
    return null;
  }

  const userResult = await db.collection(USERS).where({ user_id: session.user_id }).limit(1).get();
  const user = userResult.data && userResult.data[0] ? userResult.data[0] : null;

  return user ? { id: user.user_id, username: user.username } : null;
}

function getChinaDayKey(date = new Date()) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return chinaTime.toISOString().slice(0, 10);
}

function getChinaResetAt(date = new Date()) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const nextMidnightUtc = Date.UTC(
    chinaTime.getUTCFullYear(),
    chinaTime.getUTCMonth(),
    chinaTime.getUTCDate() + 1,
    0,
    0,
    0,
  );

  return new Date(nextMidnightUtc - 8 * 60 * 60 * 1000).toISOString();
}

async function getUsage(user) {
  const dayKey = getChinaDayKey();
  const result = await db
    .collection(USAGE)
    .where({
      user_id: user.id,
      day_key: dayKey,
    })
    .limit(100)
    .get();
  const used = (result.data || []).length;

  return {
    dayKey,
    used,
    remaining: Math.max(DAILY_LIMIT - used, 0),
    dailyLimit: DAILY_LIMIT,
    resetAt: getChinaResetAt(),
  };
}

async function recordUsage(user, scope, model, dayKey) {
  await db.collection(USAGE).add({
    user_id: user.id,
    username: user.username,
    day_key: dayKey,
    scope,
    model,
    created_at: new Date().toISOString(),
  });
}

async function getGlobalUsage() {
  const result = await db.collection(USAGE).limit(GLOBAL_LIMIT + 1).get();
  const used = (result.data || []).length;

  return {
    used,
    remaining: Math.max(GLOBAL_LIMIT - used, 0),
    globalLimit: GLOBAL_LIMIT,
  };
}

function toText(value) {
  return JSON.stringify(value, null, 2).slice(0, MAX_INPUT_CHARS);
}

function buildSinglePrompt(payload) {
  return [
    "请基于下面提供的八字排盘数据，写一份更专业、更像真人命理师口吻的中文解盘。",
    "你只能使用输入里已经明确提供的数据，不得杜撰大运、流年、神煞、职业经历、家庭背景、健康事件或任何未给出的信息。",
    "你的目标不是平均罗列信息，而是先抓出这个命盘最核心的矛盾、主轴和成因，再展开分析。",
    "语气要像有经验的命理师：判断清楚，措辞克制，既不要空泛吹捧，也不要故作玄虚。",
    "如果输入里出现“未知”“信息不足”或关键资料不完整，你必须先明确说明哪些部分可以判断，哪些部分不能下定论；只分析已知部分，不要硬凑完整命局。",
    "优先关注：日主旺衰、月令、格局倾向、五行流通、喜忌方向、天干地支之间的关键关系，以及这些信息如何落到性格、学习事业、财运、人际和情感模式上。",
    "请使用下面这个结构，但篇幅可以根据命盘重点略有侧重，不要机械平均分配：",
    "1. 命盘总评：先用 2 到 4 句给出总体判断，直接点出命局主轴。",
    "2. 日主旺衰与格局：说明为什么这样判断，重点写根气、月令、扶抑、泄耗、生克。",
    "3. 五行气势与喜忌：写清五行偏盛偏弱、流通是否顺、喜忌应如何理解。",
    "4. 天干地支关系重点：只挑真正关键的合、冲、刑、害、破、自刑或同气成势，不要流水账全报。",
    "5. 性格与优势短板：从命局结构推出气质、做事方式、优点和容易失衡的地方。",
    "6. 学业事业与财运：结合命局结构写适合的发力方式、风险点和积累方式，不要写成成功学。",
    "7. 感情与人际：结合日主、配偶宫、整体结构写互动模式、相处习惯和容易卡住的点。",
    "8. 总结建议：给出务实、可落地的收束建议，像命理师给来访者的提醒。",
    "不要重复基础字段，不要大段免责声明，不要写成套话文章。",
    "最后一行必须单独输出：解读完成。",
    "",
    "排盘数据：",
    toText(payload),
  ].join("\n");
}

function buildCompatibilityPrompt(payload) {
  return [
    "请基于下面两张八字命盘和已有合盘分析结果，写一份更专业、更像真人命理师口吻的中文合盘解读。",
    "你只能使用输入里已经明确提供的数据，不得杜撰大运、流年、现实经历、情史、婚史或任何未提供的信息。",
    "你的任务不是泛泛夸双方有缘，而是判断这段关系的底色、吸引点、冲突点和长期磨合重点。",
    "语气要像真正做合盘分析的人：既能指出相合之处，也敢点出结构性的磨合压力，但不要绝对化断言。",
    "如果输入里存在“未知”“信息不足”或命盘资料不完整，你必须先说明判断边界：哪些结论是可以成立的，哪些只能保留，不要硬做完整关系推演。",
    "优先关注：双方日主关系、五行互补与失衡、四柱互动、配偶宫信息、相处优势、冲突来源、现实相处建议。",
    "请使用下面这个结构，但要围绕重点展开，不要平均抄模板：",
    "1. 合盘总评：先概括这段关系的整体底色与主轴。",
    "2. 日主与五行关系：说明双方能量是互补、相生、相克还是彼此消耗，关键原因是什么。",
    "3. 四柱互动重点：只写真正关键的合、冲、刑、害、破及其影响，不要铺满无关细节。",
    "4. 配偶宫与情感模式：说明彼此在亲密关系中的习惯、期待与敏感点。",
    "5. 相处优势：写这段关系容易形成的支持、吸引和合作方式。",
    "6. 磨合难点：写冲突最容易出现在哪里，为什么会出现。",
    "7. 现实建议：给出务实、具体、可操作的相处提醒。",
    "不要写空泛祝福，不要强行圆满，也不要把普通冲突说成命定灾难。",
    "最后一行必须单独输出：解读完成。",
    "",
    "合盘数据：",
    toText(payload),
  ].join("\n");
}

function buildPrompt(scope, payload) {
  return scope === "compatibility" ? buildCompatibilityPrompt(payload) : buildSinglePrompt(payload);
}

function requestJson(url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: parsedUrl.hostname,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        port: parsedUrl.port || 443,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];

        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");

          try {
            const data = raw ? JSON.parse(raw) : {};

            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(data.error && data.error.message ? data.error.message : `AI 接口返回 ${res.statusCode}`));
              return;
            }

            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("AI 接口请求超时"));
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function createReading(event) {
  const scope = event.scope === "compatibility" ? "compatibility" : "single";
  const { apiKey, baseUrl, model } = getConfig();
  const user = await verifyToken(event.token);

  if (!apiKey) {
    return fail("请先在 baziAi 云函数环境变量中配置 AI_API_KEY。");
  }

  if (!user) {
    return fail("请先登录，再使用 AI 解盘。");
  }

  if (!event.payload || typeof event.payload !== "object") {
    return fail("缺少 AI 解盘所需的命盘数据。");
  }

  const usage = await getUsage(user);

  if (usage.remaining <= 0) {
    return fail(`今日 AI 解盘次数已用完。每个账号每天最多 ${usage.dailyLimit} 次，明天再来试试。`, {
      dailyLimit: usage.dailyLimit,
      remaining: 0,
      resetAt: usage.resetAt,
    });
  }

  const globalUsage = await getGlobalUsage();

  if (globalUsage.remaining <= 0) {
    return fail("当前 AI 生成功能的共享总额度已用完，请稍后再试。", {
      dailyLimit: usage.dailyLimit,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    });
  }

  const data = await requestJson(`${baseUrl}/chat/completions`, apiKey, {
    model,
    temperature: 0.45,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "system",
        content:
          "你是一位有分寸、有判断力的中文命理分析助手，表达要像经验足够的命理师。你必须严格基于输入数据分析，不补造不存在的信息，不乱下过满结论，不写空泛鸡汤，也不要反复堆砌免责声明。若资料完整，就抓住命局主轴做判断；若资料不足，就先讲清判断边界，只分析已知部分，并明确哪些地方不能下定论。输出要有层次，但不要写成机械模板。",
      },
      {
        role: "user",
        content: buildPrompt(scope, event.payload),
      },
    ],
  });

  const content =
    data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";

  if (!content) {
    return fail("AI 接口没有返回解盘内容。", {
      dailyLimit: usage.dailyLimit,
      remaining: usage.remaining,
      resetAt: usage.resetAt,
    });
  }

  await recordUsage(user, scope, model, usage.dayKey);

  return ok({
    content,
    dailyLimit: usage.dailyLimit,
    remaining: Math.max(usage.remaining - 1, 0),
    resetAt: usage.resetAt,
  });
}

async function getUsageInfo(event) {
  const user = await verifyToken(event.token);

  if (!user) {
    return fail("请先登录，再查看 AI 解盘额度。");
  }

  const usage = await getUsage(user);
  return ok({
    dailyLimit: usage.dailyLimit,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
  });
}

exports.main = async (event = {}) => {
  try {
    if (event.action === "usage") {
      return getUsageInfo(event);
    }

    if (event.action === "reading") {
      return createReading(event);
    }

    return fail("未知操作。");
  } catch (error) {
    return fail(error && error.message ? error.message : String(error));
  }
};
