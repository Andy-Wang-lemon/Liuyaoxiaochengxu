import { DateTime } from "luxon";
import {
  CalculationResult,
  Hexagram,
  HexagramLine,
  InputPayload,
  LineResult,
  LineType,
  SixRelation,
} from "../types.js";
import { buildFourPillars } from "./pillars.js";

const stemElement: Record<string, FiveElement> = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const branchPalace: Record<string, string> = {
  子: "坎",
  丑: "艮",
  寅: "艮",
  卯: "震",
  辰: "巽",
  巳: "巽",
  午: "离",
  未: "坤",
  申: "乾",
  酉: "兑",
  戌: "乾",
  亥: "坎",
};

type FiveElement = "金" | "木" | "水" | "火" | "土";

const generateCycle: Record<FiveElement, FiveElement> = {
  金: "水",
  水: "木",
  木: "火",
  火: "土",
  土: "金",
};

const overcomeCycle: Record<FiveElement, FiveElement> = {
  金: "木",
  木: "土",
  土: "水",
  水: "火",
  火: "金",
};

const elementsWheel: FiveElement[] = ["木", "火", "土", "金", "水"];

function elementFromIndex(seed: number, idx: number): FiveElement {
  const pos = Math.abs(seed + idx) % elementsWheel.length;
  return elementsWheel[pos];
}

function relationFromElements(
  day: FiveElement,
  line: FiveElement,
): SixRelation {
  if (day === line) return "兄弟";
  if (generateCycle[line] === day) return "父母"; // line generates day
  if (overcomeCycle[line] === day) return "官鬼"; // line overcomes day
  if (generateCycle[day] === line) return "子孙"; // day generates line
  if (overcomeCycle[day] === line) return "妻财"; // day overcomes line
  return "兄弟";
}

function lineTypeFromSeed(seed: number, idx: number): LineType {
  const bit = (seed >> idx) & 1;
  return bit === 0 ? "yin" : "yang";
}

function isMovingFromSeed(seed: number, idx: number): boolean {
  const pair = (seed >> (idx * 2)) & 0b11;
  return pair === 0 || pair === 3;
}

function buildHexagram(
  dt: DateTime,
  pillarsDay: string,
  pillars: ReturnType<typeof buildFourPillars>,
  userLines?: LineResult[],
): Hexagram {
  const dayGan = pillarsDay[0];
  const dayZhi = pillarsDay.slice(1);
  const dayElement = stemElement[dayGan] ?? "土";

  // 如果用户提供了摇卦结果，使用摇卦结果；否则使用时间种子生成（向后兼容）
  const lines: HexagramLine[] = userLines
    ? userLines.map((line) => {
        // 根据爻的类型和位置计算五行元素（简化版，基于位置）
        const seed = Math.abs(Math.floor(dt.toMillis()));
        const element = elementFromIndex(seed, line.index - 1);
        return {
          index: line.index,
          type: line.type,
          isMoving: line.isMoving,
          relation: relationFromElements(dayElement, element),
        };
      })
    : Array.from({ length: 6 }).map((_, idx) => {
        const seed = Math.abs(Math.floor(dt.toMillis()));
        const element = elementFromIndex(seed, idx);
        return {
          index: idx + 1,
          type: lineTypeFromSeed(seed, idx),
          isMoving: isMovingFromSeed(seed, idx),
          relation: relationFromElements(dayElement, element),
        };
      });

  return {
    palace: branchPalace[dayZhi] ?? "中宫",
    shiYing: {
      shi: 3,
      ying: 6,
    },
    lines,
    dayGanZhi: pillars.day,
  };
}

export function calculate(payload: InputPayload): CalculationResult {
  const dt = DateTime.fromISO(payload.datetime, {
    zone: payload.timezone,
  }).startOf("minute");

  const pillars = buildFourPillars(dt);
  const hexagram = buildHexagram(dt, pillars.day, pillars, payload.lines);

  return {
    pillars,
    hexagram,
  };
}

