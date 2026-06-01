# 六爻摇卦 - 微信小程序版

## 📱 项目简介

这是一个六爻摇卦应用的微信小程序版本，包含完整的摇卦、排盘、AI解卦功能，支持微信支付。

## 🏗️ 项目结构

```
六爻开发/
├── miniprogram/          # 微信小程序前端代码
│   ├── pages/           # 小程序页面
│   │   ├── shake/      # 摇卦主页
│   │   └── admin/      # 管理后台提示页
│   ├── components/      # 小程序组件
│   │   └── payment-modal/  # 支付弹窗
│   ├── utils/          # 工具函数
│   │   └── api.js      # API调用封装
│   ├── app.js          # 小程序入口
│   ├── app.json        # 全局配置
│   └── app.wxss        # 全局样式
│
├── src/                 # 后端源代码（TypeScript）
│   ├── api/            # API相关
│   ├── services/       # 业务逻辑
│   │   ├── hexagram.ts    # 六爻计算
│   │   ├── interpret.ts   # AI解卦
│   │   ├── pillars.ts     # 四柱八字
│   │   └── wechat-pay.ts  # 微信支付
│   ├── db.ts           # 数据库操作
│   └── server-api.ts   # API服务器
│
├── dist/               # 后端编译输出
├── data/               # SQLite数据库
├── public/             # 公共资源
└── 文档/               # 各种说明文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# 阿里云百炼 API（必填）
DASHSCOPE_API_KEY=sk-096cc7facdbe4433a3a4681a787852f2
QWEN_MODEL=qwen-turbo

# 服务器配置
PORT=3003

# 管理后台令牌
ADMIN_TOKEN=admin

# 微信支付（可选，不配置则使用模拟支付）
WECHAT_APPID=你的应用ID
WECHAT_MCHID=你的商户号
WECHAT_SERIAL_NO=证书序列号
WECHAT_APIV3_KEY=APIv3密钥
WECHAT_NOTIFY_URL=https://你的域名.com/api/payment-notify
```

### 3. 启动后端服务

```bash
# 开发模式（自动重载）
npm run server

# 或者先编译再运行
npm run build
npm start
```

服务器将在 `http://localhost:3003` 启动

### 4. 打开小程序

1. 下载并安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具
3. 导入项目，目录选择：`miniprogram/`
4. AppID选择"测试号"或输入你的小程序AppID
5. 点击"详情" → 勾选"不校验合法域名"（开发阶段）
6. 点击"编译"运行

## 💡 主要功能

### 1. 六爻摇卦
- 模拟传统摇卦过程
- 动画效果展示
- 自动记录6次摇卦结果

### 2. 排盘分析
- 自动计算四柱八字
- 生成六爻卦象
- 标注世爻应爻

### 3. AI解卦
- 使用阿里云千问Turbo模型
- 专业的解卦分析
- 个性化建议

### 4. 微信支付
- 支持真实微信支付（3元/次）
- 开发阶段支持模拟支付
- 自动记录支付数据

### 5. 数据管理
- SQLite数据库存储
- 记录使用和支付数据
- 管理后台查看统计

## 🔧 开发说明

### 后端API

服务器提供以下API：

- `POST /api/shake` - 生成排盘结果
- `POST /api/interpret` - AI解卦
- `POST /api/create-payment` - 创建支付订单
- `GET /api/query-order` - 查询订单状态
- `POST /api/payment-notify` - 支付回调（微信调用）
- `GET /api/admin/data` - 管理后台数据

### 小程序开发

小程序使用微信原生框架：
- `.wxml` - 页面结构
- `.wxss` - 页面样式
- `.js` - 页面逻辑
- `.json` - 页面配置

API调用通过 `utils/api.js` 封装

## 📚 文档

- **小程序快速开始.md** - 小程序开发入门
- **小程序部署指南.md** - 上线部署步骤
- **API密钥获取指南.md** - Gemini API配置
- **微信支付配置说明.md** - 支付功能配置
- **支付功能说明.md** - 支付详细说明

## 🔐 安全注意事项

1. ⚠️ 不要将 `.env` 文件提交到代码仓库
2. ⚠️ 不要将微信支付证书提交到仓库
3. ⚠️ 生产环境必须使用HTTPS
4. ⚠️ 定期备份 `data/app.db` 数据库

## 📊 技术栈

### 前端（小程序）
- 微信小程序原生框架
- JavaScript

### 后端
- Node.js
- TypeScript
- Better-SQLite3
- 阿里云百炼（千问Turbo）

## 🌐 部署上线

详细步骤请查看：`小程序部署指南.md`

简要流程：
1. 申请小程序AppID
2. 部署后端到服务器（HTTPS）
3. 配置小程序后台的服务器域名
4. 修改小程序代码中的服务器地址
5. 上传代码提交审核
6. 审核通过后发布

## 💰 费用说明

- **千问API**: 约¥0.0005/次解卦（输入+输出）
- **解卦收费**: ¥3.00/次（可修改）
- **服务器**: 根据实际部署情况
- **小程序**: 个人300元/年，企业300元/年

## 📞 技术支持

如有问题：
1. 查看对应的文档说明
2. 检查控制台错误信息
3. 查看服务器日志
4. 查询微信小程序官方文档

## 📝 更新日志

### v1.0.0 (2026-01-18)
- ✅ 初始版本
- ✅ 完整的摇卦功能
- ✅ AI解卦（千问Turbo）
- ✅ 微信支付集成
- ✅ 数据记录和管理

## 📄 许可证

本项目仅供学习交流使用。

---

**祝使用愉快！** 🎉
