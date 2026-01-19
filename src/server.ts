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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3003;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin";

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

function renderShakePage(
  error?: string,
  payload?: Partial<InputPayload>,
  lines?: LineResult[],
) {
  const tz = payload?.timezone || "Asia/Shanghai";
  const defaultDatetime =
    payload?.datetime ||
    DateTime.now().setZone(tz).startOf("minute").toISO({ suppressMilliseconds: true });

    const currentLineIndex = lines ? lines.length : 0;
  const isComplete = currentLineIndex >= 6;

  const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mystic I Ching Readings - 六爻摇卦</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: "Times New Roman", "Songti SC", serif;
      min-height: 100vh;
      background: #0f152b url('/images/bg-bamboo.jpg') center center / cover fixed;
      color: #d4af37;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-x: hidden;
    }
    /* 暗色遮罩，提升对比度 */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 0;
      pointer-events: none;
    }
    /* Header */
    header {
      background: #1a1f3a;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      position: relative;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      color: #1a1f3a;
      font-weight: bold;
      border: 2px solid #d4af37;
    }
    .logo-text h1 {
      color: #d4af37;
      font-size: 24px;
      font-weight: normal;
      margin: 0;
    }
    .logo-text p {
      color: #d4af37;
      font-size: 14px;
      margin: 0;
      opacity: 0.9;
    }
    nav {
      display: flex;
      gap: 30px;
    }
    nav a {
      color: #d4af37;
      text-decoration: none;
      font-size: 16px;
      transition: opacity 0.3s;
    }
    nav a:hover {
      opacity: 0.7;
    }
    /* Main Content */
    main {
      flex: 1;
      position: relative;
      z-index: 1;
      padding: 40px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      background: rgba(255, 255, 255, 0.9);
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      max-width: 900px;
      width: 100%;
      backdrop-filter: blur(6px);
    }
    h1 { 
      margin-top: 0; 
      color: #1a1f3a; 
      font-size: 32px;
      margin-bottom: 30px;
      text-align: center;
    }
    /* 结果区域 */
    .result-section {
      margin-top: 40px;
      padding: 30px;
      border-top: 2px solid rgba(0,0,0,0.08);
      background: rgba(255,255,255,0.9);
      border-radius: 12px;
      color: #1a1f3a;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      backdrop-filter: blur(4px);
    }
    .result-section h2 {
      color: #1a1f3a;
      font-size: 24px;
      margin-bottom: 16px;
      text-align: left;
    }
    .result-section pre {
      background: #f7f7f7;
      padding: 20px;
      white-space: pre-wrap;
      border-radius: 8px;
      font-family: "Courier New", monospace;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1f3a;
      border: 1px solid rgba(0,0,0,0.08);
      min-height: 80px;
    }
    .interpret-btn {
      margin-top: 16px;
      padding: 12px 24px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }
    .interpret-btn:hover {
      background: #45a049;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
    }
    .form-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
    }
    label { 
      display: block; 
      margin: 10px 0 6px; 
      font-weight: 600; 
      color: #1a1f3a;
      font-size: 14px;
    }
    input, textarea { 
      width: 100%; 
      padding: 12px; 
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: white;
      color: #1a1f3a;
    }
    input:focus, textarea:focus {
      outline: none;
      border-color: #d4af37;
      box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
    }
    .shake-section {
      margin: 40px 0;
      text-align: center;
      background: transparent;
      padding: 30px;
      border-radius: 8px;
    }
    .shake-section h2 {
      color: #1a1f3a;
      font-size: 24px;
      margin-bottom: 15px;
    }
    .coins-container {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 30px;
      margin: 30px 0;
      flex-wrap: wrap;
    }
    .coin {
      width: 140px;
      height: 180px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      flex-shrink: 0;
    }
    .coin img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      transition: transform 0.3s;
    }
    .coin.spinning img {
      animation: spin 0.8s linear infinite;
    }
    .coin.yin img {
      filter: grayscale(1) brightness(1.5) contrast(0.8);
    }
    @keyframes spin {
      from { transform: rotateY(0deg); }
      to { transform: rotateY(360deg); }
    }
    .shake-btn {
      padding: 15px 40px;
      font-size: 18px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      margin: 20px 0;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }
    .shake-btn:hover:not(:disabled) {
      background: #45a049;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
    }
    .shake-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
      box-shadow: none;
    }
    .lines-display {
      margin: 30px 0;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 6px;
    }
    .line-item {
      padding: 10px;
      margin: 8px 0;
      background: white;
      border-left: 4px solid #4CAF50;
      border-radius: 4px;
    }
    .line-item.moving {
      color: #c62828;
      border-left-color: #c62828;
    }
    .line-item strong {
      color: #333;
    }
    .submit-btn {
      padding: 15px 40px;
      font-size: 18px;
      background: #2196F3;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 20px;
      width: 100%;
    }
    .submit-btn:hover {
      background: #0b7dda;
    }
    .error { 
      color: #d32f2f; 
      margin: 12px 0; 
      padding: 12px;
      background: #ffebee;
      border-radius: 4px;
    }
    .info {
      color: #666;
      font-size: 14px;
      margin: 10px 0;
    }
    /* 支付弹窗 */
    .payment-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }
    .payment-modal.show {
      display: flex;
    }
    .payment-content {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    .payment-header {
      text-align: center;
      margin-bottom: 20px;
    }
    .payment-header h3 {
      color: #1a1f3a;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .payment-amount {
      color: #d32f2f;
      font-size: 32px;
      font-weight: bold;
      margin: 15px 0;
    }
    .payment-method {
      margin: 20px 0;
      padding: 15px;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      background: #f1f8f4;
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .payment-method-icon {
      width: 40px;
      height: 40px;
      background: #07c160;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    .payment-method-text {
      flex: 1;
      color: #1a1f3a;
      font-size: 16px;
      font-weight: 600;
    }
    .payment-buttons {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    .payment-btn {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s;
    }
    .payment-btn-primary {
      background: #07c160;
      color: white;
    }
    .payment-btn-primary:hover {
      background: #06ad56;
    }
    .payment-btn-cancel {
      background: #f5f5f5;
      color: #666;
    }
    .payment-btn-cancel:hover {
      background: #e0e0e0;
    }
    .payment-loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    .payment-success {
      text-align: center;
      padding: 20px;
      color: #4CAF50;
    }
    .close-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 24px;
      color: #999;
      cursor: pointer;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.3s;
    }
    .close-btn:hover {
      background: #f5f5f5;
      color: #333;
    }
    /* 聊天框 */
    .chat-section {
      margin-top: 30px;
      padding: 20px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    .chat-section h3 {
      color: #1a1f3a;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .chat-messages {
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 15px;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 6px;
      min-height: 100px;
    }
    .chat-message {
      margin-bottom: 15px;
      padding: 10px 15px;
      border-radius: 6px;
      background: white;
      border-left: 3px solid #4CAF50;
    }
    .chat-message.user {
      background: #e3f2fd;
      border-left-color: #2196F3;
    }
    .chat-message .message-label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
      margin-bottom: 5px;
    }
    .chat-message .message-content {
      color: #1a1f3a;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .chat-input-container {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .chat-input {
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 60px;
      max-height: 120px;
    }
    .chat-input:focus {
      outline: none;
      border-color: #d4af37;
      box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
    }
    .chat-submit-btn {
      padding: 12px 24px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      transition: all 0.3s;
      white-space: nowrap;
    }
    .chat-submit-btn:hover:not(:disabled) {
      background: #45a049;
    }
    .chat-submit-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .char-count {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      text-align: right;
    }
    .char-count.warning {
      color: #d32f2f;
    }
    /* Footer */
    footer {
      background: #1a1f3a;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      position: relative;
      border-top: 1px solid rgba(212, 175, 55, 0.2);
    }
    .footer-links {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .footer-links a {
      color: #d4af37;
      text-decoration: none;
      font-size: 14px;
      transition: opacity 0.3s;
    }
    .footer-links a:hover {
      opacity: 0.7;
    }
    .social-icons {
      display: flex;
      gap: 15px;
    }
    .social-icon {
      width: 32px;
      height: 32px;
      background: #d4af37;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1a1f3a;
      text-decoration: none;
      font-size: 16px;
      transition: all 0.3s;
    }
    .social-icon:hover {
      background: #f4d03f;
      transform: scale(1.1);
    }
    /* 移动端适配 */
    @media (max-width: 768px) {
      /* Header 和 Footer */
      header, footer {
        flex-direction: column;
        gap: 15px;
        text-align: center;
        padding: 15px 20px;
      }
      
      /* Logo 调整 */
      .logo {
        width: 50px;
        height: 50px;
        font-size: 24px;
      }
      .logo-text h1 {
        font-size: 20px;
      }
      .logo-text p {
        font-size: 12px;
      }
      
      /* 导航菜单 */
      nav {
        flex-wrap: wrap;
        justify-content: center;
        gap: 15px;
      }
      nav a {
        font-size: 14px;
      }
      
      /* 主内容区域 */
      main {
        padding: 20px 15px;
      }
      
      /* 容器 */
      .container {
        padding: 20px 15px;
        border-radius: 8px;
      }
      
      /* 标题 */
      h1 {
        font-size: 24px;
        margin-bottom: 20px;
      }
      
      /* 表单区域 */
      .form-section {
        margin-bottom: 20px;
        padding-bottom: 12px;
      }
      
      label {
        font-size: 13px;
        margin: 8px 0 5px;
      }
      
      input, textarea {
        padding: 10px;
        font-size: 16px; /* 防止iOS自动缩放 */
        border-radius: 4px;
      }
      
      /* 摇卦区域 */
      .shake-section {
        margin: 30px 0;
        padding: 20px 10px;
      }
      
      .shake-section h2 {
        font-size: 20px;
        margin-bottom: 12px;
      }
      
      /* 叶子/硬币容器 */
      .coins-container {
        gap: 15px;
        margin: 20px 0;
      }
      
      .coin {
        width: 100px;
        height: 130px;
      }
      
      /* 摇卦按钮 */
      .shake-btn {
        padding: 12px 30px;
        font-size: 16px;
        margin: 15px 0;
        width: 100%;
        max-width: 300px;
      }
      
      /* 已摇出的爻显示 */
      .lines-display {
        margin: 20px 0;
        padding: 15px;
      }
      
      .line-item {
        padding: 8px;
        margin: 6px 0;
        font-size: 13px;
      }
      
      /* 结果区域 */
      .result-section {
        margin-top: 30px;
        padding: 20px 15px;
      }
      
      .result-section h2 {
        font-size: 20px;
        margin-bottom: 12px;
      }
      
      .result-section pre {
        padding: 15px;
        font-size: 12px;
        line-height: 1.5;
        overflow-x: auto;
      }
      
      /* 解卦按钮 */
      .interpret-btn {
        padding: 12px 20px;
        font-size: 15px;
        width: 100%;
        max-width: 300px;
      }
      
      /* Footer 链接 */
      .footer-links {
        flex-direction: column;
        gap: 15px;
      }
      
      .footer-links a {
        font-size: 12px;
      }
      
      .social-icons {
        gap: 10px;
      }
      
      .social-icon {
        width: 28px;
        height: 28px;
        font-size: 14px;
      }
      
      /* 支付弹窗移动端适配 */
      .payment-content {
        padding: 20px 15px;
        max-width: 90%;
      }
      .payment-header h3 {
        font-size: 20px;
      }
      .payment-amount {
        font-size: 28px;
      }
      .payment-method {
        padding: 12px;
      }
      .payment-method-icon {
        width: 35px;
        height: 35px;
        font-size: 20px;
      }
      .payment-method-text {
        font-size: 14px;
      }
      .payment-btn {
        padding: 10px 20px;
        font-size: 14px;
      }
    }
    
    /* 小屏幕手机适配（小于480px） */
    @media (max-width: 480px) {
      header, footer {
        padding: 12px 15px;
      }
      
      .logo {
        width: 40px;
        height: 40px;
        font-size: 20px;
      }
      
      .logo-text h1 {
        font-size: 18px;
      }
      
      main {
        padding: 15px 10px;
      }
      
      .container {
        padding: 15px 12px;
      }
      
      h1 {
        font-size: 20px;
        margin-bottom: 15px;
      }
      
      .shake-section h2,
      .result-section h2 {
        font-size: 18px;
      }
      
      .coins-container {
        gap: 10px;
      }
      
      .coin {
        width: 80px;
        height: 110px;
      }
      
      .shake-btn,
      .interpret-btn {
        padding: 10px 20px;
        font-size: 14px;
      }
      
      .result-section pre {
        padding: 12px;
        font-size: 11px;
      }
      
      nav a {
        font-size: 12px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <nav>
      <a href="#">Free Reading</a>
      <a href="#">My Journal</a>
      <a href="#">About Us</a>
      <a href="/admin?token=${encodeURIComponent(ADMIN_TOKEN)}" style="color:#f4d03f;font-weight:bold;">Admin</a>
    </nav>
  </header>
  
  <main>
    <div class="container">
      <h1>六爻摇卦</h1>
    
    ${error ? `<div class="error">错误：${error}</div>` : ""}
    
    <form id="mainForm" method="POST" action="/shake">
      <div class="form-section">
        <label for="location">起卦地点 <span style="color: #d32f2f;">*</span></label>
        <input id="location" name="location" value="${payload?.location ?? ""}" required placeholder="请输入起卦地点" />
        
        <label for="timezone">时区（IANA，如 Asia/Shanghai） <span style="color: #d32f2f;">*</span></label>
        <input id="timezone" name="timezone" value="${tz}" required />
        
        <label for="datetime">精确时间（ISO，如 2025-12-10T17:30） <span style="color: #d32f2f;">*</span></label>
        <input id="datetime" name="datetime" value="${defaultDatetime ?? ""}" required />
        
        <label for="querentName">测算人姓名 <span style="color: #d32f2f;">*</span></label>
        <input id="querentName" name="querentName" value="${payload?.querentName ?? ""}" required placeholder="请输入姓名" />
        
        <label for="question">所问何事 <span style="color: #d32f2f;">*</span></label>
        <input id="question" name="question" value="${payload?.question ?? ""}" required placeholder="请输入所问事项" />
      </div>
      
      <div class="form-section shake-section">
        <h2 id="shakeTitle">摇卦（第 ${currentLineIndex + 1} / 6 爻）</h2>
        <p class="info">点击"摇卦"按钮，三片树叶会随机翻转，根据结果确定当前爻</p>
        <p style="color: #d32f2f; font-size: 14px; margin: 8px 0; font-weight: 600;">在点击"摇卦"时心中默念询问的事，不做他想</p>
        
        <div class="coins-container">
          <div class="coin" id="coin1"><img src="/images/leaf-yang.png" alt="叶子" /></div>
          <div class="coin" id="coin2"><img src="/images/leaf-yang.png" alt="叶子" /></div>
          <div class="coin" id="coin3"><img src="/images/leaf-yang.png" alt="叶子" /></div>
        </div>
        
        <button type="button" class="shake-btn" id="shakeBtn" ${isComplete ? "disabled" : ""}>
          ${isComplete ? "已完成六爻" : "摇卦"}
        </button>
        
        <div id="currentResult" style="margin: 20px 0; font-size: 16px; font-weight: bold; color: #4CAF50;"></div>
      </div>
      
      ${
        lines && lines.length > 0
          ? `<div class="lines-display">
          <h3>已摇出的爻：</h3>
          ${lines
            .map((line) => {
              const typeName = line.type === "yang" ? "阳" : "阴";
              const movingDesc = line.isMoving
                ? `（老${typeName}，动）`
                : `（少${typeName}，静）`;
              return `<div class="line-item">
              <strong>第${line.index}爻：</strong>
              ${typeName}爻${movingDesc}
            </div>`;
            })
            .join("")}
        </div>`
          : ""
      }
      
      ${lines ? lines.map((line, idx) => `
        <input type="hidden" name="line${idx}_index" value="${line.index}" />
        <input type="hidden" name="line${idx}_type" value="${line.type}" />
        <input type="hidden" name="line${idx}_isMoving" value="${line.isMoving}" />
      `).join("") : ""}
    </form>
    
    <div class="result-section">
      <h2>排盘结果</h2>
      <pre id="resultText">摇完六爻后，这里会显示排盘结果</pre>
      <button type="button" id="interpretBtn" class="interpret-btn" style="display:none;">解卦</button>
      <h2 style="margin-top:24px;">解卦结果</h2>
      <pre id="interpretText">点击“解卦”后，这里显示解卦内容</pre>
      
      <!-- 聊天框 -->
      <div class="chat-section" id="chatSection" style="display:none;">
        <h3>继续提问</h3>
        <div class="chat-messages" id="chatMessages"></div>
        <div>
          <textarea 
            id="chatInput" 
            class="chat-input" 
            placeholder="请输入您的问题（不超过30字）" 
            maxlength="30"
          ></textarea>
          <div class="char-count" id="charCount">0/30</div>
          <div class="chat-input-container" style="margin-top:10px;">
            <button type="button" id="chatSubmitBtn" class="chat-submit-btn">提交问题</button>
          </div>
        </div>
      </div>
    </div>
    </div>
  </main>
  
  <footer>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
      <div class="social-icons">
        <a href="#" class="social-icon" title="Twitter">🐦</a>
        <a href="#" class="social-icon" title="Instagram">📷</a>
        <a href="#" class="social-icon" title="YouTube">▶</a>
      </div>
    </div>
  </footer>
  
  <script>
    (function() {
      'use strict';
      
      console.log('[六爻] 脚本开始执行，文档状态:', document.readyState);
      
      // 全局变量
      var currentLines = ${JSON.stringify(lines || [])};
      var maxLines = 6;
      var coins = [];
      var shakeBtn = null;
      var resultDiv = null;
      var form = null;
      var shakeTitle = null;
      var isInitialized = false;
      
      // 初始化函数
      function initShakePage() {
        if (isInitialized) {
          console.log('[六爻] 已经初始化，跳过');
          return;
        }
        
        console.log('[六爻] initShakePage 开始执行');
        
        // 获取DOM元素
        coins = [
          document.getElementById('coin1'),
          document.getElementById('coin2'),
          document.getElementById('coin3')
        ];
        shakeBtn = document.getElementById('shakeBtn');
        resultDiv = document.getElementById('currentResult');
        form = document.getElementById('mainForm');
        shakeTitle = document.getElementById('shakeTitle');
        
        console.log('[六爻] 元素查找结果:', {
          shakeBtn: !!shakeBtn,
          form: !!form,
          coins: coins.map(function(c) { return !!c; }),
          resultDiv: !!resultDiv,
          shakeTitle: !!shakeTitle
        });
        
        if (!shakeBtn) {
          console.error('[六爻] 摇卦按钮未找到！');
          return;
        }
        if (!form) {
          console.error('[六爻] 表单未找到！');
          return;
        }
        
        // 处理图片加载错误
        coins.forEach(function(coin, idx) {
          if (coin) {
            var img = coin.querySelector('img');
            if (img) {
              img.addEventListener('error', function() {
                img.style.display = 'none';
                var errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'color:#666;padding:20px;text-align:center;font-size:12px;line-height:1.6;';
                errorDiv.innerHTML = '<strong>图片缺失</strong><br/>请将您上传的深绿色叶子图片<br/>保存为：<br/><code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;">public/images/leaf-yang.png</code>';
                coin.appendChild(errorDiv);
              });
            }
          }
        });
        
        // 更新函数
        function updateHiddenFields() {
          var oldFields = form.querySelectorAll('input[type="hidden"][name^="line"]');
          oldFields.forEach(function(field) { field.remove(); });
          
          currentLines.forEach(function(line, idx) {
            var indexInput = document.createElement('input');
            indexInput.type = 'hidden';
            indexInput.name = 'line' + idx + '_index';
            indexInput.value = line.index;
            form.appendChild(indexInput);
            
            var typeInput = document.createElement('input');
            typeInput.type = 'hidden';
            typeInput.name = 'line' + idx + '_type';
            typeInput.value = line.type;
            form.appendChild(typeInput);
            
            var movingInput = document.createElement('input');
            movingInput.type = 'hidden';
            movingInput.name = 'line' + idx + '_isMoving';
            movingInput.value = line.isMoving;
            form.appendChild(movingInput);
          });
        }
        
        function updateLinesDisplay() {
          var linesDisplay = document.querySelector('.lines-display');
          if (!linesDisplay) {
            linesDisplay = document.createElement('div');
            linesDisplay.className = 'lines-display';
            var shakeSection = document.querySelector('.shake-section');
            if (shakeSection && shakeSection.parentNode) {
              shakeSection.parentNode.insertBefore(linesDisplay, shakeSection.nextSibling);
            }
          }
          
          if (currentLines.length > 0) {
            var ordered = currentLines.slice().sort(function(a, b) { return b.index - a.index; });
            linesDisplay.innerHTML = '<h3 style="color:#1a1f3a;">已摇出的爻：</h3>' + ordered.map(function(line) {
              var isYang = line.type === 'yang';
              var status = line.isMoving
                ? (isYang ? '老阳（动）' : '老阴（动）')
                : (isYang ? '少阳（静）' : '少阴（静）');
              return '<div class="line-item' + (line.isMoving ? ' moving' : '') + '"><strong>第' + line.index + '爻：</strong>' + status + '</div>';
            }).join('');
            linesDisplay.style.display = 'block';
          } else if (linesDisplay) {
            linesDisplay.innerHTML = '';
          }
        }
        
        function updateTitle() {
          if (!shakeTitle) return;
          if (currentLines.length >= maxLines) {
            shakeTitle.textContent = '摇卦（完成 6 / 6 爻）';
          } else {
            var next = Math.min(currentLines.length + 1, maxLines);
            shakeTitle.textContent = '摇卦（第 ' + next + ' / 6 爻）';
          }
        }
        
        // 初始化显示
        if (currentLines.length > 0) {
          updateHiddenFields();
          updateLinesDisplay();
          updateTitle();
        }
        
        // 摇卦逻辑
        function getRandomResult() {
          return Math.random() < 0.5 ? 'yin' : 'yang';
        }
        
        function determineLine(coin1, coin2, coin3) {
          var yangCount = [coin1, coin2, coin3].filter(function(r) { return r === 'yang'; }).length;
          var yinCount = 3 - yangCount;
          
          if (yangCount === 3) {
            return { type: 'yang', isMoving: true, name: '老阳（动）' };
          } else if (yinCount === 3) {
            return { type: 'yin', isMoving: true, name: '老阴（动）' };
          } else if (yangCount === 2) {
            return { type: 'yin', isMoving: false, name: '少阴（静）' };
          } else {
            return { type: 'yang', isMoving: false, name: '少阳（静）' };
          }
        }
        
        // 执行摇卦
        function performShake() {
          console.log('[六爻] performShake 被调用，当前爻数:', currentLines.length);
          
          var btn = document.getElementById('shakeBtn');
          if (!btn) {
            console.error('[六爻] 无法找到摇卦按钮');
            return;
          }
          
          if (currentLines.length >= maxLines) {
            console.log('[六爻] 已完成六爻，不再响应');
            return;
          }
          
          btn.disabled = true;
          if (resultDiv) resultDiv.textContent = '';
          
          coins.forEach(function(coin) {
            if (coin) {
              coin.classList.add('spinning');
              coin.className = 'coin spinning';
            }
          });
          
          setTimeout(function() {
            var results = coins.map(function() { return getRandomResult(); });
            
            results.forEach(function(result, idx) {
              setTimeout(function() {
                if (coins[idx]) {
                  coins[idx].classList.remove('spinning');
                  coins[idx].className = 'coin ' + result;
                  var img = coins[idx].querySelector('img');
                  if (img) {
                    img.src = '/images/leaf-yang.png';
                  }
                }
              }, idx * 200);
            });
            
            setTimeout(function() {
              var lineResult = determineLine(results[0], results[1], results[2]);
              var lineIndex = currentLines.length + 1;
              
              currentLines.push({
                index: lineIndex,
                type: lineResult.type,
                isMoving: lineResult.isMoving
              });
              
              if (resultDiv) {
                resultDiv.textContent = '第' + lineIndex + '爻：' + lineResult.name;
              }
              
              updateTitle();
              updateHiddenFields();
              updateLinesDisplay();
              
              if (currentLines.length < maxLines) {
                btn.disabled = false;
                btn.textContent = '摇卦';
                updateTitle();
              } else {
                btn.textContent = '正在生成排盘...';
                btn.disabled = true;
                updateTitle();
                setTimeout(function() {
                  generateResult();
                }, 1000);
              }
            }, 1000);
          }, 1500);
        }
        
        // 辅助函数
        function ensureDefaults() {
          var nameInput = form.querySelector('input[name="querentName"]');
          var questionInput = form.querySelector('input[name="question"]');
          if (nameInput && !nameInput.value.trim()) nameInput.value = '匿名';
          if (questionInput && !questionInput.value.trim()) questionInput.value = '未填写';
        }
        
        function validateRequiredFields() {
          var locationInput = form.querySelector('input[name="location"]');
          if (locationInput && !locationInput.value.trim()) {
            alert('请填写起卦地点（必填项）');
            locationInput.focus();
            return false;
          }
          return true;
        }
        
        function serializeForm() {
          var fd = new FormData(form);
          var params = new URLSearchParams();
          fd.forEach(function(v, k) {
            params.append(k, String(v));
          });
          return params;
        }
        
        // 生成排盘结果
        function generateResult() {
          if (!validateRequiredFields()) return;
          ensureDefaults();
          var params = serializeForm();
          fetch('/shake', {
            method: 'POST',
            headers: { 
              'x-fetch': '1',
              'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
            },
            body: params.toString()
          })
          .then(function(res) { return res.json(); })
          .then(function(data) {
            var resultText = document.getElementById('resultText');
            var interpretBtn = document.getElementById('interpretBtn');
            if (data.output && resultText) {
              resultText.textContent = data.output;
            } else if (resultText) {
              resultText.textContent = data.error || '生成结果失败';
            }
            if (interpretBtn && data.output) {
              interpretBtn.style.display = 'inline-block';
            }
            var btn = document.getElementById('shakeBtn');
            if (btn) {
              btn.disabled = false;
              btn.textContent = '摇卦（已完成）';
            }
          })
          .catch(function(err) {
            var resultText = document.getElementById('resultText');
            if (resultText) {
              resultText.textContent = '生成排盘结果时出错：' + err;
            }
            var btn = document.getElementById('shakeBtn');
            if (btn) {
              btn.disabled = false;
              btn.textContent = '摇卦';
            }
          });
        }
        
        // 绑定摇卦按钮事件
        var clickHandler = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[六爻] 摇卦按钮被点击');
          try {
            performShake();
          } catch (err) {
            console.error('[六爻] 执行摇卦时出错:', err);
            alert('摇卦时发生错误: ' + (err.message || err));
          }
        };
        
        shakeBtn.addEventListener('click', clickHandler, false);
        console.log('[六爻] 摇卦按钮事件已绑定，按钮状态:', shakeBtn.disabled);
        
        // 暴露到全局
        window.performShake = performShake;
        window.generateResult = generateResult;
        
        isInitialized = true;
        console.log('[六爻] initShakePage 完成');
      }
      
      // DOM加载完成后初始化
      function tryInit() {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
            console.log('[六爻] DOMContentLoaded 触发');
            setTimeout(initShakePage, 100);
          });
        } else {
          console.log('[六爻] DOM 已就绪，立即初始化');
          setTimeout(initShakePage, 100);
        }
      }
      
      tryInit();
      
      // 事件委托作为备用方案
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target) return;
        
        var btn = target.id === 'shakeBtn' ? target : (target.closest ? target.closest('#shakeBtn') : null);
        if (btn && typeof window.performShake === 'function') {
          e.preventDefault();
          e.stopPropagation();
          console.log('[六爻] 通过事件委托捕获到摇卦按钮点击');
          window.performShake();
        }
      }, true);
    })();
    
    // 支付弹窗相关（延迟获取，确保DOM已加载）
    let paymentModal = null;
    let closePaymentBtn = null;
    let cancelPaymentBtn = null;
    let confirmPaymentBtn = null;
    let paymentLoading = null;
    let paymentSuccess = null;
    
    function initPaymentElements() {
      paymentModal = document.getElementById('paymentModal');
      closePaymentBtn = document.getElementById('closePaymentBtn');
      cancelPaymentBtn = document.getElementById('cancelPaymentBtn');
      confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
      paymentLoading = document.getElementById('paymentLoading');
      paymentSuccess = document.getElementById('paymentSuccess');
      
      console.log('支付弹窗元素初始化:', {
        paymentModal: !!paymentModal,
        closePaymentBtn: !!closePaymentBtn,
        cancelPaymentBtn: !!cancelPaymentBtn,
        confirmPaymentBtn: !!confirmPaymentBtn,
        paymentLoading: !!paymentLoading,
        paymentSuccess: !!paymentSuccess
      });
      
      // 关闭按钮事件
      if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', closePaymentModal);
      }
      if (cancelPaymentBtn) {
        cancelPaymentBtn.addEventListener('click', closePaymentModal);
      }
      
      // 点击弹窗外部关闭
      if (paymentModal) {
        paymentModal.addEventListener('click', function(e) {
          if (e.target === paymentModal) {
            closePaymentModal();
          }
        });
      }
      
      // 支付确认按钮事件
      if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', function() {
          // 隐藏按钮，显示加载
          if (confirmPaymentBtn) confirmPaymentBtn.style.display = 'none';
          if (cancelPaymentBtn) cancelPaymentBtn.style.display = 'none';
          if (paymentLoading) paymentLoading.style.display = 'block';
          
          // 获取用户名
          const form = document.getElementById('mainForm');
          const userNameInput = form ? form.querySelector('input[name="querentName"]') : null;
          const userName = userNameInput ? (userNameInput as HTMLInputElement).value || '匿名' : '匿名';
          
          // 调用后端创建支付订单
          fetch('/create-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: 100, // 1元 = 100分
              description: '六爻解卦服务',
              userName: userName,
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.code === 0 && data.paymentUrl) {
              // 跳转到微信支付页面
              window.location.href = data.paymentUrl;
            } else if (data.code === 0 && data.wechatPayParams) {
              // 使用微信JSAPI支付
              if (typeof WeixinJSBridge !== 'undefined') {
                WeixinJSBridge.invoke('getBrandWCPayRequest', data.wechatPayParams, function(res) {
                  if (res.err_msg === 'get_brand_wcpay_request:ok') {
                    // 支付成功
                    if (paymentLoading) paymentLoading.style.display = 'none';
                    if (paymentSuccess) paymentSuccess.style.display = 'block';
                    // 调用支付成功回调
                    fetch('/payment-success', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: data.orderId })
                    }).catch(err => console.error('支付成功回调失败:', err));
                    setTimeout(() => {
                      closePaymentModal();
                      handlePaymentSuccess();
                    }, 1000);
                  } else {
                    // 支付失败
                    alert('支付失败，请重试');
                    if (confirmPaymentBtn) confirmPaymentBtn.style.display = 'block';
                    if (cancelPaymentBtn) cancelPaymentBtn.style.display = 'block';
                    if (paymentLoading) paymentLoading.style.display = 'none';
                  }
                });
              } else {
                // 模拟支付（开发环境）
                setTimeout(() => {
                  if (paymentLoading) paymentLoading.style.display = 'none';
                  if (paymentSuccess) paymentSuccess.style.display = 'block';
                  // 调用支付成功回调
                  fetch('/payment-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.orderId })
                  }).catch(err => console.error('支付成功回调失败:', err));
                  setTimeout(() => {
                    closePaymentModal();
                    handlePaymentSuccess();
                  }, 1000);
                }, 1500);
              }
            } else {
              // 模拟支付（开发环境，后端未实现时）
              setTimeout(() => {
                if (paymentLoading) paymentLoading.style.display = 'none';
                if (paymentSuccess) paymentSuccess.style.display = 'block';
                // 调用支付成功回调
                if (data.orderId) {
                  fetch('/payment-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.orderId })
                  }).catch(err => console.error('支付成功回调失败:', err));
                }
                setTimeout(() => {
                  closePaymentModal();
                  handlePaymentSuccess();
                }, 1000);
              }, 1500);
            }
          })
          .catch(err => {
            console.error('支付请求失败:', err);
            // 开发环境：模拟支付成功（这里没有orderId，跳过回调）
            setTimeout(() => {
              if (paymentLoading) paymentLoading.style.display = 'none';
              if (paymentSuccess) paymentSuccess.style.display = 'block';
              setTimeout(() => {
                closePaymentModal();
                handlePaymentSuccess();
              }, 1000);
            }, 1500);
          });
        });
      }
    }
    
    // 关闭支付弹窗
    function closePaymentModal() {
      if (!paymentModal) {
        initPaymentElements();
      }
      if (paymentModal) {
        paymentModal.classList.remove('show');
        if (paymentLoading) {
          paymentLoading.style.display = 'none';
        }
        if (paymentSuccess) {
          paymentSuccess.style.display = 'none';
        }
      }
    }
    
    // 显示支付弹窗
    function showPaymentModal() {
      console.log('showPaymentModal 被调用');
      if (!paymentModal) {
        initPaymentElements();
      }
      if (paymentModal) {
        console.log('支付弹窗元素存在，准备显示');
        paymentModal.classList.add('show');
        if (paymentLoading) {
          paymentLoading.style.display = 'none';
        }
        if (paymentSuccess) {
          paymentSuccess.style.display = 'none';
        }
        // 确保按钮可见
        if (confirmPaymentBtn) {
          confirmPaymentBtn.style.display = 'block';
        }
        if (cancelPaymentBtn) {
          cancelPaymentBtn.style.display = 'block';
        }
        console.log('支付弹窗应该已显示，classList:', paymentModal.classList.toString());
      } else {
        console.error('支付弹窗元素不存在！');
      }
    }
    
    // 初始化支付元素
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPaymentElements);
    } else {
      initPaymentElements();
    }
    
    // 处理支付成功后的操作
    function handlePaymentSuccess() {
      // 如果有关待支付的问题，提交问题；否则执行首次解卦
      if (window.pendingQuestion) {
        submitQuestion(window.pendingQuestion);
        window.pendingQuestion = null;
      } else {
        executeInterpretation();
      }
    }
    
    // 执行解卦（支付成功后调用）
    function executeInterpretation() {
      const interpretBtn = document.getElementById('interpretBtn');
      const interpretText = document.getElementById('interpretText');
      
      if (!interpretBtn || !interpretText) return;
      
      const originalText = interpretBtn.textContent;
      
      // 显示加载状态
      interpretBtn.disabled = true;
      interpretBtn.textContent = '正在解卦...';
      interpretText.textContent = '正在请求解卦结果，请稍候...';
      
      ensureDefaults();
      const params = serializeForm();
      
      fetch('/interpret', {
        method: 'POST',
        headers: { 
          'x-fetch': '1',
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        },
        body: params.toString()
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }
        return res.json();
      })
      .then(data => {
        if (interpretText) {
          if (data.interpretation) {
            interpretText.textContent = data.interpretation;
            // 解卦成功后显示聊天框
            const chatSection = document.getElementById('chatSection');
            if (chatSection) {
              chatSection.style.display = 'block';
              initChat();
            }
          } else if (data.error) {
            interpretText.textContent = '解卦时发生错误：\\n' + data.error;
          } else {
            interpretText.textContent = '解卦结果获取失败：响应数据格式不正确';
          }
        }
        interpretBtn.disabled = false;
        interpretBtn.textContent = originalText;
      })
      .catch(err => {
        console.error('解卦请求失败:', err);
        if (interpretText) {
          interpretText.textContent = '解卦时出错：' + (err.message || err);
        }
        interpretBtn.disabled = false;
        interpretBtn.textContent = originalText;
      });
    }
    
    // 解卦按钮点击事件（显示支付弹窗）
    function initInterpretButton() {
      const interpretBtn = document.getElementById('interpretBtn');
      if (interpretBtn) {
        interpretBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('解卦按钮被点击');
          
          // 验证必填字段
          if (!validateRequiredFields()) {
            return;
          }
          
          // 显示支付弹窗
          console.log('准备显示支付弹窗');
          showPaymentModal();
          console.log('支付弹窗应该已显示');
        });
        console.log('解卦按钮事件监听已绑定');
      } else {
        console.error('解卦按钮未找到');
      }
    }
    
    // 确保DOM加载完成后再初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initInterpretButton);
    } else {
      initInterpretButton();
    }
    
    // 聊天功能
    let questionCount = 0; // 问题计数，第一个免费
    
    function initChat() {
      const chatInput = document.getElementById('chatInput');
      const chatSubmitBtn = document.getElementById('chatSubmitBtn');
      const chatMessages = document.getElementById('chatMessages');
      const charCount = document.getElementById('charCount');
      
      if (!chatInput || !chatSubmitBtn || !chatMessages) return;
      
      // 字数统计
      chatInput.addEventListener('input', function() {
        const length = this.value.length;
        if (charCount) {
          charCount.textContent = length + '/30';
          if (length >= 30) {
            charCount.classList.add('warning');
          } else {
            charCount.classList.remove('warning');
          }
        }
      });
      
      // 提交问题
      chatSubmitBtn.addEventListener('click', function() {
        const question = chatInput.value.trim();
        if (!question) {
          alert('请输入问题');
          return;
        }
        if (question.length > 30) {
          alert('问题不能超过30字');
          return;
        }
        
        // 检查是否需要支付（第二个问题开始需要支付）
        questionCount++;
        if (questionCount > 1) {
          // 需要支付
          showPaymentModalForQuestion(question);
        } else {
          // 第一个问题免费，直接提交
          submitQuestion(question);
        }
      });
      
      // 回车提交（Shift+Enter换行）
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatSubmitBtn.click();
        }
      });
    }
    
    // 为问题显示支付弹窗
    function showPaymentModalForQuestion(question) {
      // 保存问题到临时变量
      window.pendingQuestion = question;
      showPaymentModal();
    }
    
    // 提交问题
    function submitQuestion(question) {
      const chatInput = document.getElementById('chatInput');
      const chatSubmitBtn = document.getElementById('chatSubmitBtn');
      const chatMessages = document.getElementById('chatMessages');
      
      if (!chatInput || !chatSubmitBtn || !chatMessages) return;
      
      // 禁用输入
      chatInput.disabled = true;
      chatSubmitBtn.disabled = true;
      chatSubmitBtn.textContent = '提交中...';
      
      // 显示用户问题
      addChatMessage('您', question, 'user');
      
      // 清空输入框
      chatInput.value = '';
      const charCount = document.getElementById('charCount');
      if (charCount) {
        charCount.textContent = '0/30';
        charCount.classList.remove('warning');
      }
      
      // 调用后端API
      ensureDefaults();
      const params = serializeForm();
      params.append('question', question);
      params.append('isFollowUp', 'true'); // 标记为后续问题
      
      fetch('/interpret', {
        method: 'POST',
        headers: { 
          'x-fetch': '1',
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        },
        body: params.toString()
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }
        return res.json();
      })
      .then(data => {
        if (data.interpretation) {
          addChatMessage('解卦', data.interpretation, 'assistant');
        } else if (data.error) {
          addChatMessage('系统', '解卦时发生错误：' + data.error, 'assistant');
        } else {
          addChatMessage('系统', '解卦结果获取失败', 'assistant');
        }
      })
      .catch(err => {
        console.error('问题提交失败:', err);
        addChatMessage('系统', '提交问题时出错：' + (err.message || err), 'assistant');
      })
      .finally(() => {
        // 恢复输入
        chatInput.disabled = false;
        chatSubmitBtn.disabled = false;
        chatSubmitBtn.textContent = '提交问题';
        chatInput.focus();
      });
    }
    
    // 添加聊天消息
    function addChatMessage(label, content, type) {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;
      
      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message ' + (type === 'user' ? 'user' : '');
      messageDiv.innerHTML = '<div class="message-label">' + label + '</div><div class="message-content">' + content + '</div>';
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  </script>
  
  <!-- 支付弹窗 -->
  <div id="paymentModal" class="payment-modal">
    <div class="payment-content">
      <button class="close-btn" id="closePaymentBtn">&times;</button>
      <div class="payment-header">
        <h3>支付解卦费用</h3>
        <div class="payment-amount">¥1.00</div>
        <p style="color: #666; font-size: 14px; margin: 0;">支付1元，查看解卦结果</p>
      </div>
      <div class="payment-method">
        <div class="payment-method-icon">微</div>
        <div class="payment-method-text">微信支付</div>
      </div>
      <div id="paymentLoading" class="payment-loading" style="display: none;">
        正在跳转到支付页面...
      </div>
      <div id="paymentSuccess" class="payment-success" style="display: none;">
        ✓ 支付成功！
      </div>
      <div class="payment-buttons">
        <button class="payment-btn payment-btn-cancel" id="cancelPaymentBtn">取消</button>
        <button class="payment-btn payment-btn-primary" id="confirmPaymentBtn">确认支付</button>
      </div>
    </div>
  </div>
</body>
</html>`;
  return html;
}

function renderResultPage(
  payload: InputPayload,
  output: string,
  interpretation?: string,
) {
  const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mystic I Ching Readings - 排盘结果</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: "Times New Roman", "Songti SC", serif;
      min-height: 100vh;
      background: #1a1f3a;
      color: #d4af37;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    body::before {
      content: '';
      position: fixed;
      top: 0;
      right: 0;
      width: 50%;
      height: 100%;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><rect fill="%231a1f3a" width="400" height="600"/><path d="M50 100 L60 500 M80 80 L90 480 M120 120 L130 520 M150 100 L160 500 M180 90 L190 490 M220 110 L230 510 M250 100 L260 500 M280 95 L290 495 M320 105 L330 505" stroke="%232d4a2d" stroke-width="3" opacity="0.3"/></svg>') no-repeat right center;
      background-size: cover;
      opacity: 0.3;
      z-index: 0;
      filter: blur(2px);
    }
    header {
      background: #1a1f3a;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      position: relative;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
    }
    .logo-section {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 30px;
      color: #1a1f3a;
      font-weight: bold;
      border: 2px solid #d4af37;
    }
    .logo-text h1 {
      color: #d4af37;
      font-size: 24px;
      font-weight: normal;
      margin: 0;
    }
    .logo-text p {
      color: #d4af37;
      font-size: 14px;
      margin: 0;
      opacity: 0.9;
    }
    nav {
      display: flex;
      gap: 30px;
    }
    nav a {
      color: #d4af37;
      text-decoration: none;
      font-size: 16px;
      transition: opacity 0.3s;
    }
    nav a:hover {
      opacity: 0.7;
    }
    main {
      flex: 1;
      position: relative;
      z-index: 1;
      padding: 40px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .container {
      background: rgba(255, 255, 255, 0.95);
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      max-width: 800px;
      width: 100%;
      backdrop-filter: blur(10px);
    }
    h1 { 
      color: #1a1f3a; 
      font-size: 32px;
      margin-bottom: 30px;
      text-align: center;
    }
    pre { 
      background: #f5f5f5; 
      padding: 20px; 
      white-space: pre-wrap; 
      border-radius: 8px;
      font-family: "Courier New", monospace;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1f3a;
      border: 1px solid #ddd;
    }
    button { 
      margin-top: 20px; 
      padding: 12px 24px; 
      background: #4CAF50; 
      color: white; 
      border: none; 
      border-radius: 8px; 
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
    }
    button:hover { 
      background: #45a049; 
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
    }
    footer {
      background: #1a1f3a;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
      position: relative;
      border-top: 1px solid rgba(212, 175, 55, 0.2);
    }
    .footer-links {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    .footer-links a {
      color: #d4af37;
      text-decoration: none;
      font-size: 14px;
      transition: opacity 0.3s;
    }
    .footer-links a:hover {
      opacity: 0.7;
    }
    .social-icons {
      display: flex;
      gap: 15px;
    }
    .social-icon {
      width: 32px;
      height: 32px;
      background: #d4af37;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1a1f3a;
      text-decoration: none;
      font-size: 16px;
      transition: all 0.3s;
    }
    .social-icon:hover {
      background: #f4d03f;
      transform: scale(1.1);
    }
    /* 移动端适配 */
    @media (max-width: 768px) {
      header, footer {
        flex-direction: column;
        gap: 15px;
        text-align: center;
        padding: 15px 20px;
      }
      .logo {
        width: 50px;
        height: 50px;
        font-size: 24px;
      }
      .logo-text h1 {
        font-size: 20px;
      }
      .logo-text p {
        font-size: 12px;
      }
      nav {
        flex-wrap: wrap;
        justify-content: center;
        gap: 15px;
      }
      nav a {
        font-size: 14px;
      }
      main {
        padding: 20px 15px;
      }
      .container {
        padding: 20px 15px;
        border-radius: 8px;
      }
      h1 {
        font-size: 24px;
        margin-bottom: 20px;
      }
      pre {
        padding: 15px;
        font-size: 12px;
        line-height: 1.5;
        overflow-x: auto;
      }
      button {
        padding: 12px 20px;
        font-size: 15px;
        width: 100%;
        max-width: 300px;
      }
      .footer-links {
        flex-direction: column;
        gap: 15px;
      }
      .footer-links a {
        font-size: 12px;
      }
      .social-icons {
        gap: 10px;
      }
      .social-icon {
        width: 28px;
        height: 28px;
        font-size: 14px;
      }
    }
    @media (max-width: 480px) {
      header, footer {
        padding: 12px 15px;
      }
      .logo {
        width: 40px;
        height: 40px;
        font-size: 20px;
      }
      .logo-text h1 {
        font-size: 18px;
      }
      main {
        padding: 15px 10px;
      }
      .container {
        padding: 15px 12px;
      }
      h1 {
        font-size: 20px;
        margin-bottom: 15px;
      }
      pre {
        padding: 12px;
        font-size: 11px;
      }
      button {
        padding: 10px 20px;
        font-size: 14px;
      }
      nav a {
        font-size: 12px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <nav>
      <a href="/">Free Reading</a>
      <a href="#">My Journal</a>
      <a href="#">About Us</a>
    </nav>
  </header>
  
  <main>
    <div class="container">
      <div class="result-section">
        <h2>排盘结果</h2>
        <pre>${output}</pre>
        ${
          !interpretation
            ? `<form method="POST" action="/interpret" style="display:none;">
                 <input type="hidden" name="location" value="${payload.location}" />
                 <input type="hidden" name="timezone" value="${payload.timezone}" />
                 <input type="hidden" name="datetime" value="${payload.datetime}" />
                 <input type="hidden" name="querentName" value="${payload.querentName}" />
                 <input type="hidden" name="question" value="${payload.question}" />
                 ${payload.lines ? payload.lines.map((line, idx) => `
                   <input type="hidden" name="line${idx}_index" value="${line.index}" />
                   <input type="hidden" name="line${idx}_type" value="${line.type}" />
                   <input type="hidden" name="line${idx}_isMoving" value="${line.isMoving}" />
                 `).join("") : ""}
                 <button type="submit" class="interpret-btn">解卦</button>
               </form>`
            : ""
        }
        ${interpretation ? `<h2>解卦</h2><pre>${interpretation}</pre>` : ""}
      </div>
    </div>
  </main>
  
  <footer>
    <div class="logo-section">
      <div class="logo">☯</div>
      <div class="logo-text">
        <h1>Mystic I Ching Readings</h1>
        <p>Unlock Ancient Wisdom</p>
      </div>
    </div>
    <div class="footer-links">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
      <div class="social-icons">
        <a href="#" class="social-icon" title="Twitter">🐦</a>
        <a href="#" class="social-icon" title="Instagram">📷</a>
        <a href="#" class="social-icon" title="YouTube">▶</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
  return html;
}

function renderAdminPage() {
  const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>六爻管理后台</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #2196F3;
    }
    .section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 20px;
      margin-bottom: 15px;
    }
    .chart-container {
      position: relative;
      height: 300px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f9f9f9;
      font-weight: 600;
      color: #666;
    }
    tr:hover {
      background: #f5f5f5;
    }
    .btn {
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin-right: 10px;
    }
    .btn:hover {
      background: #45a049;
    }
    .btn-secondary {
      background: #2196F3;
    }
    .btn-secondary:hover {
      background: #0b7dda;
    }
    .actions {
      margin-bottom: 20px;
    }
    .status-success {
      color: #4CAF50;
      font-weight: 600;
    }
    .status-pending {
      color: #ff9800;
      font-weight: 600;
    }
    .status-failed {
      color: #f44336;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>六爻管理后台</h1>
    <p>数据统计与管理</p>
  </div>
  
  <div class="stats" id="stats">
    <div class="stat-card">
      <h3>总使用次数</h3>
      <div class="value" id="totalUsage">0</div>
    </div>
    <div class="stat-card">
      <h3>账户总额</h3>
      <div class="value" id="totalAmount">¥0.00</div>
    </div>
    <div class="stat-card">
      <h3>成功支付次数</h3>
      <div class="value" id="successfulPayments">0</div>
    </div>
  </div>
  
  <div class="section">
    <h2>使用量趋势</h2>
    <div class="chart-container">
      <canvas id="usageChart"></canvas>
    </div>
  </div>
  
  <div class="section">
    <h2>支付金额趋势</h2>
    <div class="chart-container">
      <canvas id="paymentChart"></canvas>
    </div>
  </div>
  
  <div class="section">
    <div class="actions">
      <button class="btn btn-secondary" id="refreshDataBtn">刷新数据</button>
      <button class="btn" id="exportExcelBtn">导出Excel</button>
    </div>
    <h2>使用记录</h2>
    <div style="overflow-x: auto;">
      <table id="usageTable">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>问题</th>
            <th>地点</th>
            <th>类型</th>
          </tr>
        </thead>
        <tbody id="usageTableBody">
        </tbody>
      </table>
    </div>
  </div>
  
  <div class="section">
    <h2>支付记录</h2>
    <div style="overflow-x: auto;">
      <table id="paymentTable">
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>金额</th>
            <th>描述</th>
            <th>订单号</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody id="paymentTableBody">
        </tbody>
      </table>
    </div>
  </div>
  
  <script>
    let usageChart = null;
    let paymentChart = null;
    const token = new URLSearchParams(location.search).get('token') || '';
    window.pendingQuestion = null;
    
    async function loadData() {
      try {
        const response = await fetch('/admin/api/data?token=' + encodeURIComponent(token));
        const data = await response.json();
        
        // 更新统计数据
        document.getElementById('totalUsage').textContent = data.statistics.totalUsage;
        document.getElementById('totalAmount').textContent = '¥' + data.statistics.totalAmount.toFixed(2);
        document.getElementById('successfulPayments').textContent = data.statistics.successfulPayments;
        
        // 更新图表
        updateCharts(data.statistics);
        
        // 更新表格
        updateUsageTable(data.usageRecords);
        updatePaymentTable(data.paymentRecords);
      } catch (error) {
        console.error('加载数据失败:', error);
        alert('加载数据失败，请刷新页面重试');
      }
    }
    
    function updateCharts(statistics) {
      // 使用量趋势图
      const usageLabels = Object.keys(statistics.usageByDate).sort();
      const usageData = usageLabels.map(date => statistics.usageByDate[date]);
      
      if (usageChart) {
        usageChart.destroy();
      }
      
      const usageCtx = document.getElementById('usageChart').getContext('2d');
      usageChart = new Chart(usageCtx, {
        type: 'bar',
        data: {
          labels: usageLabels,
          datasets: [{
            label: '使用次数',
            data: usageData,
            backgroundColor: 'rgba(33, 150, 243, 0.5)',
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
      
      // 支付金额趋势图
      const paymentLabels = Object.keys(statistics.paymentByDate).sort();
      const paymentData = paymentLabels.map(date => statistics.paymentByDate[date]);
      
      if (paymentChart) {
        paymentChart.destroy();
      }
      
      const paymentCtx = document.getElementById('paymentChart').getContext('2d');
      paymentChart = new Chart(paymentCtx, {
        type: 'line',
        data: {
          labels: paymentLabels,
          datasets: [{
            label: '支付金额（元）',
            data: paymentData,
            backgroundColor: 'rgba(76, 175, 80, 0.2)',
            borderColor: 'rgba(76, 175, 80, 1)',
            borderWidth: 2,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
    
    function updateUsageTable(records) {
      const tbody = document.getElementById('usageTableBody');
      tbody.innerHTML = records.map(record => {
        const date = new Date(record.timestamp).toLocaleString('zh-CN');
        const type = record.type === 'initial' ? '首次解卦' : '后续问题';
        return \`
          <tr>
            <td>\${date}</td>
            <td>\${record.userName}</td>
            <td>\${record.question}</td>
            <td>\${record.location}</td>
            <td>\${type}</td>
          </tr>
        \`;
      }).join('');
    }
    
    function updatePaymentTable(records) {
      const tbody = document.getElementById('paymentTableBody');
      tbody.innerHTML = records.map(record => {
        const date = new Date(record.timestamp).toLocaleString('zh-CN');
        const amount = (record.amount / 100).toFixed(2) + '元';
        let statusClass = '';
        let statusText = '';
        if (record.status === 'success') {
          statusClass = 'status-success';
          statusText = '成功';
        } else if (record.status === 'pending') {
          statusClass = 'status-pending';
          statusText = '待支付';
        } else {
          statusClass = 'status-failed';
          statusText = '失败';
        }
        return \`
          <tr>
            <td>\${date}</td>
            <td>\${record.userName}</td>
            <td>\${amount}</td>
            <td>\${record.description}</td>
            <td>\${record.orderId}</td>
            <td class="\${statusClass}">\${statusText}</td>
          </tr>
        \`;
      }).join('');
    }
    
    function refreshData() {
      loadData();
    }
    
    function exportExcel() {
      window.location.href = '/admin/api/export?token=' + encodeURIComponent(token);
    }
    
    // 绑定按钮事件（避免 CSP 错误）
    document.addEventListener('DOMContentLoaded', function() {
      const refreshBtn = document.getElementById('refreshDataBtn');
      const exportBtn = document.getElementById('exportExcelBtn');
      
      if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
      }
      
      if (exportBtn) {
        exportBtn.addEventListener('click', exportExcel);
      }
    });
    
    // 页面加载时获取数据
    loadData();
    
    // 每30秒自动刷新
    setInterval(loadData, 30000);
  </script>
</body>
</html>`;
  return html;
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  let userId = getCookie(req, "uid");
  if (!userId) {
    userId = randomUUID();
    setCookie(res, "uid", userId);
  }
  ensureUser(userId);

  // 摇卦页面
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderShakePage());
    return;
  }

  // 管理后台
  if (req.method === "GET" && url.pathname === "/admin") {
    const token = url.searchParams.get("token");
    if (!token || token !== ADMIN_TOKEN) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <!doctype html>
        <html lang="zh">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>管理后台 - 需要授权</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
              margin: 0;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 { color: #333; margin-bottom: 20px; }
            p { color: #666; margin-bottom: 30px; }
            a {
              display: inline-block;
              padding: 12px 24px;
              background: #4CAF50;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
            }
            a:hover { background: #45a049; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>需要授权访问</h1>
            <p>管理后台需要有效的访问令牌</p>
            <a href="/">返回首页</a>
          </div>
        </body>
        </html>
      `);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderAdminPage());
    return;
  }

  // 处理摇卦提交
  if (req.method === "POST" && url.pathname === "/shake") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const form = decodeBody(body);
        const lines = parseLines(form);
        
        if (lines.length !== 6) {
          const payload: Partial<InputPayload> = {
            location: form.location ?? "",
            timezone: form.timezone ?? "",
            datetime: form.datetime ?? "",
            querentName: form.querentName ?? "",
            question: form.question ?? "",
          };
          if (req.headers["x-fetch"] === "1") {
            res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ error: "请完成六次摇卦" }));
          } else {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(renderShakePage("请完成六次摇卦", payload, lines));
          }
          return;
        }
        
        const payload: InputPayload = {
          location: form.location ?? "",
          timezone: form.timezone ?? "",
          datetime: form.datetime ?? "",
          querentName: form.querentName ?? "",
          question: form.question ?? "",
          lines: lines,
        };
        validateInput(payload);
        const output = formatResult(payload);
        // 记录使用（摇卦完成）
        logUsage({
          userId,
          action: "shake",
          question: payload.question,
          amount: 0,
          status: "ok",
        });
        if (req.headers["x-fetch"] === "1") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ output }));
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderResultPage(payload, output));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (req.headers["x-fetch"] === "1") {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: message }));
        } else {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderShakePage(message));
        }
      }
    });
    return;
  }

  // 创建支付订单
  if (req.method === "POST" && url.pathname === "/create-payment") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const amount = data.amount || 100; // 默认1元（100分）
        
        // TODO: 这里应该调用微信支付API创建订单
        // 目前返回模拟数据，实际使用时需要：
        // 1. 调用微信支付统一下单API
        // 2. 生成支付参数或支付URL
        // 3. 返回给前端
        
        // 模拟返回（开发环境）
        // 实际环境需要替换为真实的微信支付逻辑
        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        
        // 记录支付订单（模拟直接成功）
        logPayment({
          userId,
          orderId,
          amount,
          status: "success",
        });
        
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({
          code: 0,
          message: "订单创建成功",
          orderId: orderId,
          amount: amount,
          // 实际环境应该返回真实的支付参数
          // paymentUrl: "https://pay.weixin.qq.com/...", // H5支付URL
          // 或 wechatPayParams: { ... } // JSAPI支付参数
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ code: -1, message: "创建订单失败：" + message }));
      }
    });
    return;
  }

  // 管理后台API
  if (req.method === "GET" && url.pathname === "/admin/api/data") {
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
      // 组装前端期望的数据结构
      const usageByDate: Record<string, number> = {};
      const paymentAmountByDate: Record<string, number> = {};
      stats.usageDaily.forEach((d) => (usageByDate[d.date] = d.count));
      stats.revenueDaily.forEach((d) => (paymentAmountByDate[d.date] = d.amount));

      const usageRecords = usageLogs.map((u: any) => ({
        timestamp: u.createdAt,
        userName: u.userId,
        question: u.question,
        location: "", // 暂无位置数据
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
  if (req.method === "GET" && url.pathname === "/admin/api/export") {
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


  // 解卦
  if (req.method === "POST" && url.pathname === "/interpret") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", async () => {
      try {
        const form = decodeBody(body);
        const lines = parseLines(form);
        const payload: InputPayload = {
          location: form.location ?? "",
          timezone: form.timezone ?? "",
          datetime: form.datetime ?? "",
          querentName: form.querentName ?? "",
          question: form.question ?? "",
          lines: lines.length > 0 ? lines : undefined,
        };
        validateInput(payload);
        const result = calculate(payload);
        const output = formatResult(payload);
        const interpretation = await interpretWithGemini(payload, result);
        
        // 记录使用数据
        const isFollowUp = form.isFollowUp === "true";
        logUsage({
          userId,
          action: isFollowUp ? "followup" : "interpret",
          question: payload.question || "未填写",
          amount: 0,
          status: "ok",
        });
        
        if (req.headers["x-fetch"] === "1") {
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ output, interpretation }));
        } else {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderResultPage(payload, output, interpretation));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (req.headers["x-fetch"] === "1") {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: message }));
        } else {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(renderShakePage(message));
        }
      }
    });
    return;
  }

  // 静态文件服务 - 提供图片
  if (req.method === "GET" && url.pathname.startsWith("/images/")) {
    // 从项目根目录的public文件夹读取（编译后在dist目录，需要向上两级到项目根目录）
    const projectRoot = path.resolve(__dirname, "..");
    const filePath = path.join(projectRoot, "public", url.pathname);
    try {
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Image not found. Please place leaf-yang.png in public/images/");
        return;
      }
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Error reading image file");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`六爻排盘服务已启动: http://localhost:${PORT}`);
});
