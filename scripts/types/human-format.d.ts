declare module "human-format" {
  export interface ScalePrefixNumDict {
    [prefix: string]: number;
  }

  export class Scale {
    constructor(prefixes: ScalePrefixNumDict);
  }

  export interface HumanizeOptions {
    scale?: Scale | "binary";
    unit?: string;
    prefix?: string;
    separator?: string;
    decimals?: number;
    strict?: boolean;
  }

  export interface HumanizeParsedRaw {
    factor: number;
    prefix: string;
    unit: string;
    value: number;
  }

  export interface HumanizeParse {
    (value: string, options?: HumanizeOptions): number;
    raw(value: string, options?: HumanizeOptions): HumanizeParsedRaw;
  }

  export interface HumanizedRaw {
    prefix: string;
    value: number;
  }

  export interface Humanize {
    (value: number, options?: HumanizeOptions): string;
    Scale: Scale;
    parse: HumanizeParse;
    bytes(value: number, options?: HumanizeOptions): string;
    raw(value: string, options?: HumanizeOptions): HumanizedRaw;
  }

  const humanize: Humanize;

  export default humanize;
}
