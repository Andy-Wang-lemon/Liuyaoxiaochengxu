# 六爻应用 - Vue 版本

## 项目结构

```
六爻开发/
├── frontend/              # Vue 3 前端应用
│   ├── src/
│   │   ├── components/   # Vue 组件
│   │   ├── pages/         # 页面组件
│   │   ├── api/          # API 调用
│   │   └── types.ts       # TypeScript 类型定义
│   └── index.html
├── src/                   # 后端服务器代码
│   ├── server-api.ts      # API 服务器
│   └── ...
└── dist-frontend/         # 构建后的前端文件
```

## 开发模式

### 同时运行前端和后端（推荐）

```bash
npm run dev:all
```

这将同时启动：
- 后端 API 服务器（端口 3003）
- 前端开发服务器（端口 5173）

### 分别运行

**后端服务器：**
```bash
npm run web
```

**前端开发服务器：**
```bash
npm run dev:frontend
```

## 生产模式

1. 构建前端：
```bash
npm run build:frontend
```

2. 启动服务器：
```bash
npm run web
```

服务器会自动提供构建后的前端文件和 API 服务。

## 主要功能

- ✅ 摇卦功能（Vue 组件化）
- ✅ 支付弹窗（Vue 组件）
- ✅ 聊天功能（Vue 组件）
- ✅ 管理后台（Vue 页面）
- ✅ API 分离（RESTful API）
- ✅ 响应式设计（移动端适配）

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Vue Router
- **后端**: Node.js + TypeScript
- **数据库**: SQLite (better-sqlite3)
- **图表**: Chart.js

## 访问地址

- 前端应用: http://localhost:5173 (开发模式) 或 http://localhost:3003 (生产模式)
- API 端点: http://localhost:3003/api/*
- 管理后台: http://localhost:3003/admin?token=admin


