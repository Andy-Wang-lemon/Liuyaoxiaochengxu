import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "app.db");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  createdAt INTEGER NOT NULL,
  lastSeenAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY,
  userId TEXT,
  action TEXT,
  question TEXT,
  amount INTEGER DEFAULT 0,
  model TEXT,
  status TEXT,
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_logs (
  id TEXT PRIMARY KEY,
  userId TEXT,
  orderId TEXT,
  amount INTEGER NOT NULL,
  status TEXT,
  createdAt INTEGER NOT NULL
);
`);

function ensureUser(userId: string) {
  const now = Date.now();
  const stmt = db.prepare("SELECT id FROM users WHERE id = ?");
  const row = stmt.get(userId);
  if (!row) {
    db.prepare(
      "INSERT INTO users (id, createdAt, lastSeenAt) VALUES (?, ?, ?)",
    ).run(userId, now, now);
  } else {
    db.prepare("UPDATE users SET lastSeenAt = ? WHERE id = ?").run(now, userId);
  }
}

function logUsage({
  userId,
  action,
  question,
  amount = 0,
  model,
  status = "ok",
}: {
  userId: string;
  action: string;
  question?: string;
  amount?: number;
  model?: string;
  status?: string;
}) {
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO usage_logs (id, userId, action, question, amount, model, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, userId, action, question ?? "", amount ?? 0, model ?? "", status, createdAt);
}

function logPayment({
  userId,
  orderId,
  amount,
  status = "success",
}: {
  userId: string;
  orderId: string;
  amount: number;
  status?: string;
}) {
  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO payment_logs (id, userId, orderId, amount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, userId, orderId, amount, status, createdAt);
}

function getStats() {
  const totalUsers = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as any)?.n ?? 0;
  const totalUsage = (db.prepare("SELECT COUNT(*) AS n FROM usage_logs").get() as any)?.n ?? 0;
  const totalRevenue =
    ((db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM payment_logs WHERE status='success'").get() as any)
      ?.s ?? 0) / 100;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const ts = startOfToday.getTime();
  const todayUsage =
    (db.prepare("SELECT COUNT(*) AS n FROM usage_logs WHERE createdAt >= ?").get(ts) as any)?.n ?? 0;
  const todayRevenue =
    ((db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) AS s FROM payment_logs WHERE status='success' AND createdAt >= ?",
      )
      .get(ts) as any)?.s ?? 0) / 100;

  // 最近7天柱状图
  const days = 7;
  const usageDaily: { date: string; count: number }[] = [];
  const revenueDaily: { date: string; amount: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const dateStr = d.toISOString().slice(0, 10);
    const uc =
      (db
        .prepare("SELECT COUNT(*) AS n FROM usage_logs WHERE createdAt >= ? AND createdAt < ?")
        .get(start, end) as any)?.n ?? 0;
    const rev =
      ((db
        .prepare(
          "SELECT COALESCE(SUM(amount),0) AS s FROM payment_logs WHERE status='success' AND createdAt >= ? AND createdAt < ?",
        )
        .get(start, end) as any)?.s ?? 0) / 100;
    usageDaily.push({ date: dateStr, count: uc });
    revenueDaily.push({ date: dateStr, amount: rev });
  }

  return {
    totalUsers,
    totalUsage,
    totalRevenue,
    todayUsage,
    todayRevenue,
    usageDaily,
    revenueDaily,
  };
}

function getUsageLogs(limit = 200) {
  return db
    .prepare(
      "SELECT id, userId, action, question, amount, model, status, createdAt FROM usage_logs ORDER BY createdAt DESC LIMIT ?",
    )
    .all(limit) as any[];
}

function getPaymentLogs(limit = 200) {
  return db
    .prepare(
      "SELECT id, userId, orderId, amount, status, createdAt FROM payment_logs ORDER BY createdAt DESC LIMIT ?",
    )
    .all(limit) as any[];
}

function updatePaymentStatus(orderId: string, status: string) {
  db.prepare(
    "UPDATE payment_logs SET status = ? WHERE orderId = ?",
  ).run(status, orderId);
}

function getPaymentByOrderId(orderId: string) {
  return db.prepare(
    "SELECT * FROM payment_logs WHERE orderId = ?",
  ).get(orderId) as any;
}

export {
  db,
  ensureUser,
  logUsage,
  logPayment,
  updatePaymentStatus,
  getPaymentByOrderId,
  getStats,
  getUsageLogs,
  getPaymentLogs,
};

