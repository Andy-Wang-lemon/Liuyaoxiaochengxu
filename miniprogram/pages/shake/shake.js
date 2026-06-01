// pages/shake/shake.js
const api = require('../../utils/api.js');

Page({
  data: {
    formData: {
      location: '',
      timezone: '',
      datetime: '',
      querentName: '',
      question: ''
    },
    cityOptions: [
      { name: '北京', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '上海', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '广州', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '深圳', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '成都', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '重庆', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '杭州', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '南京', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '西安', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '武汉', timezone: 'Asia/Shanghai', timezoneDisplay: 'GMT+8' },
      { name: '香港', timezone: 'Asia/Hong_Kong', timezoneDisplay: 'GMT+8' },
      { name: '台北', timezone: 'Asia/Taipei', timezoneDisplay: 'GMT+8' },
      { name: '东京', timezone: 'Asia/Tokyo', timezoneDisplay: 'GMT+9' },
      { name: '首尔', timezone: 'Asia/Seoul', timezoneDisplay: 'GMT+9' },
      { name: '新加坡', timezone: 'Asia/Singapore', timezoneDisplay: 'GMT+8' },
      { name: '曼谷', timezone: 'Asia/Bangkok', timezoneDisplay: 'GMT+7' },
      { name: '伦敦', timezone: 'Europe/London', timezoneDisplay: 'GMT+0' },
      { name: '巴黎', timezone: 'Europe/Paris', timezoneDisplay: 'GMT+1' },
      { name: '纽约', timezone: 'America/New_York', timezoneDisplay: 'GMT-5' },
      { name: '洛杉矶', timezone: 'America/Los_Angeles', timezoneDisplay: 'GMT-8' },
      { name: '旧金山', timezone: 'America/Los_Angeles', timezoneDisplay: 'GMT-8' },
      { name: '芝加哥', timezone: 'America/Chicago', timezoneDisplay: 'GMT-6' },
      { name: '多伦多', timezone: 'America/Toronto', timezoneDisplay: 'GMT-5' },
      { name: '温哥华', timezone: 'America/Vancouver', timezoneDisplay: 'GMT-8' },
      { name: '悉尼', timezone: 'Australia/Sydney', timezoneDisplay: 'GMT+10' },
      { name: '墨尔本', timezone: 'Australia/Melbourne', timezoneDisplay: 'GMT+10' }
    ],
    filteredCities: [],
    showCityDropdown: false,
    dateValue: '',
    timeValue: '',
    dateDisplay: '',
    timeDisplay: '',
    lines: [],
    orderedLines: [],
    coins: [
      { class: 'yang' },
      { class: 'yang' },
      { class: 'yang' }
    ],
    currentLineIndex: 1,
    isShaking: false,
    isComplete: false,
    currentResult: '',
    resultText: '',
    interpretationText: '',
    showInterpretBtn: false,
    errorMsg: '',
    // 删除支付相关字段
    // 激励广告相关
    rewardedVideoAd: null,
    adLoaded: false,
    adWatched: false
  },

  onLoad() {
    this.initDateTime();
    this.autoDetectCity();
    this.initRewardedVideoAd();
  },

  // 初始化时间
  initDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const dateValue = `${year}-${month}-${day}`;
    const timeValue = `${hours}:${minutes}`;
    const datetime = `${dateValue}T${timeValue}`;
    
    this.setData({
      'formData.datetime': datetime,
      dateValue: dateValue,
      timeValue: timeValue,
      dateDisplay: this.formatDate(dateValue),
      timeDisplay: this.formatTime(timeValue)
    });
  },

  // 自动检测当前城市（基于时区）
  autoDetectCity() {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset();
    const offsetHours = -timezoneOffset / 60;
    
    // 根据时区偏移自动选择城市
    let cityIndex = 0; // 默认北京
    if (offsetHours === 8) {
      cityIndex = 0; // 北京
    } else if (offsetHours === 9) {
      cityIndex = 12; // 东京
    } else if (offsetHours === 0) {
      cityIndex = 16; // 伦敦
    } else if (offsetHours === -5) {
      cityIndex = 18; // 纽约
    } else if (offsetHours === -8) {
      cityIndex = 19; // 洛杉矶
    }
    
    const selectedCity = this.data.cityOptions[cityIndex];
    this.setData({
      'formData.location': selectedCity.name,
      'formData.timezone': selectedCity.timezone
    });
  },

  // 初始化激励广告
  initRewardedVideoAd() {
    // 检查是否支持激励广告
    if (!wx.createRewardedVideoAd) {
      console.warn('当前微信版本不支持激励广告');
      return;
    }

    // 创建激励广告实例
    this.data.rewardedVideoAd = wx.createRewardedVideoAd({
      adUnitId: 'adunit-6b4d2959bff17e7a' // 你的广告位ID
    });

    // 监听广告加载事件
    this.data.rewardedVideoAd.onLoad(() => {
      console.log('激励广告加载成功');
      this.setData({ adLoaded: true });
    });

    // 监听广告加载失败事件
    this.data.rewardedVideoAd.onError((err) => {
      console.error('激励广告加载失败:', err);
      this.setData({ adLoaded: false });
    });

    // 监听广告关闭事件
    this.data.rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        // 用户看完了广告
        console.log('用户看完了激励广告');
        this.setData({ adWatched: true });
        this.handleAdWatchComplete();
      } else {
        // 用户中途退出广告
        console.log('用户中途退出广告');
        wx.showToast({
          title: '需要观看完整广告才能获得答疑',
          icon: 'none',
          duration: 2000
        });
      }
    });

    // 预加载广告
    this.data.rewardedVideoAd.load().catch(() => {
      console.log('预加载广告失败，将在用户点击时再次尝试');
    });
  },

  // 城市输入
  onCityInput(e) {
    const value = e.detail.value;
    this.setData({
      'formData.location': value
    });
    
    // 实时搜索过滤
    if (value.trim()) {
      const filtered = this.data.cityOptions.filter(city => 
        city.name.toLowerCase().includes(value.toLowerCase()) ||
        city.name.includes(value)
      );
      this.setData({
        filteredCities: filtered.slice(0, 8), // 最多显示8个
        showCityDropdown: true
      });
    } else {
      this.setData({
        filteredCities: [],
        showCityDropdown: false
      });
    }
  },

  // 城市输入框获得焦点
  onCityFocus() {
    const value = this.data.formData.location;
    if (value.trim()) {
      const filtered = this.data.cityOptions.filter(city => 
        city.name.toLowerCase().includes(value.toLowerCase()) ||
        city.name.includes(value)
      );
      this.setData({
        filteredCities: filtered.slice(0, 8),
        showCityDropdown: true
      });
    } else {
      // 显示热门城市
      this.setData({
        filteredCities: this.data.cityOptions.slice(0, 8),
        showCityDropdown: true
      });
    }
  },

  // 选择城市
  selectCity(e) {
    const cityName = e.currentTarget.dataset.city;
    const timezone = e.currentTarget.dataset.timezone;
    
    this.setData({
      'formData.location': cityName,
      'formData.timezone': timezone,
      showCityDropdown: false,
      filteredCities: []
    });
  },

  // 关闭城市下拉列表
  closeCityDropdown() {
    this.setData({
      showCityDropdown: false,
      filteredCities: []
    });
  },

  // 格式化日期显示
  formatDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return dateStr;
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    return `${year}年${month}月${day}日`;
  },

  // 格式化时间显示
  formatTime(timeStr) {
    const match = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (!match) return timeStr;
    const hours = parseInt(match[1]);
    const minutes = match[2];
    
    let timePeriod = '';
    if (hours >= 0 && hours < 6) timePeriod = '凌晨';
    else if (hours >= 6 && hours < 12) timePeriod = '上午';
    else if (hours >= 12 && hours < 18) timePeriod = '下午';
    else timePeriod = '晚上';
    
    return `${timePeriod} ${hours}:${minutes}`;
  },

  // 日期选择
  onDateChange(e) {
    const dateValue = e.detail.value;
    const datetime = `${dateValue}T${this.data.timeValue}`;
    
    this.setData({
      dateValue: dateValue,
      dateDisplay: this.formatDate(dateValue),
      'formData.datetime': datetime
    });
  },

  // 时间选择
  onTimeChange(e) {
    const timeValue = e.detail.value;
    const datetime = `${this.data.dateValue}T${timeValue}`;
    
    this.setData({
      timeValue: timeValue,
      timeDisplay: this.formatTime(timeValue),
      'formData.datetime': datetime
    });
  },

  // 输入事件
  onNameInput(e) {
    this.setData({ 'formData.querentName': e.detail.value });
  },

  onQuestionInput(e) {
    this.setData({ 'formData.question': e.detail.value });
  },

  // 摇动咨询
  async performShake() {
    // 严格检查：完成6次咨询或正在进行时直接返回
    if (this.data.isComplete || this.data.isShaking || this.data.lines.length >= 6) {
      console.log('咨询已完成或正在进行中，跳过');
      return;
    }

    this.setData({
      isShaking: true,
      currentResult: ''
    });

    // 开始摇动动画 - 所有叶子一起摇动
    const shakingCoins = [
      { class: 'spinning' },
      { class: 'spinning' },
      { class: 'spinning' }
    ];
    
    console.log('开始摇动，设置叶子状态:', shakingCoins);
    this.setData({ coins: shakingCoins });

    // 摇动持续1.2秒
    await this.sleep(1200);

    // 生成随机结果（每个叶子独立随机阴阳）
    const results = [
      Math.random() < 0.5 ? 'yin' : 'yang',
      Math.random() < 0.5 ? 'yin' : 'yang',
      Math.random() < 0.5 ? 'yin' : 'yang'
    ];

    console.log('咨询结果:', results);

    // 停止摇动，显示最终结果
    const newCoins = results.map(result => ({
      class: result
    }));
    
    console.log('停止摇动，更新叶子显示:', newCoins);
    this.setData({ coins: newCoins });
    
    // 确认状态已更新
    console.log('当前叶子状态:', this.data.coins);

    // 稍微停顿，让用户看清结果
    await this.sleep(500);

    // 确定爻的类型
    const lineResult = this.determineLine(results[0], results[1], results[2]);
    const lineIndex = this.data.lines.length + 1;

    const newLine = {
      index: lineIndex,
      type: lineResult.type,
      isMoving: lineResult.isMoving,
      description: this.getLineDescription({
        type: lineResult.type,
        isMoving: lineResult.isMoving
      })
    };

    const lines = [...this.data.lines, newLine];
    const orderedLines = [...lines].sort((a, b) => b.index - a.index);
    
    console.log('新增爻:', newLine);
    console.log('所有爻:', lines);
    console.log('排序后的爻:', orderedLines);
    
    const isNowComplete = lines.length >= 6;
    
    this.setData({
      lines,
      orderedLines,
      currentLineIndex: Math.min(lineIndex + 1, 6), // 最多显示6，不显示7
      currentResult: `第${lineIndex}爻：${lineResult.name}`,
      isShaking: false,
      isComplete: isNowComplete
    });

    // 如果完成6次咨询，直接显示答疑按钮
    if (isNowComplete) {
      this.setData({
        showInterpretBtn: true
      });
      wx.showToast({
        title: '咨询完成，可以获取答疑了',
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 确定爻的类型
  determineLine(coin1, coin2, coin3) {
    const yangCount = [coin1, coin2, coin3].filter(r => r === 'yang').length;
    const yinCount = 3 - yangCount;

    if (yangCount === 3) {
      return { type: 'yang', isMoving: true, name: '老阳（动）' };
    } else if (yinCount === 3) {
      return { type: 'yin', isMoving: true, name: '老阴（动）' };
    } else if (yangCount === 2) {
      return { type: 'yin', isMoving: false, name: '少阴（静）' };
    } else {
      return { type: 'yang', isMoving: false, name: '少阳（静）' };
    }
  },

  // 获取爻描述
  getLineDescription(line) {
    const typeName = line.type === 'yang' ? '阳' : '阴';
    const movingDesc = line.isMoving
      ? `（老${typeName}，动）`
      : `（少${typeName}，静）`;
    return `${typeName}爻${movingDesc}`;
  },

  // 生成排盘结果
  async generateResult() {
    console.log('=== 开始生成排盘 ===');
    console.log('当前表单数据:', this.data.formData);
    console.log('当前咨询数据:', this.data.lines);
    
    const validationError = this.validateForm();
    if (validationError) {
      console.log('表单验证失败:', validationError);
      this.setData({ errorMsg: validationError });
      wx.showToast({
        title: validationError,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    console.log('表单验证通过，开始调用API');
    wx.showLoading({ title: '生成排盘中...' });

    try {
      const requestData = {
        ...this.data.formData,
        lines: this.data.lines
      };
      console.log('API请求数据:', requestData);
      
      const result = await api.shakeHexagram(requestData);
      console.log('API响应结果:', result);

      wx.hideLoading();

      // 分析完成，但不显示分析结果，直接显示答疑按钮
      this.setData({
        resultText: '', // 不显示排盘结果
        showInterpretBtn: true,
        errorMsg: ''
      });
      
      wx.showToast({
        title: '排盘完成',
        icon: 'success',
        duration: 1500
      });
    } catch (err) {
      console.error('API调用失败:', err);
      wx.hideLoading();
      this.setData({
        errorMsg: '生成排盘失败：' + (err.message || '未知错误')
      });
      wx.showToast({
        title: '生成排盘失败',
        icon: 'none'
      });
    }
  },

  // 验证表单
  validateForm() {
    const { location, datetime, querentName, question } = this.data.formData;
    
    if (!location.trim()) return '请填写起卦地点';
    if (!datetime.trim()) return '请填写精确时间';
    if (!querentName.trim()) return '请填写测算人姓名';
    if (!question.trim()) return '请填写所问何事';
    
    return null;
  },

  // 点击获取答疑 - 先显示激励广告
  async handleInterpret() {
    // 先验证表单信息是否完整
    const validationError = this.validateForm();
    if (validationError) {
      console.log('表单验证失败:', validationError);
      this.setData({ errorMsg: validationError });
      wx.showToast({
        title: validationError,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 重置广告观看状态
    this.setData({ adWatched: false });

    // 检查激励广告是否可用
    if (!this.data.rewardedVideoAd) {
      console.error('激励广告未初始化');
      wx.showToast({
        title: '广告功能暂不可用，请稍后重试',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      // 显示激励广告
      wx.showLoading({ title: '加载广告中...' });
      await this.data.rewardedVideoAd.show();
      wx.hideLoading();
    } catch (err) {
      console.error('显示激励广告失败:', err);
      wx.hideLoading();
      
      // 广告显示失败时，尝试重新加载
      try {
        await this.data.rewardedVideoAd.load();
        wx.showLoading({ title: '重新加载广告中...' });
        await this.data.rewardedVideoAd.show();
        wx.hideLoading();
      } catch (retryErr) {
        console.error('重试显示激励广告失败:', retryErr);
        wx.hideLoading();
        wx.showToast({
          title: '广告加载失败，请检查网络后重试',
          icon: 'none',
          duration: 2000
        });
      }
    }
  },

  // 广告观看完成后执行AI分析
  async handleAdWatchComplete() {
    console.log('=== 广告观看完成，开始答疑分析 ===');
    console.log('表单数据:', this.data.formData);
    console.log('咨询数据:', this.data.lines);
    
    wx.showLoading({ title: '智能分析中...' });

    try {
      // 准备数据
      const data = {
        ...this.data.formData,
        lines: this.data.lines
      };
      
      // 生成简化分析信息
      const hexagramResult = await api.shakeHexagram(data);
      console.log('分析结果:', hexagramResult);
      
      // 直接调用智能答疑
      const interpretResult = await api.interpretHexagram(data);
      console.log('智能答疑结果:', interpretResult);

      wx.hideLoading();

      // 显示分析结果和智能答疑结果
      this.setData({
        resultText: hexagramResult.output, // 显示分析结果
        interpretationText: interpretResult.interpretation, // 显示智能答疑结果
        errorMsg: ''
      });

      wx.showToast({
        title: '答疑完成',
        icon: 'success'
      });
    } catch (err) {
      console.error('答疑失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '答疑失败：' + (err.message || '网络错误'),
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 微信分享 - 分享给朋友
  onShareAppMessage() {
    const shareData = this.generateShareContent();
    console.log('分享给朋友:', shareData);
    return shareData;
  },

  // 微信分享 - 分享到朋友圈  
  onShareTimeline() {
    const shareData = this.generateShareContent();
    console.log('分享到朋友圈:', shareData);
    return {
      title: shareData.title,
      imageUrl: shareData.imageUrl
    };
  },

  // 生成分享内容
  generateShareContent() {
    const { formData, lines, resultText, interpretationText } = this.data;
    
    // 根据当前状态生成不同的分享内容
    if (interpretationText && resultText) {
      // 已完成答疑，分享完整结果（包含分析和答疑）
      const shareTitle = this.formatShareTitle(formData);
      const shareImage = this.formatShareImage();
      
      return {
        title: shareTitle,
        path: '/pages/shake/shake',
        imageUrl: shareImage
      };
    } else if (resultText) {
      // 已排盘，分享排盘结果
      return {
        title: `${formData.querentName || '我'}的问小易咨询 - ${formData.question || '未知事项'}`,
        path: '/pages/shake/shake', 
        imageUrl: '/images/leaf-yang.png'
      };
    } else if (lines.length > 0) {
      // 正在咨询中
      return {
        title: `${formData.querentName || '我'}正在问小易`,
        path: '/pages/shake/shake',
        imageUrl: '/images/leaf-yang.png'
      };
    } else {
      // 默认分享
      return {
        title: '问小易 - 传统文化问答助手',
        path: '/pages/shake/shake',
        imageUrl: '/images/leaf-yang.png'
      };
    }
  },

  // 格式化分享标题
  formatShareTitle(formData) {
    const name = formData.querentName || '我';
    const question = formData.question || '未知事项';
    const location = formData.location || '未知';
    
    // 生成优雅的分享标题
    const titles = [
      `📿 ${name}的问小易结果 | ${question}`,
      `🔮 ${name}在${location}问小易 | ${question}`,
      `✨ ${name}的传统文化答疑 | ${question}`,
      `🌟 问小易 | ${name} - ${question}`
    ];
    
    // 随机选择一个标题样式
    return titles[Math.floor(Math.random() * titles.length)];
  },

  // 格式化分享图片（可以根据卦象生成不同图片）
  formatShareImage() {
    // 这里可以根据卦象类型返回不同的图片
    // 暂时使用默认图片
    return '/images/leaf-yang.png';
  },

  // 工具函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
