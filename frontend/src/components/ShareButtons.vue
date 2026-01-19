<template>
  <div class="share-buttons">
    <h3 style="margin-bottom: 12px; color: #1a1f3a; font-size: 16px;">分享结果</h3>
    <div class="share-buttons-container">
      <button
        class="share-btn share-wechat-friend"
        @click="shareToWeChatFriend"
        title="分享到微信朋友"
      >
        <span class="share-icon">💬</span>
        <span class="share-text">微信朋友</span>
      </button>
      <button
        class="share-btn share-wechat-moments"
        @click="shareToWeChatMoments"
        title="分享到微信朋友圈"
      >
        <span class="share-icon">📱</span>
        <span class="share-text">朋友圈</span>
      </button>
      <button
        class="share-btn share-xiaohongshu"
        @click="shareToXiaohongshu"
        title="分享到小红书"
      >
        <span class="share-icon">📖</span>
        <span class="share-text">小红书</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  resultText?: string;
  interpretationText?: string;
  question?: string;
}>();

// 获取当前页面URL
const currentUrl = computed(() => {
  return window.location.href;
});

// 生成分享内容
const shareContent = computed(() => {
  const parts: string[] = [];
  if (props.question) {
    parts.push(`所问：${props.question}`);
  }
  if (props.resultText) {
    parts.push(`\n排盘结果：\n${props.resultText.substring(0, 200)}...`);
  }
  if (props.interpretationText) {
    parts.push(`\n解卦结果：\n${props.interpretationText.substring(0, 200)}...`);
  }
  parts.push(`\n\n查看完整结果：${currentUrl.value}`);
  return parts.join('\n');
});

// 分享到微信朋友
function shareToWeChatFriend() {
  // 检查是否在微信环境中
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  
  if (isWeChat) {
    // 在微信中，使用微信JS-SDK分享
    if (window.wx && window.wx.updateAppMessageShareData) {
      window.wx.updateAppMessageShareData({
        title: '六爻摇卦结果',
        desc: props.question || '我的六爻摇卦结果',
        link: currentUrl.value,
        imgUrl: window.location.origin + '/images/leaf-yang.png',
        success: () => {
          // 分享成功，提示用户点击右上角菜单分享
          alert('请点击微信右上角菜单，选择"发送给朋友"进行分享');
        },
        cancel: () => {
          // 用户取消分享
        }
      });
    } else {
      // 如果微信JS-SDK未加载，提示用户使用微信右上角菜单分享
      alert('请点击微信右上角菜单，选择"发送给朋友"进行分享');
    }
  } else {
    // 非微信环境，复制链接到剪贴板
    copyToClipboard(currentUrl.value);
    alert('链接已复制到剪贴板，请打开微信粘贴发送给朋友');
  }
}

// 分享到微信朋友圈
function shareToWeChatMoments() {
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  
  if (isWeChat) {
    if (window.wx && window.wx.updateTimelineShareData) {
      window.wx.updateTimelineShareData({
        title: `六爻摇卦：${props.question || '我的摇卦结果'}`,
        link: currentUrl.value,
        imgUrl: window.location.origin + '/images/leaf-yang.png',
        success: () => {
          // 分享成功，提示用户点击右上角菜单分享
          alert('请点击微信右上角菜单，选择"分享到朋友圈"');
        }
      });
    } else {
      alert('请点击微信右上角菜单，选择"分享到朋友圈"');
    }
  } else {
    copyToClipboard(currentUrl.value);
    alert('链接已复制到剪贴板，请打开微信朋友圈粘贴分享');
  }
}

// 分享到小红书
function shareToXiaohongshu() {
  // 小红书没有公开的分享API，所以复制链接和内容
  const shareText = `六爻摇卦结果\n${props.question ? `所问：${props.question}\n` : ''}${currentUrl.value}`;
  
  copyToClipboard(shareText);
  alert('内容已复制到剪贴板，请打开小红书APP粘贴分享');
}

// 复制到剪贴板
function copyToClipboard(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('复制失败:', err);
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

// 备用复制方法
function fallbackCopyToClipboard(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('复制失败:', err);
    alert('复制失败，请手动复制：' + text);
  }
  
  document.body.removeChild(textArea);
}

// 扩展Window接口以支持微信JS-SDK
declare global {
  interface Window {
    wx?: {
      updateTimelineShareData: (config: {
        title: string;
        link: string;
        imgUrl?: string;
        desc?: string;
        success?: () => void;
        cancel?: () => void;
      }) => void;
      updateAppMessageShareData: (config: {
        title: string;
        desc: string;
        link: string;
        imgUrl?: string;
        success?: () => void;
        cancel?: () => void;
      }) => void;
    };
  }
}
</script>

<style scoped>
.share-buttons {
  margin-top: 20px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.share-buttons-container {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.share-btn {
  flex: 1;
  min-width: 100px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.share-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.share-btn:active {
  transform: translateY(0);
}

.share-wechat-friend {
  background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
  color: white;
}

.share-wechat-friend:hover {
  background: linear-gradient(135deg, #06ad56 0%, #059945 100%);
}

.share-wechat-moments {
  background: linear-gradient(135deg, #1aad19 0%, #179b16 100%);
  color: white;
}

.share-wechat-moments:hover {
  background: linear-gradient(135deg, #179b16 0%, #158915 100%);
}

.share-xiaohongshu {
  background: linear-gradient(135deg, #ff2442 0%, #e01e3c 100%);
  color: white;
}

.share-xiaohongshu:hover {
  background: linear-gradient(135deg, #e01e3c 0%, #c01a35 100%);
}

.share-icon {
  font-size: 24px;
  line-height: 1;
}

.share-text {
  font-size: 13px;
  line-height: 1;
}

@media (max-width: 768px) {
  .share-buttons-container {
    flex-direction: column;
  }
  
  .share-btn {
    width: 100%;
    flex-direction: row;
    justify-content: center;
    min-width: auto;
  }
  
  .share-icon {
    font-size: 20px;
  }
  
  .share-text {
    font-size: 14px;
  }
}
</style>

