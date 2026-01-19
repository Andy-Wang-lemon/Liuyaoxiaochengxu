declare module "lunar-javascript" {
  export class Solar {
    static fromDate(date: Date): Solar;
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
    getLunar(): Lunar;
  }

  export class Lunar {
    getBaZi(): [string, string, string, string];
  }
}

