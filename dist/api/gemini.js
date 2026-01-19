export async function askGemini(prompt) {
    const res = await fetch("http://localhost:8787/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });
    const data = (await res.json());
    if (!res.ok) {
        const msg = ("detail" in data && data.detail) ||
            ("error" in data && data.error) ||
            "请求失败";
        throw new Error(msg);
    }
    // 成功时一定有 text
    if (!("text" in data))
        throw new Error("响应格式错误：缺少 text");
    return data.text;
}
