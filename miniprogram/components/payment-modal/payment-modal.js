// components/payment-modal/payment-modal.js
const api = require('../../utils/api.js');

Component({
  properties: {
    amount: {
      type: Number,
      value: 4.00
    }
  },

  data: {
    loading: false,
    success: false,
    error: '',
    qrCode: '',
    orderId: '',
    statusText: '等待支付...',
    pollingTimer: null
  },

  lifetimes: {
    detached() {
      // 组件销毁时清除轮询
      if (this.data.pollingTimer) {
        clearInterval(this.data.pollingTimer);
      }
    }
  },

  methods: {
    handleClose() {
      this.triggerEvent('close');
    },

    handleMaskTap() {
      this.handleClose();
    },

    stopPropagation() {
      // 阻止事件冒泡
    },

    async handleConfirm() {
      this.setData({
        loading: true,
        error: ''
      });

      try {
        // 创建支付订单
        const result = await api.createPayment(
          Math.round(this.properties.amount * 100), // 转换为分
          '六爻排盘与解卦服务',
          '用户'
        );

        if (result.code === 0) {
          this.setData({
            orderId: result.orderId
          });

          if (result.mockMode) {
            // 模拟模式：直接成功
            this.setData({
              success: true,
              loading: false
            });

            setTimeout(() => {
              this.triggerEvent('success');
            }, 1000);
          } else if (result.qrCode) {
            // 真实微信支付：显示二维码
            this.setData({
              qrCode: result.qrCode,
              loading: false
            });

            // 开始轮询订单状态
            this.startPolling();
          } else {
            this.setData({
              error: '获取支付二维码失败',
              loading: false
            });
          }
        } else {
          this.setData({
            error: result.message || '创建订单失败',
            loading: false
          });
        }
      } catch (err) {
        console.error('支付请求失败:', err);
        this.setData({
          error: err.message || '支付请求失败',
          loading: false
        });
      }
    },

    // 轮询查询订单状态
    startPolling() {
      const timer = setInterval(async () => {
        try {
          const result = await api.queryOrderStatus(this.data.orderId);

          if (result.code === 0 && result.isPaid) {
            // 支付成功
            clearInterval(timer);
            this.setData({
              success: true,
              statusText: '支付成功！',
              pollingTimer: null
            });

            setTimeout(() => {
              this.triggerEvent('success');
            }, 1500);
          } else {
            this.setData({
              statusText: '等待支付...'
            });
          }
        } catch (err) {
          console.error('查询订单状态失败:', err);
        }
      }, 2000); // 每2秒查询一次

      this.setData({
        pollingTimer: timer
      });
    }
  }
});
