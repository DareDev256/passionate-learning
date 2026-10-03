// Typed doorway into the verbatim JS stick kit (stickKit.ts is @ts-nocheck so it stays identical to the book's).
import * as K from "./stickKit";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Opts = Record<string, any>;
export const figure = K.figure as unknown as (o?: Opts) => string;
export const scene = K.scene as unknown as (o: { w?: number; h?: number; ground?: number; groundLine?: boolean; items?: (Opts | string)[]; extra?: string; cls?: string }) => string;
export const PROPS = K.PROPS as unknown as Record<string, (...a: any[]) => string>;
export const DEFS = K.DEFS as unknown as string;
