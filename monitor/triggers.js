import { config } from '../config.js';

export const RATE_LIMIT = /rate.?limit|too many requests|quota.?exceeded|429|please wait|cooldown|retry after|account.*limited|usage limit/i;
export const CONTEXT_FULL = /context window|context length|maximum context/i;
export const BLOCKED = /^BLOCKED:\s*(.*)$/im;
export const STEP_COMPLETE = /step\s+(complete|done|completed|finished)/i;

export const NO_OUTPUT_TIMEOUT_MS = config.noOutputTimeoutMs;
export const MAX_RUNTIME_MS = config.maxRuntimeMs;
