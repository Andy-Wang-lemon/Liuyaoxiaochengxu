<template>
  <div class="shake-page">
    <Header />
    <main>
      <div class="container">
        <h1>六爻摇卦</h1>

        <div v-if="error" class="error">错误：{{ error }}</div>

        <form id="mainForm" @submit.prevent="handleSubmit">
          <div class="form-section">
            <label for="location">
              起卦地点 <span style="color: #d32f2f;">*</span>
            </label>
            <input
              id="location"
              v-model="formData.location"
              name="location"
              required
              placeholder="请输入起卦地点"
            />

            <label for="timezone">
              时区（IANA，如 Asia/Shanghai） <span style="color: #d32f2f;">*</span>
            </label>
            <input
              id="timezone"
              v-model="formData.timezone"
              name="timezone"
              required
            />

            <label for="datetime">
              精确时间 <span style="color: #d32f2f;">*</span>
            </label>
            <input
              id="datetime"
              :value="formattedDateTime"
              readonly
              name="datetime"
              required
              style="background-color: #f5f5f5; cursor: default;"
            />

            <label for="querentName">
              测算人姓名 <span style="color: #d32f2f;">*</span>
            </label>
            <input
              id="querentName"
              v-model="formData.querentName"
              name="querentName"
              required
              placeholder="请输入姓名"
            />

            <label for="question">
              所问何事 <span style="color: #d32f2f;">*</span>
            </label>
            <input
              id="question"
              v-model="formData.question"
              name="question"
              required
              placeholder="请输入所问事项"
            />
          </div>

          <div class="form-section shake-section">
            <h2 id="shakeTitle">
              摇卦（第 {{ Math.min(currentLineIndex + 1, 6) }} / 6 爻）
            </h2>
            <p class="info">点击"摇卦"按钮，三片树叶会随机翻转，根据结果确定当前爻</p>
            <p style="color: #d32f2f; font-size: 14px; margin: 8px 0; font-weight: 600;">
              在点击"摇卦"时心中默念询问的事，不做他想
            </p>

            <div class="coins-container">
              <div
                v-for="(coin, index) in coins"
                :key="index"
                :class="['coin', coin.class]"
              >
                <img
                  :src="coin.src"
                  alt="叶子"
                  @error="handleImageError($event, index)"
                />
              </div>
            </div>

            <button
              type="button"
              class="shake-btn"
              :disabled="isComplete || isShaking"
              @click="performShake"
            >
              {{ isComplete ? '已完成六爻' : isShaking ? '摇卦中...' : '摇卦' }}
            </button>

            <div v-if="currentResult" class="current-result">
              {{ currentResult }}
            </div>
          </div>

          <div v-if="lines.length > 0" class="lines-display">
            <h3>已摇出的爻：</h3>
            <div
              v-for="line in orderedLines"
              :key="line.index"
              :class="['line-item', { moving: line.isMoving }]"
            >
              <strong>第{{ line.index }}爻：</strong>
              {{ getLineDescription(line) }}
            </div>
          </div>
        </form>

        <div class="result-section">
          <h2>排盘结果</h2>
          <pre id="resultText">{{ resultText || '摇完六爻后，这里会显示排盘结果' }}</pre>

          <button
            v-if="showInterpretBtn"
            type="button"
            class="interpret-btn"
            @click="showPaymentModal"
          >
            解卦
          </button>

          <!-- 排盘结果分享按钮 -->
          <ShareButtons
            v-if="resultText"
            :result-text="resultText"
            :interpretation-text="interpretationText"
            :question="formData.question"
          />

          <h2 style="margin-top: 24px;">解卦结果</h2>
          <pre id="interpretText">{{ interpretationText || '点击"解卦"后，这里显示解卦内容' }}</pre>

          <!-- 解卦结果分享按钮 -->
          <ShareButtons
            v-if="interpretationText && !resultText"
            :result-text="resultText"
            :interpretation-text="interpretationText"
            :question="formData.question"
          />

          <ChatSection
            v-if="showChat"
            ref="chatSectionRef"
            :form-data="formData"
            :lines="lines"
            @question-submitted="handleQuestionSubmitted"
          />
        </div>
      </div>
    </main>

    <Footer />

    <PaymentModal
      v-if="showPayment"
      :amount="3.00"
      @close="closePaymentModal"
      @success="handlePaymentSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Header from '../components/Header.vue';
import Footer from '../components/Footer.vue';
import PaymentModal from '../components/PaymentModal.vue';
import ChatSection from '../components/ChatSection.vue';
import ShareButtons from '../components/ShareButtons.vue';
import { shakeHexagram, interpretHexagram } from '../api/hexagram';
import type { LineResult } from '../types';

const chatSectionRef = ref<InstanceType<typeof ChatSection> | null>(null);

interface FormData {
  location: string;
  timezone: string;
  datetime: string;
  querentName: string;
  question: string;
}

const formData = ref<FormData>({
  location: '',
  timezone: 'Asia/Shanghai',
  datetime: new Date().toISOString().slice(0, 16),
  querentName: '',
  question: '',
});

