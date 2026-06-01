import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  ensureUser,
  logUsage,
  logPayment,
  updatePaymentStatus,
  getPaymentByOrderId,
  getStats,
  getUsageLogs,
  getPaymentLogs,
} from "./db.js";
import XLSX from "xlsx";
import { calculate } from "./services/hexagram.js";
import { validateInput } from "./utils/validation.js";
import { InputPayload, LineResult } from "./types.js";
import { DateTime } from "luxon";
import { interpretWithGemini } from "./services/interpret.js";
import {
  createNativePayment,
  queryOrder,
  verifyNotifySignature,
  decryptNotifyData,
  checkWechatPayConfig,
} from "./services/wechat-pay.js";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3003;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin";

// 检查微信支付配置
const WECHAT_PAY_ENABLED = checkWechatPayConfig();
if (WECHAT_PAY_ENABLED) {
  console.log("✓ 微信支付已启用");
} else {
  console.warn("⚠ 微信支付未配置，将使用模拟支付模式");
}

// 静态文件目录（Vue构建后的文件）
const FRONTEND_DIR = path.resolve(__dirname, "../dist-frontend");
const PUBLIC_DIR = path.resolve(__dirname, "../public");

function getCookie(req: http.IncomingMessage, name: string) {
  const cookies = req.headers.cookie;
  if (!cookies) return undefined;
  const found = cookies
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="));
  if (!found) return undefined;
  return decodeURIComponent(found.split("=")[1]);
}

