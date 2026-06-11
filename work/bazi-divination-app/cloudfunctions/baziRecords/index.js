const crypto = require("crypto");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const PROFILES = "bazi_profiles";
const SESSIONS = "bazi_sessions";
const USERS = "bazi_users";
const AI_READINGS = "bazi_ai_readings";

function ok(payload) {
  return { ok: true, ...payload };
}

function fail(error) {
  return { ok: false, error };
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

function normalizeRecord(doc) {
  return {
    ...doc,
    id: doc.id || doc._id,
  };
}

function normalizeAiReading(doc) {
  return {
    ...doc,
    id: doc.id || doc._id,
  };
}

function getTargetKey(target) {
  if (!target || typeof target !== "object") {
    return "";
  }

  if (target.scope === "single" && target.profileId) {
    return `single:${target.profileId}`;
  }

  if (target.scope === "compatibility" && target.leftProfileId && target.rightProfileId) {
    return `compatibility:${target.leftProfileId}:${target.rightProfileId}`;
  }

  return "";
}

async function getOwnedProfile(user, profileId) {
  if (!profileId) {
    return null;
  }

  const result = await db
    .collection(PROFILES)
    .where({
      _id: profileId,
      user_id: user.id,
    })
    .limit(1)
    .get();

  return result.data && result.data[0] ? result.data[0] : null;
}

async function validateAiReadingTarget(user, target) {
  const targetKey = getTargetKey(target);

  if (!targetKey) {
    return { error: "AI 解盘保存目标不完整。", targetKey: "" };
  }

  if (target.scope === "single") {
    const profile = await getOwnedProfile(user, target.profileId);

    if (!profile) {
      return { error: "请先保存当前命盘，再保存 AI 解盘。", targetKey: "" };
    }

    return { error: "", targetKey };
  }

  const left = await getOwnedProfile(user, target.leftProfileId);
  const right = await getOwnedProfile(user, target.rightProfileId);

  if (!left || !right || target.leftProfileId === target.rightProfileId) {
    return { error: "合盘 AI 解盘需要两条已保存的命盘记录。", targetKey: "" };
  }

  return { error: "", targetKey };
}

async function listRecords(user) {
  const result = await db
    .collection(PROFILES)
    .where({ user_id: user.id })
    .orderBy("created_at", "desc")
    .get();

  return ok({ records: (result.data || []).map(normalizeRecord) });
}

async function createRecord(user, record) {
  if (!record || typeof record !== "object") {
    return fail("记录内容不能为空。");
  }

  if (!record.name || !record.birth_date || !record.birth_time || !record.bazi_result) {
    return fail("记录内容不完整。");
  }

  if (record.profile_fingerprint) {
    const existing = await db
      .collection(PROFILES)
      .where({
        user_id: user.id,
        profile_fingerprint: record.profile_fingerprint,
      })
      .limit(1)
      .get();

    if (existing.data && existing.data.length > 0) {
      return fail("这条命盘已经保存过了。");
    }
  }

  const now = new Date().toISOString();

  const nextRecord = {
    ...record,
    user_id: user.id,
    username: user.username,
    created_at: record.created_at || now,
    updated_at: now,
  };
  const addResult = await db.collection(PROFILES).add(nextRecord);

  return ok({ record: normalizeRecord({ ...nextRecord, id: addResult.id }) });
}

async function deleteRecord(user, recordId) {
  if (!recordId) {
    return fail("缺少记录 ID。");
  }

  await db
    .collection(PROFILES)
    .where({
      _id: recordId,
      user_id: user.id,
    })
    .remove();

  return ok({});
}

async function getAiReading(user, target) {
  const validation = await validateAiReadingTarget(user, target);

  if (validation.error) {
    return fail(validation.error);
  }

  if (target.scope === "single") {
    const profile = await getOwnedProfile(user, target.profileId);

    if (!profile || !profile.ai_reading_content) {
      return ok({ reading: null });
    }

    return ok({
      reading: normalizeAiReading({
        id: `${profile._id || target.profileId}:ai`,
        target_key: validation.targetKey,
        scope: "single",
        profile_id: target.profileId,
        content: profile.ai_reading_content,
        created_at: profile.ai_reading_created_at || profile.ai_reading_updated_at || profile.updated_at || profile.created_at,
        updated_at: profile.ai_reading_updated_at || profile.updated_at || profile.created_at,
      }),
    });
  }

  const result = await db
    .collection(AI_READINGS)
    .where({
      user_id: user.id,
      target_key: validation.targetKey,
    })
    .limit(1)
    .get();
  const reading = result.data && result.data[0] ? normalizeAiReading(result.data[0]) : null;

  return ok({ reading });
}

async function upsertAiReading(user, target, content) {
  if (!content || typeof content !== "string" || !content.trim()) {
    return fail("AI 解盘内容不能为空。");
  }

  const validation = await validateAiReadingTarget(user, target);

  if (validation.error) {
    return fail(validation.error);
  }

  if (target.scope === "single") {
    const profile = await getOwnedProfile(user, target.profileId);
    const now = new Date().toISOString();
    const hadReading = Boolean(profile && profile.ai_reading_content);

    await db.collection(PROFILES).doc(target.profileId).update({
      ai_reading_content: content.trim(),
      ai_reading_created_at: profile.ai_reading_created_at || now,
      ai_reading_updated_at: now,
      updated_at: now,
    });

    return ok({
      reading: normalizeAiReading({
        id: `${target.profileId}:ai`,
        target_key: validation.targetKey,
        scope: "single",
        profile_id: target.profileId,
        content: content.trim(),
        created_at: profile.ai_reading_created_at || now,
        updated_at: now,
      }),
      saved: !hadReading,
      updated: hadReading,
    });
  }

  const existingResult = await db
    .collection(AI_READINGS)
    .where({
      user_id: user.id,
      target_key: validation.targetKey,
    })
    .limit(1)
    .get();
  const existing = existingResult.data && existingResult.data[0] ? existingResult.data[0] : null;
  const now = new Date().toISOString();
  const nextDoc = {
    user_id: user.id,
    username: user.username,
    target_key: validation.targetKey,
    scope: target.scope,
    profile_id: target.scope === "single" ? target.profileId : "",
    left_profile_id: target.scope === "compatibility" ? target.leftProfileId : "",
    right_profile_id: target.scope === "compatibility" ? target.rightProfileId : "",
    content: content.trim(),
    created_at: existing ? existing.created_at || now : now,
    updated_at: now,
  };

  if (existing) {
    await db
      .collection(AI_READINGS)
      .where({
        _id: existing._id,
        user_id: user.id,
      })
      .remove();
  }

  const addResult = await db.collection(AI_READINGS).add(nextDoc);

  return ok({
    reading: normalizeAiReading({ ...nextDoc, id: addResult.id }),
    saved: !existing,
    updated: Boolean(existing),
  });
}

exports.main = async (event = {}) => {
  try {
    const user = await verifyToken(event.token);

    if (!user) {
      return fail("登录已过期，请重新登录。");
    }

    if (event.action === "list") {
      return listRecords(user);
    }

    if (event.action === "create") {
      return createRecord(user, event.record);
    }

    if (event.action === "delete") {
      return deleteRecord(user, event.recordId);
    }

    if (event.action === "getAiReading") {
      return getAiReading(user, event.target);
    }

    if (event.action === "upsertAiReading") {
      return upsertAiReading(user, event.target, event.content);
    }

    return fail("未知操作。");
  } catch (error) {
    return fail(error && error.message ? error.message : String(error));
  }
};
