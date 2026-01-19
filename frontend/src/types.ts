export interface LineResult {
  index: number;
  type: 'yin' | 'yang';
  isMoving: boolean;
}

export interface InputPayload {
  location: string;
  timezone: string;
  datetime: string;
  querentName: string;
  question: string;
  lines: LineResult[];
}

export interface ShakeResponse {
  output: string;
}

export interface InterpretResponse {
  output: string;
  interpretation: string;
}


