import { Solar } from "lunar-javascript";
export function buildFourPillars(dt) {
    if (!dt.isValid) {
        throw new Error("时间无效，无法生成四柱");
    }
    const solar = Solar.fromDate(dt.toJSDate());
    const [year, month, day, hour] = solar.getLunar().getBaZi();
    return {
        year,
        month,
        day,
        hour,
    };
}
