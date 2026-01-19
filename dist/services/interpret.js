// src/services/interpret.ts
import https from "node:https";
async function callQwenDashScope(prompt) {
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
        throw new Error("缺少环境变量 DASHSCOPE_API_KEY（百炼 API Key）");
    }
    const model = process.env.QWEN_MODEL || "qwen-turbo";
    const timeoutMs = Number(process.env.QWEN_TIMEOUT_MS || "60000");
    const requestBody = JSON.stringify({
        model,
        input: {
            prompt,
        },
        parameters: {
            // 这些参数可按需调整
            temperature: 0.7,
            top_p: 0.8,
            max_tokens: 1200,
        },
    });
    const options = {
        method: "POST",
        hostname: "dashscope.aliyuncs.com",
        path: "/api/v1/services/aigc/text-generation/generation",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody),
            Authorization: `Bearer ${apiKey}`,
        },
        timeout: timeoutMs,
    };
    return await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let raw = "";
            res.on("data", (chunk) => (raw += chunk));
            res.on("end", () => {
                const status = res.statusCode || 0;
                if (status < 200 || status >= 300) {
                    // DashScope 错误一般会返回 message / code
                    return reject(new Error(`DashScope HTTP ${status}: ${raw}`));
                }
                try {
                    const json = JSON.parse(raw);
                    // 常见成功结构：
                    // { output: { text: "..." }, usage: {...}, request_id: "..." }
                    const text = json?.output?.text ??
                        json?.output?.choices?.[0]?.message?.content ??
                        json?.choices?.[0]?.message?.content;
                    if (!text || typeof text !== "string") {
                        return reject(new Error("DashScope 返回结构解析失败：" + raw));
                    }
                    // 打印使用量信息
                    if (json?.usage) {
                        const usage = json.usage;
                        const inputTokens = usage.input_tokens || 0;
                        const outputTokens = usage.output_tokens || 0;
                        const totalTokens = usage.total_tokens || inputTokens + outputTokens;
                        // 计算成本（qwen-turbo: 输入¥0.3/百万, 输出¥0.6/百万）
                        const inputCost = (inputTokens / 1000000) * 0.3;
                        const outputCost = (outputTokens / 1000000) * 0.6;
                        const totalCost = inputCost + outputCost;
                        console.log('=== 千问API使用统计 ===');
                        console.log(`模型: ${model}`);
                        console.log(`输入tokens: ${inputTokens}`);
                        console.log(`输出tokens: ${outputTokens}`);
                        console.log(`总计tokens: ${totalTokens}`);
                        console.log(`本次成本: ¥${totalCost.toFixed(6)} (约${(totalCost * 1000).toFixed(3)}厘)`);
                        console.log('====================');
                    }
                    resolve(text.trim());
                }
                catch (e) {
                    reject(new Error("解析 DashScope 响应失败：" + (e?.message || String(e))));
                }
            });
        });
        req.on("error", (e) => reject(e));
        req.on("timeout", () => {
            req.destroy(new Error(`DashScope 请求超时（${timeoutMs}ms）`));
        });
        req.write(requestBody);
        req.end();
    });
}
/**
 * 统一构建解卦 Prompt（根据你页面输入项）
 * 你这个页面输入：地点 / 时区 / 精确时间 / 姓名 / 所问何事 + 六爻 lines
 * 所以提示词确实应该用这些字段 —— 我已经对齐了
 */
function buildInterpretPrompt(payload, result) {
    const linesInfo = result.hexagram.lines
        .map((line) => {
        const type = line.type === "yang" ? "阳" : "阴";
        const moving = line.isMoving ? "动" : "静";
        return `第${line.index}爻：${type}爻（${moving}）${line.relation}`;
    })
        .reverse()
        .join("\n");
    return `
你是一位精通六爻占卜的老师。请根据以下信息，对“所问何事”进行专业解卦。

硬性要求：
1) 解卦开头第一句话必须是“${payload.querentName}你好”，只用名字，不要加先生/女士/居士等
2) 先给【总断 3-5 句】
3) 再【分点】解释关键爻、动爻变化、世应关系
4) 最后给【1条可执行建议】
5) 语言专业但易懂，不要输出多余格式说明

【用户输入】
起卦地点：${payload.location}
时区：${payload.timezone}
起卦时间：${payload.datetime}
测算人姓名：${payload.querentName}
所问何事：${payload.question}

【四柱八字】
年柱：${result.pillars.year}
月柱：${result.pillars.month}
日柱：${result.pillars.day}
时柱：${result.pillars.hour}

【六爻卦象】
日干支：${result.hexagram.dayGanZhi}
所属宫位：${result.hexagram.palace}
世爻：第 ${result.hexagram.shiYing.shi} 爻
应爻：第 ${result.hexagram.shiYing.ying} 爻

【六爻详情】（自下而上）
${linesInfo}

请直接输出解卦内容：
`.trim();
}
/**
 * 对外导出的函数：为了不改你其它文件，我们保留原函数名 interpretWithGemini
 * 但内部已经换成通义千问
 */
export async function interpretWithGemini(payload, result) {
    // 没配 key 就给提示（和你原来风格一致）
    if (!process.env.DASHSCOPE_API_KEY) {
        return [
            "（提示）AI 解卦未启用：缺少环境变量 DASHSCOPE_API_KEY",
            "",
            "配置方法：",
            "1. 在项目根目录 .env 添加：DASHSCOPE_API_KEY=你的百炼API密钥",
            "2. （可选）QWEN_MODEL=qwen-turbo（或 qwen-plus）",
            "3. 重启服务器",
        ].join("\n");
    }
    try {
        const prompt = buildInterpretPrompt(payload, result);
        const text = await callQwenDashScope(prompt);
        return text;
    }
    catch (error) {
        const msg = error?.message || String(error);
        return [
            "解卦时发生错误：",
            msg,
            "",
            "排查建议：",
            "1) DASHSCOPE_API_KEY 是否正确、是否有额度",
            "2) 服务器是否能访问 dashscope.aliyuncs.com（80/443）",
            "3) 如果返回 401/403：Key 或权限问题",
            "4) 如果返回 429：触发限流/额度不足，换 qwen-plus 或等一会再试",
        ].join("\n");
    }
}
