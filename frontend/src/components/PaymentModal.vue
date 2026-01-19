<template>
  <div v-if="show" class="payment-modal show" @click.self="handleClose">
    <div class="payment-content">
      <button class="close-btn" @click="handleClose">&times;</button>
      <div class="payment-header">
        <h3>支付解卦费用</h3>
        <div class="payment-amount">¥{{ amount.toFixed(2) }}</div>
        <p style="color: #666; font-size: 14px; margin: 0;">支付{{ amount }}元，查看解卦结果</p>
      </div>
      <div class="payment-method">
        <div class="payment-method-icon">微</div>
        <div class="payment-method-text">微信支付</div>
      </div>
      
      <!-- 二维码显示区域 -->
      <div v-if="qrCode && !success" class="qrcode-container">
        <img :src="qrCode" alt="微信支付二维码" class="qrcode-image" />
        <p class="qrcode-tip">请使用微信扫码支付</p>
        <p class="qrcode-status">{{ statusText }}</p>
      </div>

      <div v-if="loading && !qrCode" class="payment-loading">
        正在生成支付二维码...
      </div>
      <div v-if="success" class="payment-success">
        ✓ 支付成功！
      </div>
      <div v-if="error" class="payment-error">
        {{ error }}
      </div>
      <div class="payment-buttons">
        <button class="payment-btn payment-btn-cancel" @click="handleClose">{{ success ? '关闭' : '取消' }}</button>
        <button
          v-if="!qrCode && !success"
          class="payment-btn payment-btn-primary"
          :disabled="loading"
          @click="handleConfirm"
        >
          {{ loading ? '处理中...' : '生成二维码' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { createPayment, queryOrderStatus } from '../api/hexagram';

interface Props {
  amount: number;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
});

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const loading = ref(false);
const success = ref(false);
const error = ref('');
const qrCode = ref('');
const orderId = ref('');
const statusText = ref('等待支付...');
const pollingTimer = ref<number | null>(null);

function handleClose() {
  // 清除轮询
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value);
    pollingTimer.value = null;
  }
  emit('close');
}

async function handleConfirm() {
  loading.value = true;
  error.value = '';
  
  try {
    // 创建支付订单
    const result = await createPayment(
      Math.round(props.amount * 100), // 转换为分
      '六爻解卦服务',
      '用户'
    );
    
    if (result.code === 0) {
      orderId.value = result.orderId;
      
      if (result.mockMode) {
        // 模拟模式：直接成功
        success.value = true;
        setTimeout(() => {
          emit('success');
        }, 1000);
      } else if (result.qrCode) {
        // 真实微信支付：显示二维码
        qrCode.value = result.qrCode;
        loading.value = false;
        
        // 开始轮询订单状态
        startPolling();
      } else {
        error.value = '获取支付二维码失败';
        loading.value = false;
      }
    } else {
      error.value = result.message || '创建订单失败';
      loading.value = false;
    }
  } catch (err: any) {
    console.error('支付请求失败:', err);
    error.value = err.response?.data?.message || err.message || '支付请求失败';
    loading.value = false;
  }
}

// 轮询查询订单状态
function startPolling() {
  pollingTimer.value = window.setInterval(async () => {
    try {
      const result = await queryOrderStatus(orderId.value);
      
      if (result.code === 0 && result.isPaid) {
        // 支付成功
        if (pollingTimer.value) {
          clearInterval(pollingTimer.value);
          pollingTimer.value = null;
        }
        success.value = true;
        statusText.value = '支付成功！';
        setTimeout(() => {
          emit('success');
        }, 1500);
      } else {
        statusText.value = '等待支付...';
      }
    } catch (err) {
      console.error('查询订单状态失败:', err);
    }
  }, 2000); // 每2秒查询一次
}

// 组件卸载时清除轮询
onUnmounted(() => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value);
    pollingTimer.value = null;
  }
});
</script>

<style scoped>
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

.payment-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.payment-btn-primary {
  background: #07c160;
  color: white;
}

.payment-btn-primary:hover:not(:disabled) {
  background: #06ad56;
}

.payment-btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.payment-btn-cancel:hover {
  background: #e0e0e0;
}

.payment-loading,
.payment-success {
  text-align: center;
  padding: 20px;
  color: #666;
}

.payment-success {
  color: #4CAF50;
}

.payment-error {
  text-align: center;
  padding: 15px;
  color: #d32f2f;
  background: #ffebee;
  border-radius: 6px;
  margin: 15px 0;
  font-size: 14px;
}

.qrcode-container {
  text-align: center;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
  margin: 20px 0;
}

.qrcode-image {
  width: 200px;
  height: 200px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px;
  background: white;
  display: block;
  margin: 0 auto;
}

.qrcode-tip {
  margin-top: 15px;
  color: #666;
  font-size: 14px;
  font-weight: 600;
}

.qrcode-status {
  margin-top: 10px;
  color: #07c160;
  font-size: 14px;
  font-weight: bold;
}

@media (max-width: 768px) {
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

  .qrcode-image {
    width: 180px;
    height: 180px;
  }
}
</style>


