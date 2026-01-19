import "dotenv/config";
import express from "express";
import cors from "cors";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 🔹 业务逻辑（来自 src）
import { calculate } from "../src/services/hexagram.ts";
import { interpretWithGemini } from "../src/services/interpret.ts";

// ================================
// 🌐 强制 Node fetch 走 Clash 代理
// ================================
const proxyUrl = process.env.PROXY_URL || "http://127.0.0.1:7890";
setGlobalDispatcher(new ProxyAgent(proxyUrl))

// ================================
// 🚀 Express 初始化
// ================================
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ================================
// 🔐 Gemini Key 校验
// ================================
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

// SDK（给 /api/gemini 用）
const genAI = new GoogleGenerativeAI(apiKey);

// ================================
// ✅ 基础接口
// ================================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, proxyUrl });
});

// 验证代理是否生效
app.get("/api/netcheck", async (req, res) => {
  try {
    const r = await fetch("https://www.google.com", { redirect: "manual" });
    res.json({ ok: true, status: r.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ================================
// 🧠 简单 Gemini 接口（保留）
// ================================
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);

    res.json({ text: result.response.text() });
  } catch (err) {
    console.error("Gemini error:", err);
    res.status(500).json({
      error: "gemini request failed",
      detail: err?.message || String(err),
    });
  }
});

// =====================================================
// 🎯 核心接口：排盘 + 自动解卦（摇满 6 次用）
// =====================================================
app.post("/api/calc-and-interpret", async (req, res) => {
  try {
    const payload = req.body;

    // 1️⃣ 校验 6 爻
    if (
      !payload?.lines ||
      !Array.isArray(payload.lines) ||
      payload.lines.length !== 6
    ) {
      return res.status(400).json({
        error: "payload.lines 必须是长度为 6 的数组",
      });
    }

    // 2️⃣ 排盘
    const result = calculate(payload);

    // 3️⃣ 解卦（使用你已有的完整 interpretWithGemini）
    const interpretation = await interpretWithGemini(payload, result);

    // 4️⃣ 返回给前端
    res.json({
      result,
      interpretation,
    });
  } catch (err) {
    console.error("calc-and-interpret error:", err);
    res.status(500).json({
      error: "calc-and-interpret failed",
      detail: err?.message || String(err),
    });
  }
});

// ================================
// 🟢 启动服务
// ================================
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
