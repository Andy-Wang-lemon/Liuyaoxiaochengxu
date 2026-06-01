// utils/api.js
const app = getApp();

// API基础URL
const BASE_URL = 'http://localhost:8787/api'; // 开发环境

/**
 * 封装wx.request
 */
function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': options.contentType || 'application/json',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * 咨询API - 已简化为本地处理
 */
function shakeHexagram(data) {
  console.log('分析功能已简化，直接返回基础信息');
  
  // 返回简化的排盘结果
  return Promise.resolve({
    success: true,
    message: '分析完成',
    output: `咨询信息：
起卦地点：${data.location}
起卦时间：${data.datetime}
测算人：${data.querentName}
所问事项：${data.question}

咨询记录：
${data.lines.map((line, index) => {
  const type = line.type === "yang" ? "阳" : "阴";
  const moving = line.isMoving ? "动" : "静";
  return `第${index + 1}爻：${type}爻（${moving}）`;
}).reverse().join('\n')}

※ 以上为基础分析信息，详细答疑请看下方智能分析`
  });
}

/**
 * 直接调用阿里云千问API进行答疑分析
 */
function callAIDirectly(prompt) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      header: {
        'Authorization': 'Bearer sk-096cc7facdbe4433a3a4681a787852f2',
        'Content-Type': 'application/json'
      },
      data: {
        model: 'qwen-turbo',
        input: { prompt: prompt },
        parameters: {
          temperature: 0.7,
          top_p: 0.8,
          max_tokens: 1200
        }
      },
      success: (res) => {
        console.log('AI API响应:', res);
        if (res.statusCode === 200 && res.data.output && res.data.output.text) {
          resolve(res.data.output.text.trim());
        } else {
          reject(new Error('AI响应格式错误: ' + JSON.stringify(res.data)));
        }
      },
      fail: (err) => {
        console.error('AI API调用失败:', err);
        reject(new Error('网络请求失败: ' + err.errMsg));
      }
    });
  });
}

/**
 * 构建答疑分析提示词
 */
function buildInterpretPrompt(data) {
  const linesInfo = data.lines
    .map((line, index) => {
      const type = line.type === "yang" ? "阳" : "阴";
      const moving = line.isMoving ? "动" : "静";
      return `第${index + 1}爻：${type}爻（${moving}）`;
    })
    .reverse()
    .join("\n");

  return `你是一位精通传统易学文化的老师。请根据以下信息，对"所咨询问题"进行专业分析和答疑。

硬性要求：
1) 答疑开头第一句话必须是"${data.querentName}你好"，只用名字，不要加先生/女士/居士等
2) 先给【综合分析 3-5 句】
3) 再【分点】解释关键信息、变化趋势
4) 最后给【1条参考建议】
5) 语言专业但易懂，重在文化解读和人生指导

【咨询信息】
咨询地点：${data.location}
咨询时间：${data.datetime}
咨询人姓名：${data.querentName}
咨询问题：${data.question}

【传统文化分析】（参考六爻传统文化）
${linesInfo}

请直接输出专业答疑内容：`;
}

/**
 * 答疑API - 直接调用智能答疑
 */
function interpretHexagram(data) {
  console.log('开始智能答疑，输入数据:', data);
  
  // 构建答疑分析提示词
  const prompt = buildInterpretPrompt(data);
  console.log('答疑分析提示词:', prompt);
  
  // 直接调用AI API
  return callAIDirectly(prompt).then(aiResponse => {
    console.log('智能答疑结果:', aiResponse);
    return {
      interpretation: aiResponse,
      output: '分析已完成，以下为智能答疑结果：\n\n' + aiResponse
    };
  });
}

/**
 * 创建支付订单
 */
function createPayment(amount, description, userName) {
  return request({
    url: '/create-payment',
    method: 'POST',
    data: {
      amount,
      description,
      userName
    }
  });
}

/**
 * 查询订单状态
 */
function queryOrderStatus(orderId) {
  return request({
    url: `/query-order?orderId=${orderId}`,
    method: 'GET'
  });
}

/**
 * 确认支付成功
 */
function confirmPayment(orderId) {
  return request({
    url: '/payment-success',
    method: 'POST',
    data: { orderId }
  });
}

module.exports = {
  shakeHexagram,
  interpretHexagram,
  createPayment,
  queryOrderStatus,
  confirmPayment
};