const lines = ref<LineResult[]>([]);
const error = ref('');
const isShaking = ref(false);
const currentResult = ref('');
const resultText = ref('');
const interpretationText = ref('');
const showInterpretBtn = ref(false);
const showChat = ref(false);
const showPayment = ref(false);
const pendingAction = ref<'interpret' | 'question' | null>(null);
const pendingQuestion = ref('');

// 支付相关状态
const hasPaid = ref(false);

const coins = ref([
  { class: '', src: '/images/leaf-yang.png' },
  { class: '', src: '/images/leaf-yang.png' },
  { class: '', src: '/images/leaf-yang.png' },
]);

const currentLineIndex = computed(() => lines.value.length);
const isComplete = computed(() => lines.value.length >= 6);

const orderedLines = computed(() => {
  return [...lines.value].sort((a, b) => b.index - a.index);
});

// 格式化时间为中文格式：2025年12月27日，晚上23：12
function formatDateTimeToChinese(isoString: string): string {
  try {
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!match) return isoString;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);

    let timePeriod = '';
    if (hours >= 0 && hours < 6) timePeriod = '凌晨';
    else if (hours >= 6 && hours < 12) timePeriod = '上午';
    else if (hours >= 12 && hours < 18) timePeriod = '下午';
    else timePeriod = '晚上';

    const formattedMinutes = minutes.toString().padStart(2, '0');
    return `${year}年${month}月${day}日，${timePeriod}${hours}：${formattedMinutes}`;
  } catch (e) {
    return isoString;
  }
}

const formattedDateTime = computed(() => {
  return formatDateTimeToChinese(formData.value.datetime);
});

function getLineDescription(line: LineResult): string {
  const typeName = line.type === 'yang' ? '阳' : '阴';
  const movingDesc = line.isMoving
    ? `（老${typeName}，动）`
    : `（少${typeName}，静）`;
  return `${typeName}爻${movingDesc}`;
}

function getRandomResult(): 'yin' | 'yang' {
  return Math.random() < 0.5 ? 'yin' : 'yang';
}

function determineLine(coin1: 'yin' | 'yang', coin2: 'yin' | 'yang', coin3: 'yin' | 'yang') {
  const yangCount = [coin1, coin2, coin3].filter(r => r === 'yang').length;
  const yinCount = 3 - yangCount;

  if (yangCount === 3) {
    return { type: 'yang' as const, isMoving: true, name: '老阳（动）' };
  } else if (yinCount === 3) {
    return { type: 'yin' as const, isMoving: true, name: '老阴（动）' };
  } else if (yangCount === 2) {
    return { type: 'yin' as const, isMoving: false, name: '少阴（静）' };
  } else {
    return { type: 'yang' as const, isMoving: false, name: '少阳（静）' };
  }
}

async function performShake() {
  if (isComplete.value || isShaking.value) return;

  isShaking.value = true;
  currentResult.value = '';

  coins.value.forEach(coin => {
    coin.class = 'spinning';
  });

  await new Promise(resolve => setTimeout(resolve, 1500));

  const results: ('yin' | 'yang')[] = coins.value.map(() => getRandomResult());

  results.forEach((result, idx) => {
    setTimeout(() => {
      coins.value[idx].class = result;
    }, idx * 200);
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  const lineResult = determineLine(results[0], results[1], results[2]);
  const lineIndex = lines.value.length + 1;

  lines.value.push({
    index: lineIndex,
    type: lineResult.type,
    isMoving: lineResult.isMoving,
  });

  currentResult.value = `第${lineIndex}爻：${lineResult.name}`;
  isShaking.value = false;

  // ✅ 摇满6爻后：生成排盘结果，但不自动解卦（需要支付）
  if (lines.value.length >= 6) {
    console.log('已完成六爻，开始生成排盘结果...', {
      linesCount: lines.value.length,
      formData: formData.value
    });

    // 生成排盘结果
    await generateResult();
    
    // 不再自动解卦，需要用户点击"解卦"按钮并支付
  }
}


async function generateResult() {
  console.log('generateResult 被调用', {
    formData: formData.value,
    linesCount: lines.value.length
  });

  const validationError = validateForm();
  if (validationError) {
    error.value = validationError;
    console.warn('表单验证失败：', validationError);
    alert(validationError);
    return;
  }

  error.value = '';
  try {
    console.log('开始调用 shakeHexagram API...');
    const result = await shakeHexagram({
      ...formData.value,
      lines: lines.value,
    });
    console.log('排盘结果生成成功', result);
    resultText.value = result.output;
    showInterpretBtn.value = true;
  } catch (err: any) {
    const errorMessage = err.response?.data?.error || err.message || '生成排盘结果失败';
    error.value = errorMessage;
    console.error('生成排盘结果错误：', err);
    alert('生成排盘结果失败：' + errorMessage);
  }
}

function validateForm(): string | null {
  if (!formData.value.location.trim()) return '请填写起卦地点（必填项）';
  if (!formData.value.timezone.trim()) return '请填写时区（必填项）';
  if (!formData.value.datetime.trim()) return '请填写精确时间（必填项）';
  if (!formData.value.querentName.trim()) return '请填写测算人姓名（必填项）';
  if (!formData.value.question.trim()) return '请填写所问何事（必填项）';
  return null;
}

function showPaymentModal() {
  const validationError = validateForm();
  if (validationError) {
    alert(validationError);
    return;
  }
  pendingAction.value = 'interpret';
  showPayment.value = true;
}

function closePaymentModal() {
  showPayment.value = false;
  pendingAction.value = null;
}

async function handlePaymentSuccess() {
  showPayment.value = false;
  hasPaid.value = true;

  if (pendingAction.value === 'interpret') {
    await executeInterpretation();
  } else if (pendingAction.value === 'question') {
    if (chatSectionRef.value && typeof (chatSectionRef.value as any).submitPendingQuestion === 'function') {
      await (chatSectionRef.value as any).submitPendingQuestion();
    }
  }

  pendingAction.value = null;
  pendingQuestion.value = '';
}

async function executeInterpretation() {
  const validationError = validateForm();
  if (validationError) {
    alert(validationError);
    return;
  }

  try {
    const result = await interpretHexagram({
      ...formData.value,
      lines: lines.value,
    });
    interpretationText.value = result.interpretation;
    showChat.value = true;
  } catch (err: any) {
    const errorMessage = err.response?.data?.error || err.message || '解卦时发生错误';
    interpretationText.value = '解卦时发生错误：' + errorMessage;
    console.error('解卦错误：', err);
  }
}

function handleQuestionSubmitted(question: string) {
  pendingQuestion.value = question;
  pendingAction.value = 'question';
  showPayment.value = true;
}

async function submitQuestion(question: string) {
  return Promise.resolve();
}

function handleSubmit(e: Event) {
  e.preventDefault();
}

function handleImageError(event: Event, index: number) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}

onMounted(() => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const beijingTime = new Date(utcTime + (8 * 60 * 60 * 1000));

  const year = beijingTime.getUTCFullYear();
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getUTCDate()).padStart(2, '0');
  const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
  const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');

  formData.value.datetime = `${year}-${month}-${day}T${hours}:${minutes}`;
});
</script>

