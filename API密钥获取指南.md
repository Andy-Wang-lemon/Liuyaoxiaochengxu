# Gemini API Key 获取指南

## 方法一：Google AI Studio（推荐，最简单）

1. **访问 Google AI Studio**
   - 网址：https://aistudio.google.com/app/apikey
   - 或：https://makersuite.google.com/app/apikey

2. **登录 Google 账号**
   - 使用您的 Google 账号登录

3. **创建 API Key**
   - 点击页面上的 "Create API Key" 或 "创建 API 密钥" 按钮
   - 如果弹出对话框：
     - **"给你的钥匙起个名字"**：输入任意名称（如：`六爻解卦`）
     - **"选择一个导入的项目"**：显示"暂无云项目可用"时，**可以直接跳过**，或者：
       - 点击下拉框
       - 选择 "Create new project" 或 "创建新项目"
       - 输入项目名称（如：`liuyao-app`）
     - 点击 **"创建密钥"** 或 **"Create Key"** 按钮

4. **复制 API Key**
   - 创建成功后，会显示您的 API Key（格式：`AIzaSyB...`）
   - **重要**：立即复制并保存，因为只显示一次！

## 方法二：如果无法创建项目

如果遇到"暂无云项目可用"且无法创建项目，可以尝试：

1. **访问 Google Cloud Console**
   - 网址：https://console.cloud.google.com/

2. **创建新项目**
   - 点击页面顶部的项目选择器
   - 点击 "新建项目" 或 "New Project"
   - 输入项目名称（如：`liuyao-app`）
   - 点击 "创建"

3. **启用 Gemini API**
   - 在项目中，搜索 "Generative Language API"
   - 点击启用

4. **创建 API Key**
   - 转到 "API 和服务" > "凭据"
   - 点击 "创建凭据" > "API 密钥"
   - 复制生成的 API Key

## 配置到项目

创建 API Key 后：

1. **创建 .env 文件**
   ```bash
   cd /Users/Clara/Desktop/六爻开发
   touch .env
   ```

2. **编辑 .env 文件，添加：**
   ```
   GEMINI_API_KEY=你复制的API密钥
   ```
   例如：
   ```
   GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **重启服务器**
   ```bash
   PORT=3003 npm run web
   ```

## 常见问题

**Q: 显示"暂无云项目可用"怎么办？**
A: 可以直接填写密钥名称，然后点击"创建密钥"。项目选择不是必须的。

**Q: 创建密钥按钮是灰色的？**
A: 确保已填写"密钥名称"字段，项目选择可以留空。

**Q: 创建后找不到 API Key？**
A: API Key 只在创建时显示一次。如果丢失，需要重新创建。

**Q: 免费使用有限制吗？**
A: 免费版有使用配额限制，但对于个人使用通常足够。

