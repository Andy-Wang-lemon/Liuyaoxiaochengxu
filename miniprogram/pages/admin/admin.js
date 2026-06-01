// pages/admin/admin.js
Page({
  data: {
    adminUrl: 'http://localhost:3003/admin'
  },

  copyUrl() {
    wx.setClipboardData({
      data: this.data.adminUrl,
      success: () => {
        wx.showToast({
          title: '地址已复制',
          icon: 'success'
        });
      }
    });
  },

  backToHome() {
    wx.switchTab({
      url: '/pages/shake/shake'
    });
  }
});