<style scoped>
@import '../styles/common.css';

.shake-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
  position: relative;
  z-index: 1;
  padding: 40px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.container {
  background: rgba(255, 255, 255, 0.9);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  max-width: 900px;
  width: 100%;
  backdrop-filter: blur(6px);
}

h1 {
  margin-top: 0;
  color: #1a1f3a;
  font-size: 32px;
  margin-bottom: 30px;
  text-align: center;
}

.form-section {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

label {
  display: block;
  margin: 10px 0 6px;
  font-weight: 600;
  color: #1a1f3a;
  font-size: 14px;
}

input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  background: white;
  color: #1a1f3a;
}

input:focus {
  outline: none;
  border-color: #d4af37;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
}

.shake-section {
  margin: 40px 0;
  text-align: center;
  background: transparent;
  padding: 30px;
  border-radius: 8px;
}

.shake-section h2 {
  color: #1a1f3a;
  font-size: 24px;
  margin-bottom: 15px;
}

.coins-container {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
  margin: 30px 0;
  flex-wrap: wrap;
}

.coin {
  width: 140px;
  height: 180px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

.coin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 0.3s;
}

.coin.spinning img {
  animation: spin 0.8s linear infinite;
}

.coin.yin img {
  filter: grayscale(1) brightness(1.5) contrast(0.8);
}

@keyframes spin {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
}

.shake-btn {
  padding: 15px 40px;
  font-size: 18px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  margin: 20px 0;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.shake-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

.shake-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

.current-result {
  margin: 20px 0;
  font-size: 16px;
  font-weight: bold;
  color: #4CAF50;
}

.lines-display {
  margin: 30px 0;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 6px;
}

.line-item {
  padding: 10px;
  margin: 8px 0;
  background: white;
  border-left: 4px solid #4CAF50;
  border-radius: 4px;
}

.line-item.moving {
  color: #c62828;
  border-left-color: #c62828;
}

.result-section {
  margin-top: 40px;
  padding: 30px;
  border-top: 2px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  color: #1a1f3a;
}

.result-section h2 {
  color: #1a1f3a;
  font-size: 24px;
  margin-bottom: 16px;
}

.result-section pre {
  background: #f7f7f7;
  padding: 20px;
  white-space: pre-wrap;
  border-radius: 8px;
  font-family: "Courier New", monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #1a1f3a;
  border: 1px solid rgba(0, 0, 0, 0.08);
  min-height: 80px;
}

.interpret-btn {
  margin-top: 16px;
  padding: 12px 24px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.interpret-btn:hover {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

.error {
  color: #d32f2f;
  margin: 12px 0;
  padding: 12px;
  background: #ffebee;
  border-radius: 4px;
}

.info {
  color: #666;
  font-size: 14px;
  margin: 10px 0;
}

@media (max-width: 768px) {
  main {
    padding: 20px 15px;
  }

  .container {
    padding: 20px 15px;
  }

  h1 {
    font-size: 24px;
  }

  .coins-container {
    gap: 15px;
  }

  .coin {
    width: 100px;
    height: 130px;
  }
}
</style>
