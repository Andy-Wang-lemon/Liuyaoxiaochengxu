# 六爻摇卦小程序

## 📱 项目简介

这是六爻摇卦应用的微信小程序版本，功能与网页版完全一致，只是换了一种展现形式。

## 🎯 主要功能

1. **六爻摇卦** - 通过随机生成模拟传统摇卦过程
2. **排盘分析** - 自动生成四柱八字和六爻详情
3. **AI解卦** - 使用千问Turbo模型生成专业解卦内容
4. **微信支付** - 支付3元解卦（支持模拟支付模式）
5. **数据记录** - 所有操作记录到后端数据库

## 📂 目录结构

```
miniprogram/
├── app.js              # 小程序入口
├── app.json            # 小程序配置
├── app.wxss            # 全局样式
├── project.config.json # 项目配置
├── sitemap.json        # 站点地图
├── pages/              # 页面目录
│   ├── shake/         # 摇卦主页面
│   │   ├── shake.wxml
│   │   ├── shake.wxss
│   │   ├── shake.js
│   │   └── shake.json
│   └── admin/         # 管理后台（跳转提示）
│       ├── admin.wxml
│       ├── admin.wxss
│       ├── admin.js
│       └── admin.json
├── components/         # 组件目录
│   └── payment-modal/ # 支付弹窗组件
│       ├── payment-modal.wxml
│       ├── payment-modal.wxss
│       ├── payment-modal.js
│       └── payment-modal.json
└── utils/             # 工具目录
    └── api.js         # API调用封装
```

## 🚀 快速开始

### 1. 准备工作

#### 需要的工具
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 小程序AppID（[申请地址](https://mp.weixin.qq.com/)）

#### 后端服务
确保后端服务器已启动：
```bash
cd /Users/shitou/Desktop/六爻开发
node dist/server-api.js
```

服务器应该运行在 `http://localhost:3003`

### 2. 配置小程序

#### 修改AppID
编辑 `project.config.json`，将 `appid` 改为你的小程序AppID：
```json
{
  "appid": "你的小程序AppID"
}
```

#### 配置服务器地址
编辑 `app.js` 和 `utils/api.js`，修改服务器地址：
```javascript
// 开发环境
serverUrl: 'http://localhost:3003'

// 生产环境（需要配置合法域名）
serverUrl: 'https://你的域名.com'
```

### 3. 导入项目

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择 `miniprogram` 文件夹
4. 填入AppID
5. 点击"导入"

### 4. 开发调试

#### 开启本地服务器调试
1. 在微信开发者工具中，点击右上角"详情"
2. 勾选"不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书"
3. 这样就可以访问 localhost 了

#### 编译运行
1. 点击工具栏的"编译"按钮
2. 在模拟器中查看效果
3. 可以在真机上预览测试

## 💡 使用说明

### 摇卦流程

1. **填写信息**
   - 起卦地点（如：北京）
   - 时区（默认：Asia/Shanghai）
   - 测算人姓名
   - 所问何事

2. **摇卦6次**
   - 点击"摇卦"按钮
   - 每次生成一爻
   - 完成6次后自动生成排盘

3. **支付解卦**
   - 点击"解卦"按钮
   - 弹出支付窗口（¥3.00）
   - 开发模式下点击"生成二维码"自动成功
   - 生产模式需真实支付

4. **查看结果**
   - 支付成功后自动显示AI解卦内容

## 🔧 配置说明

### 支付模式

#### 模拟支付模式（当前）
- 适合开发测试
- 点击"生成二维码"直接成功
- 不产生真实交易

#### 真实支付模式
需要配置微信支付：
1. 申请微信支付商户号
2. 配置后端 `.env` 文件
3. 在小程序后台配置支付参数

### API服务器

#### 开发环境
```javascript
const BASE_URL = 'http://localhost:3003/api';
```

#### 生产环境
需要修改为你的实际域名：
```javascript
const BASE_URL = 'https://你的域名.com/api';
```

**注意**：生产环境必须配置合法域名并启用HTTPS

## 📊 与网页版的差异

| 特性 | 网页版 | 小程序版 |
|------|--------|---------|
| 界面 | Vue3 + 浏览器 | 微信小程序原生 |
| 路由 | Vue Router | 小程序页面栈 |
| 状态管理 | Vue Composition API | 小程序data |
| HTTP请求 | axios | wx.request |
| 支付 | 微信扫码 | 小程序支付 |
| 部署 | Web服务器 | 微信平台 |

## 🌐 服务器配置

### 合法域名配置

生产环境需要在小程序后台配置服务器域名：

1. 登录[小程序管理后台](https://mp.weixin.qq.com/)
2. 进入"开发" → "开发管理" → "开发设置"
3. 配置"服务器域名"：
   - request合法域名：`https://你的域名.com`
4. 确保域名已备案且支持HTTPS

### 后端CORS配置

后端已配置CORS，支持小程序访问：
```javascript
res.setHeader("Access-Control-Allow-Origin", "*");
```

## 📱 发布上线

### 1. 代码审核前

- [ ] 修改所有 `localhost` 为实际域名
- [ ] 配置小程序后台的服务器域名
- [ ] 配置微信支付（如需真实支付）
- [ ] 测试所有功能正常

### 2. 提交审核

1. 点击工具栏"上传"按钮
2. 填写版本号和项目备注
3. 登录小程序后台提交审核
4. 等待审核通过（一般1-3天）

### 3. 发布上线

审核通过后，在后台点击"发布"即可正式上线

## ⚠️ 注意事项

### 开发阶段
1. 勾选"不校验合法域名"才能访问localhost
2. 支付功能使用模拟模式测试
3. 及时保存代码避免丢失

### 生产环境
1. 必须使用HTTPS域名
2. 必须在小程序后台配置合法域名
3. 需要申请真实微信支付
4. 建议添加错误上报和数据统计

### 安全提示
1. 不要将AppID和密钥提交到公开仓库
2. 生产环境的服务器地址要妥善保管
3. 定期更新小程序版本修复bug

## 🔗 相关链接

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信开发者工具下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- [小程序注册](https://mp.weixin.qq.com/wxopen/waregister?action=step1)
- [微信支付接入指南](https://pay.weixin.qq.com/wiki/doc/apiv3/open/pay/chapter2_8_0.shtml)

## 💬 技术支持

如有问题，请检查：
1. 后端服务器是否正常运行
2. 网络请求是否配置正确
3. 开发者工具控制台的错误信息
4. 小程序后台的域名配置

## 📄 版本信息

- **版本**: 1.0.0
- **开发时间**: 2026-01-18
- **框架**: 微信小程序原生框架
- **最低基础库版本**: 2.19.4
- **后端**: Node.js + 千问Turbo AI

---

**祝使用愉快！** 🎉
