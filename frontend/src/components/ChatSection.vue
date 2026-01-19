<template>
  <div class="chat-section">
    <h3>继续提问 (首个问题免费，后续问题1元/次)</h3>
    <div class="chat-messages" ref="messagesContainer">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['chat-message', msg.type]"
      >
        <div class="message-label">{{ msg.label }}</div>
        <div class="message-content">{{ msg.content }}</div>
      </div>
    </div>
    <div class="chat-input-container">
      <textarea
        v-model="question"
        class="chat-input"
        placeholder="请输入您的问题 (30字以内)"
        maxlength="30"
        @input="updateCharCount"
      ></textarea>
      <button
        class="chat-submit-btn"
        :disabled="!canSubmit || submitting"
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : '发送' }}
      </button>
    </div>
    <div :class="['char-count', { warning: charCount >= 30 }]">
      {{ charCount }}/30
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, defineExpose } from 'vue';
import { interpretHexagram } from '../api/hexagram';
import type { LineResult } from '../types';

interface Props {
  formData: {
    location: string;
    timezone: string;
    datetime: string;
    querentName: string;
    question: string;
  };
  lines: LineResult[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  questionSubmitted: [question: string];
}>();

const question = ref('');
const charCount = ref(0);
const submitting = ref(false);
const messages = ref<Array<{ label: string; content: string; type: 'user' | 'assistant' }>>([]);
const questionCount = ref(0);
const messagesContainer = ref<HTMLElement | null>(null);
const pendingQuestionAfterPayment = ref<string | null>(null);

const canSubmit = computed(() => {
  return question.value.trim().length > 0 && question.value.trim().length <= 30 && !submitting.value;
});

function updateCharCount() {
  charCount.value = question.value.length;
}

async function handleSubmit() {
  if (!canSubmit.value) return;
  
  const questionText = question.value.trim();
  questionCount.value++;
  
  // 显示用户问题
  messages.value.push({
    label: '您',
    content: questionText,
    type: 'user',
  });
  
  // 清空输入框
  question.value = '';
  charCount.value = 0;
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
  
  // 检查是否需要支付（第二个问题开始需要支付）
  if (questionCount.value > 1) {
    pendingQuestionAfterPayment.value = questionText;
    emit('questionSubmitted', questionText);
    return;
  }
  
  // 第一个问题免费，直接提交
  await submitQuestionToAPI(questionText);
}

async function submitQuestionToAPI(questionText: string) {
  submitting.value = true;
  
  try {
    const result = await interpretHexagram({
      ...props.formData,
      lines: props.lines,
      question: questionText,
      isFollowUp: true,
    });
    
    messages.value.push({
      label: '解卦',
      content: result.interpretation,
      type: 'assistant',
    });
  } catch (err: any) {
    messages.value.push({
      label: '系统',
      content: '解卦时发生错误：' + (err.message || err),
      type: 'assistant',
    });
  } finally {
    submitting.value = false;
    await nextTick();
    scrollToBottom();
  }
}

// 支付成功后调用此方法提交问题
async function submitPendingQuestion() {
  if (pendingQuestionAfterPayment.value) {
    const questionText = pendingQuestionAfterPayment.value;
    pendingQuestionAfterPayment.value = null;
    await submitQuestionToAPI(questionText);
  }
}

// 暴露方法供父组件调用
defineExpose({
  submitPendingQuestion,
});

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

watch(messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
});
</script>

<style scoped>
.chat-section {
  margin-top: 30px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.chat-section h3 {
  color: #1a1f3a;
  font-size: 18px;
  margin-bottom: 15px;
}

.chat-messages {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 15px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
  min-height: 100px;
}

.chat-message {
  margin-bottom: 15px;
  padding: 10px 15px;
  border-radius: 6px;
  background: white;
  border-left: 3px solid #4CAF50;
}

.chat-message.user {
  background: #e3f2fd;
  border-left-color: #2196F3;
}

.chat-message .message-label {
  font-weight: bold;
  color: #666;
  font-size: 12px;
  margin-bottom: 5px;
}

.chat-message .message-content {
  color: #1a1f3a;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.chat-input-container {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.chat-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
  max-height: 120px;
}

.chat-input:focus {
  outline: none;
  border-color: #d4af37;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
}

.chat-submit-btn {
  padding: 12px 24px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.3s;
  white-space: nowrap;
}

.chat-submit-btn:hover:not(:disabled) {
  background: #45a049;
}

.chat-submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.char-count {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
  text-align: right;
}

.char-count.warning {
  color: #d32f2f;
}
</style>

