export interface InputPayload {
  location: string;
  timezone: string;
  datetime: string;
  querentName: string;
  question: string;
  lines?: LineResult[]; // 摇卦结果
}

export interface LineResult {
  index: number; // 1-6
  type: LineType; // "yin" | "yang"
  isMoving: boolean; // 是否动爻
}

export interface FourPillars {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export type LineType = "yin" | "yang";

export interface HexagramLine {
  index: number;
  type: LineType;
  isMoving: boolean;
  relation: SixRelation;
}

export type SixRelation =
  | "父母"
  | "兄弟"
  | "子孙"
  | "妻财"
  | "官鬼";

export interface Hexagram {
  palace: string;
  shiYing: {
    shi: number;
    ying: number;
  };
  lines: HexagramLine[];
  dayGanZhi: string;
}

export interface CalculationResult {
  pillars: FourPillars;
  hexagram: Hexagram;
}

