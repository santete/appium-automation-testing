/**
 * Structured logger cho test code.
 * Output format: [ISO timestamp] [LEVEL] message {context}
 *
 * M5 sẽ thay bằng pino/winston + ship lên dashboard. M1 dùng console là đủ.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const ctxStr = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxStr}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};
