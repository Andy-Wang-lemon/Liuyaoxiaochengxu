import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");
const USAGE_FILE = path.join(DATA_DIR, "usage.json");
const PAYMENT_FILE = path.join(DATA_DIR, "payments.json");
// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
// 读取使用记录
function readUsageRecords() {
    try {
        if (fs.existsSync(USAGE_FILE)) {
            const data = fs.readFileSync(USAGE_FILE, "utf-8");
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error("读取使用记录失败:", error);
    }
    return [];
}
// 保存使用记录
function saveUsageRecords(records) {
    try {
        fs.writeFileSync(USAGE_FILE, JSON.stringify(records, null, 2), "utf-8");
    }
    catch (error) {
        console.error("保存使用记录失败:", error);
    }
}
// 读取支付记录
function readPaymentRecords() {
    try {
        if (fs.existsSync(PAYMENT_FILE)) {
            const data = fs.readFileSync(PAYMENT_FILE, "utf-8");
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error("读取支付记录失败:", error);
    }
    return [];
}
// 保存支付记录
export function savePaymentRecords(records) {
    try {
        fs.writeFileSync(PAYMENT_FILE, JSON.stringify(records, null, 2), "utf-8");
    }
    catch (error) {
        console.error("保存支付记录失败:", error);
    }
}
// 添加使用记录
export function addUsageRecord(record) {
    const records = readUsageRecords();
    const newRecord = {
        ...record,
        id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
    };
    records.push(newRecord);
    saveUsageRecords(records);
    return newRecord;
}
// 添加支付记录
export function addPaymentRecord(record) {
    const records = readPaymentRecords();
    const newRecord = {
        ...record,
        id: `payment_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        timestamp: new Date().toISOString(),
    };
    records.push(newRecord);
    savePaymentRecords(records);
    return newRecord;
}
// 获取所有使用记录
export function getAllUsageRecords() {
    return readUsageRecords();
}
// 获取所有支付记录
export function getAllPaymentRecords() {
    return readPaymentRecords();
}
// 获取统计数据
export function getStatistics() {
    const usageRecords = readUsageRecords();
    const paymentRecords = readPaymentRecords();
    // 总使用次数
    const totalUsage = usageRecords.length;
    // 总支付金额（单位：元）
    const totalAmount = paymentRecords
        .filter((p) => p.status === "success")
        .reduce((sum, p) => sum + p.amount, 0) / 100;
    // 成功支付次数
    const successfulPayments = paymentRecords.filter((p) => p.status === "success").length;
    // 按日期统计使用量
    const usageByDate = {};
    usageRecords.forEach((record) => {
        const date = new Date(record.timestamp).toISOString().split("T")[0];
        usageByDate[date] = (usageByDate[date] || 0) + 1;
    });
    // 按日期统计支付金额
    const paymentByDate = {};
    paymentRecords
        .filter((p) => p.status === "success")
        .forEach((record) => {
        const date = new Date(record.timestamp).toISOString().split("T")[0];
        paymentByDate[date] = (paymentByDate[date] || 0) + record.amount / 100;
    });
    return {
        totalUsage,
        totalAmount,
        successfulPayments,
        usageByDate,
        paymentByDate,
    };
}
