/**
 * Thin wrapper around console that prefixes all output with [Write-Tron].
 * All methods are no-ops in production builds if you set VITE_LOG=0.
 */
const enabled = import.meta.env.VITE_LOG !== '0';
const P = '%c[Write-Tron]%c';
const STYLE = 'color:#8b5cf6;font-weight:bold';
const RESET = 'color:inherit;font-weight:normal';

export const log = {
  info(msg: string, ...data: unknown[]) {
    if (enabled) console.log(P, STYLE, RESET, msg, ...data);
  },
  warn(msg: string, ...data: unknown[]) {
    if (enabled) console.warn(P, STYLE, RESET, msg, ...data);
  },
  error(msg: string, ...data: unknown[]) {
    if (enabled) console.error(P, STYLE, RESET, msg, ...data);
  },
  group(label: string) {
    if (enabled) console.group(`%c[Write-Tron] ${label}`, STYLE);
  },
  groupEnd() {
    if (enabled) console.groupEnd();
  },
  table(label: string, data: unknown) {
    if (enabled) {
      console.log(P, STYLE, RESET, label);
      console.table(data);
    }
  },
};