function setCookie(res: http.ServerResponse, name: string, value: string, days = 365) {
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires.toUTCString()}; HttpOnly`;
  res.setHeader("Set-Cookie", cookie);
}

function decodeBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((v, k) => {
    result[k] = v;
  });
  return result;
}

function parseLines(form: Record<string, string>): LineResult[] {
  const lines: LineResult[] = [];
  let idx = 0;
  while (form[`line${idx}_index`]) {
    lines.push({
      index: Number(form[`line${idx}_index`]),
      type: form[`line${idx}_type`] as "yin" | "yang",
      isMoving: form[`line${idx}_isMoving`] === "true",
    });
    idx++;
  }
  return lines;
}

function formatResult(payload: InputPayload) {
  const result = calculate(payload);
  const localTime = DateTime.fromISO(payload.datetime, { zone: payload.timezone });

  const lines = result.hexagram.lines
    .map((line) => {
      const glyph = line.type === "yang" ? "—" : "— —";
      const movingMark = line.isMoving ? "动" : "静";
      return `第${line.index}爻：${glyph} ${line.relation}（${movingMark}）`;
    })
    .join("\n");

  return [
    `测算人：${payload.querentName}`,
    `地点：${payload.location}`,
    `时区：${payload.timezone}`,
    `时间：${localTime.toISO({ suppressMilliseconds: true })}`,
    `所问：${payload.question}`,
    ``,
    `【四柱】`,
    `年柱：${result.pillars.year}`,
    `月柱：${result.pillars.month}`,
    `日柱：${result.pillars.day}`,
    `时柱：${result.pillars.hour}`,
    ``,
    `【六爻】`,
    `日干支：${result.hexagram.dayGanZhi}`,
    `所属宫位：${result.hexagram.palace}`,
    `世爻：第 ${result.hexagram.shiYing.shi} 爻；应爻：第 ${result.hexagram.shiYing.ying} 爻`,
    `爻序自下而上（初爻=1）：`,
    lines,
  ].join("\n");
}

function serveStaticFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };

  const contentType = contentTypeMap[ext] || "application/octet-stream";

  try {
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("File not found");
      return;
    }

    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Error reading file");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let userId = getCookie(req, "uid");
  if (!userId) {
    userId = randomUUID();
    setCookie(res, "uid", userId);
  }
  ensureUser(userId);

  // CORS 头
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API 路由
  if (url.pathname.startsWith("/api/")) {
    const apiPath = url.pathname.replace("/api", "");

    // 摇卦API
    if (req.method === "POST" && apiPath === "/shake") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on("end", () => {
        try {
          let payload: InputPayload;
          let lines: LineResult[];

          // 检查是否为JSON格式
          const contentType = req.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            // JSON格式
            const jsonData = JSON.parse(body);
            lines = jsonData.lines || [];
            payload = {
              location: jsonData.location ?? "",
              timezone: jsonData.timezone ?? "",
              datetime: jsonData.datetime ?? "",
              querentName: jsonData.querentName ?? "",
              question: jsonData.question ?? "",
              lines: lines,
            };
          } else {
            // Form格式
            const form = decodeBody(body);
            lines = parseLines(form);
            payload = {
              location: form.location ?? "",
              timezone: form.timezone ?? "",
              datetime: form.datetime ?? "",
              querentName: form.querentName ?? "",
              question: form.question ?? "",
              lines: lines,
            };
          }

          if (lines.length !== 6) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "请完成六次摇卦" }));
            return;
          }
          validateInput(payload);
          // 后端排盘，但不返回详细结果
          const result = calculate(payload);
          logUsage({
            userId,
            action: "shake",
            question: payload.question,
            amount: 0,
            status: "ok",
          });
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          // 只返回成功标识，不返回排盘详细内容
          res.end(JSON.stringify({ success: true, message: "排盘完成，请支付后查看结果" }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // 解卦API
    if (req.method === "POST" && apiPath === "/interpret") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on("end", async () => {
        try {
          let payload: InputPayload;
          let lines: LineResult[];

          // 检查是否为JSON格式
          const contentType = req.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            // JSON格式
            const jsonData = JSON.parse(body);
            lines = jsonData.lines || [];
            payload = {
              location: jsonData.location ?? "",
              timezone: jsonData.timezone ?? "",
              datetime: jsonData.datetime ?? "",
              querentName: jsonData.querentName ?? "",
              question: jsonData.question ?? "",
              lines: lines.length > 0 ? lines : undefined,
            };
          } else {
            // Form格式
            const form = decodeBody(body);
            lines = parseLines(form);
            payload = {
              location: form.location ?? "",
              timezone: form.timezone ?? "",
              datetime: form.datetime ?? "",
              querentName: form.querentName ?? "",
              question: form.question ?? "",
              lines: lines.length > 0 ? lines : undefined,
            };
          }
          
          validateInput(payload);
          const result = calculate(payload);
          const output = formatResult(payload);
          const interpretation = await interpretWithGemini(payload, result);

          // 检查是否为追问
          const isFollowUp = contentType.includes('application/json') 
            ? JSON.parse(body).isFollowUp === true
            : decodeBody(body).isFollowUp === "true";
          logUsage({
            userId,
            action: isFollowUp ? "followup" : "interpret",
            question: payload.question || "未填写",
            amount: 0,
            status: "ok",
          });

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          // 返回排盘结果和解卦结果
          res.end(JSON.stringify({ output, interpretation }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // 创建支付订单
    if (req.method === "POST" && apiPath === "/create-payment") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const amount = data.amount || 300; // 默认3元（300分）
          const description = data.description || "六爻解卦服务";
          const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

          // 记录支付订单（状态为pending）
          logPayment({
            userId,
            orderId,
            amount,
            status: "pending",
          });

          if (WECHAT_PAY_ENABLED) {
            // 真实微信支付
            try {
              const paymentResult = await createNativePayment(orderId, amount, description);
              
              // 生成二维码
              const qrCodeDataUrl = await QRCode.toDataURL(paymentResult.code_url);

              res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({
                code: 0,
                message: "订单创建成功",
                orderId: orderId,
                amount: amount,
                qrCode: qrCodeDataUrl,
                codeUrl: paymentResult.code_url,
              }));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ code: -1, message: "创建微信支付订单失败：" + message }));
            }
          } else {
            // 模拟支付模式（开发测试用）
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              code: 0,
              message: "订单创建成功（模拟模式）",
              orderId: orderId,
              amount: amount,
              mockMode: true,
            }));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: -1, message: "创建订单失败：" + message }));
        }
      });
      return;
    }

    // 查询订单状态
    if (req.method === "GET" && apiPath === "/query-order") {
      const orderId = url.searchParams.get("orderId");
      if (!orderId) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ code: -1, message: "订单号不能为空" }));
        return;
      }

      (async () => {
        try {
          if (WECHAT_PAY_ENABLED) {
            const orderInfo = await queryOrder(orderId);
            const isPaid = orderInfo.trade_state === "SUCCESS";
            
            if (isPaid) {
              // 更新数据库中的支付状态
              updatePaymentStatus(orderId, "success");
            }

            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              code: 0,
              isPaid: isPaid,
              tradeState: orderInfo.trade_state,
              message: isPaid ? "支付成功" : "未支付",
            }));
          } else {
            // 模拟模式：直接返回成功并更新状态
            updatePaymentStatus(orderId, "success");
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({
              code: 0,
              isPaid: true,
              mockMode: true,
              message: "支付成功（模拟模式）",
            }));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: -1, message: "查询订单失败：" + message }));
        }
      })();
      return;
    }

    // 微信支付回调通知
    if (req.method === "POST" && apiPath === "/payment-notify") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const timestamp = req.headers["wechatpay-timestamp"] as string;
          const nonce = req.headers["wechatpay-nonce"] as string;
          const signature = req.headers["wechatpay-signature"] as string;
          const serialNo = req.headers["wechatpay-serial"] as string;

          // 验证签名
          const isValid = verifyNotifySignature(timestamp, nonce, body, signature, serialNo);
          if (!isValid) {
            res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ code: "FAIL", message: "签名验证失败" }));
            return;
          }

          // 解密数据
          const notifyData = JSON.parse(body);
          const resource = notifyData.resource;
          const decryptedData = decryptNotifyData(
            resource.ciphertext,
            resource.associated_data,
            resource.nonce
          );

          // 处理支付成功
          if (decryptedData.trade_state === "SUCCESS") {
            const orderId = decryptedData.out_trade_no;
            // 更新数据库中的支付状态
            updatePaymentStatus(orderId, "success");
            console.log("支付成功:", orderId);
          }

          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "SUCCESS", message: "成功" }));
        } catch (err) {
          console.error("处理支付回调失败:", err);
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: "FAIL", message: "处理失败" }));
        }
      });
      return;
    }

    // 支付成功确认（前端调用）
    if (req.method === "POST" && apiPath === "/payment-success") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          const orderId = data.orderId;

          if (!orderId) {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ code: -1, message: "订单号不能为空" }));
            return;
          }

          // 查询订单状态
          if (WECHAT_PAY_ENABLED) {
            const orderInfo = await queryOrder(orderId);
            const isPaid = orderInfo.trade_state === "SUCCESS";

            if (isPaid) {
              res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ code: 0, message: "支付成功" }));
            } else {
              res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ code: -1, message: "订单未支付" }));
            }
          } else {
            // 模拟模式：直接返回成功
            res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ code: 0, message: "支付成功（模拟模式）" }));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ code: -1, message: "处理失败：" + message }));
        }
      });
      return;
    }

    // 管理后台API
    if (req.method === "GET" && apiPath === "/admin/data") {
      const token = url.searchParams.get("token");
      if (token !== ADMIN_TOKEN) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        const stats = getStats();
        const usageLogs = getUsageLogs(200) as any[];
        const paymentLogs = getPaymentLogs(200) as any[];
        const usageByDate: Record<string, number> = {};
        const paymentAmountByDate: Record<string, number> = {};
        stats.usageDaily.forEach((d) => (usageByDate[d.date] = d.count));
        stats.revenueDaily.forEach((d) => (paymentAmountByDate[d.date] = d.amount));

        const usageRecords = usageLogs.map((u: any) => ({
          timestamp: u.createdAt,
          userName: u.userId,
          question: u.question,
          location: "",
          type: u.action === "followup" ? "followup" : "initial",
        }));
        const paymentRecords = paymentLogs.map((p: any) => ({
          timestamp: p.createdAt,
          userName: p.userId,
          amount: p.amount,
          description: "六爻解卦服务",
          orderId: p.orderId,
          status: p.status,
        }));
        const statistics = {
          totalUsage: stats.totalUsage,
          totalAmount: stats.totalRevenue,
          successfulPayments: paymentLogs.filter((p) => p.status === "success").length,
          usageByDate,
          paymentAmountByDate,
        };

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          usageRecords,
          paymentRecords,
          statistics,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    // 管理后台导出Excel
    if (req.method === "GET" && apiPath === "/admin/export") {
      const token = url.searchParams.get("token");
      if (token !== ADMIN_TOKEN) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      try {
        const usageRecords = (getUsageLogs(1000) as any[]).map((u) => ({
          时间: new Date(u.createdAt).toLocaleString("zh-CN"),
          用户: u.userId,
          问题: u.question,
          类型: u.action === "followup" ? "后续问题" : "首次解卦",
        }));
        const paymentRecords = (getPaymentLogs(1000) as any[]).map((p) => ({
          时间: new Date(p.createdAt).toLocaleString("zh-CN"),
          用户: p.userId,
          金额: (p.amount / 100).toFixed(2) + "元",
          描述: "六爻解卦服务",
          订单号: p.orderId,
          状态: p.status === "success" ? "成功" : p.status === "pending" ? "待支付" : "失败",
        }));

        const wb = XLSX.utils.book_new();
        const usageWs = XLSX.utils.json_to_sheet(usageRecords);
        XLSX.utils.book_append_sheet(wb, usageWs, "使用记录");
        const paymentWs = XLSX.utils.json_to_sheet(paymentRecords);
        XLSX.utils.book_append_sheet(wb, paymentWs, "支付记录");
        const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="六爻管理数据_${new Date().toISOString().split("T")[0]}.xlsx"`,
        });
        res.end(excelBuffer);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "API endpoint not found" }));
    return;
  }

  // 静态文件服务 - Assets (JS/CSS)
  if (url.pathname.startsWith("/assets/")) {
    const filePath = path.join(FRONTEND_DIR, url.pathname);
    serveStaticFile(res, filePath);
    return;
  }

  // 静态文件服务 - 图片
  if (url.pathname.startsWith("/images/")) {
    const filePath = path.join(PUBLIC_DIR, url.pathname);
    serveStaticFile(res, filePath);
    return;
  }

  // Vue 应用 - 所有其他路由都返回 index.html
  const indexPath = path.join(FRONTEND_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    serveStaticFile(res, indexPath);
  } else {
    // 如果前端未构建，返回开发提示
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>开发模式</title>
      </head>
      <body>
        <h1>请先构建前端应用</h1>
        <p>运行: npm run build:frontend</p>
        <p>或使用开发模式: npm run dev:frontend</p>
      </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`六爻排盘服务已启动: http://localhost:${PORT}`);
  console.log(`前端目录: ${FRONTEND_DIR}`);
  console.log(`公共资源目录: ${PUBLIC_DIR}`);
});


