// app.js
App({
  globalData: {
    userInfo: null,
    serverUrl: 'http://localhost:3003' // 开发环境，生产环境需要改为实际域名
  },
  
  onLaunch() {
    console.log('问小易小程序启动');
    
    // 检查登录状态
    const userId = wx.getStorageSync('userId');
    if (!userId) {
      // 生成唯一用户ID
      const newUserId = this.generateUserId();
      wx.setStorageSync('userId', newUserId);
    }
  },
  
  generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
})
