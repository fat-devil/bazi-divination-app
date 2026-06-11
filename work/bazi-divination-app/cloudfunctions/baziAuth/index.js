const crypto = require("crypto");
const cloudbase = require("@cloudbase/node-sdk");

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const USERS = "bazi_users";
const SESSIONS = "bazi_sessions";
const TOKEN_DAYS = 30;

function ok(payload) {
  return { ok: true, ...payload };
}

function fail(error) {
  return { ok: false, error };
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  if (!username) {
    return "请先输入账号。";
  }

  if (username.length < 3 || username.length > 64) {
    return "账号长度需要在 3-64 位之间。";
  }

  if (/\s/.test(username)) {
    return "账号不能包含空格。";
  }

  return "";
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 6) {
    return "密码至少需要 6 位。";
  }

  if (password.length > 72) {
    return "密码最多 72 位。";
  }

  return "";
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}

function publicUser(user) {
  return {
    id: user.user_id,
    username: user.username,
  };
}

async function findUser(username) {
  const result = await db.collection(USERS).where({ username }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : null;
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await db.collection(SESSIONS).add({
    token_hash: hashToken(token),
    user_id: user.user_id,
    username: user.username,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return token;
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
  return userResult.data && userResult.data[0] ? userResult.data[0] : null;
}

async function register(event) {
  const username = normalizeUsername(event.username);
  const password = event.password;
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);

  if (usernameError) {
    return fail(usernameError);
  }

  if (passwordError) {
    return fail(passwordError);
  }

  const existing = await findUser(username);

  if (existing) {
    return fail("这个账号已经注册过，请直接登录。");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const user = {
    user_id: createId("user"),
    username,
    password_salt: salt,
    password_hash: hashPassword(password, salt),
    created_at: now,
    updated_at: now,
  };

  await db.collection(USERS).add(user);

  const token = await createSession(user);
  return ok({ token, user: publicUser(user) });
}

async function login(event) {
  const username = normalizeUsername(event.username);
  const password = event.password;
  const user = await findUser(username);

  if (!user) {
    return fail("账号或密码不正确。");
  }

  const passwordHash = hashPassword(password, user.password_salt);

  if (
    passwordHash.length !== user.password_hash.length ||
    !crypto.timingSafeEqual(Buffer.from(passwordHash), Buffer.from(user.password_hash))
  ) {
    return fail("账号或密码不正确。");
  }

  const token = await createSession(user);
  return ok({ token, user: publicUser(user) });
}

async function verify(event) {
  const user = await verifyToken(event.token);

  if (!user) {
    return fail("登录已过期，请重新登录。");
  }

  return ok({ user: publicUser(user) });
}

exports.main = async (event = {}) => {
  try {
    if (event.action === "register") {
      return register(event);
    }

    if (event.action === "login") {
      return login(event);
    }

    if (event.action === "verify") {
      return verify(event);
    }

    return fail("未知操作。");
  } catch (error) {
    return fail(error && error.message ? error.message : String(error));
  }
};
