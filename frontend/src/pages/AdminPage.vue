<template>
  <div class="admin-page">
    <div class="header">
      <h1>六爻管理后台</h1>
      <p>数据统计与管理</p>
    </div>
    
    <div class="stats" v-if="statistics">
      <div class="stat-card">
        <h3>总使用次数</h3>
        <div class="value">{{ statistics.totalUsage }}</div>
      </div>
      <div class="stat-card">
        <h3>账户总额</h3>
        <div class="value">¥{{ statistics.totalAmount.toFixed(2) }}</div>
      </div>
      <div class="stat-card">
        <h3>成功支付次数</h3>
        <div class="value">{{ statistics.successfulPayments }}</div>
      </div>
    </div>
    
    <div class="section">
      <h2>使用量趋势</h2>
      <div class="chart-container">
        <canvas ref="usageChart"></canvas>
      </div>
    </div>
    
    <div class="section">
      <h2>支付金额趋势</h2>
      <div class="chart-container">
        <canvas ref="paymentChart"></canvas>
      </div>
    </div>
    
    <div class="section">
      <div class="actions">
        <button class="btn btn-secondary" @click="refreshData">刷新数据</button>
        <button class="btn" @click="exportExcel">导出Excel</button>
      </div>
      <h2>使用记录</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>问题</th>
              <th>地点</th>
              <th>类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in usageRecords" :key="record.timestamp">
              <td>{{ formatDate(record.timestamp) }}</td>
              <td>{{ record.userName }}</td>
              <td>{{ record.question }}</td>
              <td>{{ record.location }}</td>
              <td>{{ record.type === 'initial' ? '首次解卦' : '后续问题' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="section">
      <h2>支付记录</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>金额</th>
              <th>描述</th>
              <th>订单号</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in paymentRecords" :key="record.orderId">
              <td>{{ formatDate(record.timestamp) }}</td>
              <td>{{ record.userName }}</td>
              <td>¥{{ (record.amount / 100).toFixed(2) }}</td>
              <td>{{ record.description }}</td>
              <td>{{ record.orderId }}</td>
              <td :class="getStatusClass(record.status)">
                {{ getStatusText(record.status) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import Chart from 'chart.js/auto';

const route = useRoute();
const token = route.query.token as string || '';

const statistics = ref<any>(null);
const usageRecords = ref<any[]>([]);
const paymentRecords = ref<any[]>([]);
const usageChart = ref<HTMLCanvasElement | null>(null);
const paymentChart = ref<HTMLCanvasElement | null>(null);

let usageChartInstance: Chart | null = null;
let paymentChartInstance: Chart | null = null;

async function loadData() {
  try {
    const response = await axios.get('/api/admin/data', {
      params: { token },
    });
    const data = response.data;
    
    statistics.value = data.statistics;
    usageRecords.value = data.usageRecords;
    paymentRecords.value = data.paymentRecords;
    
    await nextTick();
    updateCharts();
  } catch (error) {
    console.error('加载数据失败:', error);
    alert('加载数据失败，请刷新页面重试');
  }
}

function updateCharts() {
  if (!statistics.value) return;
  
  // 使用量趋势图
  if (usageChart.value) {
    const usageLabels = Object.keys(statistics.value.usageByDate || {}).sort();
    const usageData = usageLabels.map(date => statistics.value.usageByDate[date]);
    
    if (usageChartInstance) {
      usageChartInstance.destroy();
    }
    
    usageChartInstance = new Chart(usageChart.value, {
      type: 'bar',
      data: {
        labels: usageLabels,
        datasets: [{
          label: '使用次数',
          data: usageData,
          backgroundColor: 'rgba(33, 150, 243, 0.5)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }
  
  // 支付金额趋势图
  if (paymentChart.value) {
    const paymentLabels = Object.keys(statistics.value.paymentAmountByDate || {}).sort();
    const paymentData = paymentLabels.map(date => statistics.value.paymentAmountByDate[date]);
    
    if (paymentChartInstance) {
      paymentChartInstance.destroy();
    }
    
    paymentChartInstance = new Chart(paymentChart.value, {
      type: 'line',
      data: {
        labels: paymentLabels,
        datasets: [{
          label: '支付金额（元）',
          data: paymentData,
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 2,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function getStatusClass(status: string): string {
  if (status === 'success') return 'status-success';
  if (status === 'pending') return 'status-pending';
  return 'status-failed';
}

function getStatusText(status: string): string {
  if (status === 'success') return '成功';
  if (status === 'pending') return '待支付';
  return '失败';
}

function refreshData() {
  loadData();
}

function exportExcel() {
  window.location.href = `/api/admin/export?token=${encodeURIComponent(token)}`;
}

onMounted(() => {
  loadData();
  // 每30秒自动刷新
  setInterval(loadData, 30000);
});
</script>

<style scoped>
.admin-page {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #f5f5f5;
  color: #333;
  padding: 20px;
  min-height: 100vh;
}

.header {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
  font-size: 24px;
  margin-bottom: 10px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.stat-card .value {
  font-size: 32px;
  font-weight: bold;
  color: #2196F3;
}

.section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section h2 {
  font-size: 20px;
  margin-bottom: 15px;
}

.chart-container {
  position: relative;
  height: 300px;
  margin-bottom: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background: #f9f9f9;
  font-weight: 600;
  color: #666;
}

tr:hover {
  background: #f5f5f5;
}

.btn {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 10px;
}

.btn:hover {
  background: #45a049;
}

.btn-secondary {
  background: #2196F3;
}

.btn-secondary:hover {
  background: #0b7dda;
}

.actions {
  margin-bottom: 20px;
}

.status-success {
  color: #4CAF50;
  font-weight: 600;
}

.status-pending {
  color: #ff9800;
  font-weight: 600;
}

.status-failed {
  color: #f44336;
  font-weight: 600;
}
</style>


