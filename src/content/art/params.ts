/** Typed readers for the free-form `params` object of pattern art. */
import type { ParamValue } from '../raw-types';

export interface Params {
  num(name: string, fallback: number): number;
  str(name: string, fallback: string): string;
  bool(name: string, fallback: boolean): boolean;
}

export function readParams(raw: Readonly<Record<string, ParamValue>> | undefined): Params {
  const get = (name: string): ParamValue | undefined => raw?.[name];
  return {
    num: (name, fallback) => {
      const v = get(name);
      return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    },
    str: (name, fallback) => {
      const v = get(name);
      return typeof v === 'string' ? v : fallback;
    },
    bool: (name, fallback) => {
      const v = get(name);
      return typeof v === 'boolean' ? v : fallback;
    },
  };
}
