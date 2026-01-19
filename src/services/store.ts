import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface UsageRecord {
  id: string;
  timestamp: string;
  user: string;
  question: string;
  action: "shake" | "interpret" | "followup";
  location?: string;
  amount?: number;
  paymentId?: string;
}

interface PaymentRecord {
  id: string;
  timestamp: string;
  user: string;
  amount: number;
  status: "success" | "failed";
  description?: string;
  orderId?: string;
}

interface StoreData {
  usage: UsageRecord[];
  payments: PaymentRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../../data/records.json");

function ensureStoreFile() {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(storePath)) {
    const empty: StoreData = { usage: [], payments: [] };
    fs.writeFileSync(storePath, JSON.stringify(empty, null, 2), "utf-8");
  }
}

function readStore(): StoreData {
  ensureStoreFile();
  const raw = fs.readFileSync(storePath, "utf-8");
  return JSON.parse(raw) as StoreData;
}

function writeStore(data: StoreData) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
}

export function appendUsage(record: Omit<UsageRecord, "id" | "timestamp">) {
  const data = readStore();
  data.usage.push({
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...record,
  });
  writeStore(data);
}

export function appendPayment(record: Omit<PaymentRecord, "id" | "timestamp" | "status"> & { status?: PaymentRecord["status"] }) {
  const data = readStore();
  data.payments.push({
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    status: record.status ?? "success",
    ...record,
  });
  writeStore(data);
}

export function readSummary() {
  const data = readStore();
  const totalRevenue = data.payments
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + p.amount, 0);

  const usageCount = data.usage.length;

  // 按日期汇总
  const byDate: Record<string, number> = {};
  data.usage.forEach((u) => {
    const day = u.timestamp.slice(0, 10);
    byDate[day] = (byDate[day] || 0) + 1;
  });

  return {
    usage: data.usage,
    payments: data.payments,
    totalRevenue,
    usageCount,
    byDate,
  };
}

