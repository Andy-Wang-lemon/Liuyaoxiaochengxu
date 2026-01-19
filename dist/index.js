import { DateTime } from "luxon";
import { calculate } from "./services/hexagram.js";
import { validateInput } from "./utils/validation.js";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
async function ask(question, defaultValue) {
    const rl = readline.createInterface({ input, output });
    const answer = (await rl.question(defaultValue ? `${question} (${defaultValue}): ` : `${question}: `)).trim();
    await rl.close();
    return answer || defaultValue || "";
}
async function main() {
    const location = await ask("请填写起卦地点");
    const timezone = await ask("请输入时区（IANA，如 Asia/Shanghai）", "Asia/Shanghai");
    const datetime = await ask("请输入精确时间（ISO，如 2025-12-10T17:30）");
    const querentName = await ask("请输入测算人姓名");
    const question = await ask("所问何事（问题/主题）");
    const payload = { location, timezone, datetime, querentName, question };
    try {
        validateInput(payload);
    }
    catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
    const result = calculate(payload);
    const localTime = DateTime.fromISO(payload.datetime, { zone: payload.timezone });
    console.log("\n=== 六爻排盘结果 ===");
    console.log(`测算人：${payload.querentName}`);
    console.log(`地点：${payload.location}`);
    console.log(`时区：${payload.timezone}`);
    console.log(`时间：${localTime.toISO({ suppressMilliseconds: true })}`);
    console.log(`所问：${payload.question}`);
    console.log("\n【四柱】");
    console.log(`年柱：${result.pillars.year}`);
    console.log(`月柱：${result.pillars.month}`);
    console.log(`日柱：${result.pillars.day}`);
    console.log(`时柱：${result.pillars.hour}`);
    console.log("\n【六爻】");
    console.log(`日干支：${result.hexagram.dayGanZhi}`);
    console.log(`所属宫位：${result.hexagram.palace}`);
    console.log(`世爻位置：第 ${result.hexagram.shiYing.shi} 爻 | 应爻位置：第 ${result.hexagram.shiYing.ying} 爻`);
    console.log("爻序自下而上（初爻=1）:");
    result.hexagram.lines.forEach((line) => {
        const glyph = line.type === "yang" ? "— —" : "——";
        const movingMark = line.isMoving ? "动" : "静";
        console.log(`第${line.index}爻：${glyph} ${line.relation}（${movingMark}）`);
    });
}
main().catch((err) => {
    console.error("运行失败：", err);
    process.exit(1);
});
