# 启用 Gemini API 指南

根据错误信息，您需要先在 Google Cloud Console 中启用 Generative Language API。

## 步骤 1：启用 Generative Language API

1. **访问 Google Cloud Console**
   - 网址：https://console.cloud.google.com/
   - 使用创建 API Key 时使用的 Google 账号登录

2. **选择项目**
   - 在页面顶部，点击项目选择器
   - 选择您创建 API Key 时使用的项目（如：`liuyao-app`）

3. **启用 API**
   - 在左侧菜单中，点击 "API 和服务" > "库"（或直接访问：https://console.cloud.google.com/apis/library）
   - 在搜索框中输入：`Generative Language API`
   - 点击搜索结果中的 "Generative Language API"
   - 点击 "启用" 按钮
   - 等待几秒钟，直到显示 "API 已启用"

## 步骤 2：验证 API Key 权限

1. **检查 API Key 限制**
   - 访问：https://console.cloud.google.com/apis/credentials
   - 找到您的 API Key（名称：`六爻起卦`）
   - 点击 API Key 名称进入详情页
   - 在 "API 限制" 部分：
     - 如果选择 "限制密钥"，确保 "Generative Language API" 在允许列表中
     - 或者选择 "不限制密钥"（仅用于测试）

## 步骤 3：测试

启用 API 后：
1. 等待 1-2 分钟让更改生效
2. 刷新浏览器页面
3. 重新尝试解卦功能

## 常见问题

**Q: 启用 API 需要付费吗？**
A: 免费配额通常足够个人使用。某些高级功能可能需要启用结算，但基础使用是免费的。

**Q: 启用后仍然报错？**
A: 
- 等待几分钟让更改生效
- 确认选择了正确的项目
- 检查 API Key 是否属于当前项目

**Q: 找不到 Generative Language API？**
A: 
- 确保在正确的项目中
- 尝试搜索 "Gemini API" 或 "Generative AI API"
- 确认账号有权限访问该 API

