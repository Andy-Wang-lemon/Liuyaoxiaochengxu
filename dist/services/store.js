import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storePath = path.resolve(__dirname, "../../data/records.json");
function ensureStoreFile() {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(storePath)) {
        const empty = { usage: [], payments: [] };
        fs.writeFileSync(storePath, JSON.stringify(empty, null, 2), "utf-8");
    }
}
function readStore() {
    ensureStoreFile();
    const raw = fs.readFileSync(storePath, "utf-8");
    return JSON.parse(raw);
}
function writeStore(data) {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), "utf-8");
}
export function appendUsage(record) {
    const data = readStore();
    data.usage.push({
        id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        ...record,
    });
    writeStore(data);
}
export function appendPayment(record) {
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
    const byDate = {};
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
