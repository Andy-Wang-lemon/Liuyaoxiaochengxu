import { z } from "zod";
import { IANAZone, DateTime } from "luxon";
const schema = z.object({
    location: z.string().trim().min(1, "地点不能为空"),
    timezone: z
        .string()
        .trim()
        .refine((val) => IANAZone.isValidZone(val), "时区格式不正确"),
    datetime: z
        .string()
        .trim()
        .refine((val) => DateTime.fromISO(val, { setZone: true }).isValid, "时间格式需为 ISO，如 2025-12-10T10:30"),
    querentName: z.string().trim().min(1, "测算人姓名不能为空"),
    question: z.string().trim().min(1, "所问何事不能为空"),
});
export function validateInput(payload) {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        const reason = parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "字段"}: ${issue.message}`)
            .join("; ");
        throw new Error(`输入校验失败：${reason}`);
    }
    return parsed.data;
}
