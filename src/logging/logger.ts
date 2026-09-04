import { SecretRedactor } from '../security/secrets.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  eventType?: string;
  toolName?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export class Logger {
  private minLevel: LogLevel;
  private redactor: SecretRedactor;
  private defaultContext: LogContext;

  constructor(
    level: LogLevel = 'info',
    redactor?: SecretRedactor,
    defaultContext: LogContext = {}
  ) {
    this.minLevel = level;
    this.redactor = redactor || new SecretRedactor();
    this.defaultContext = defaultContext;
  }

  public child(context: LogContext): Logger {
    return new Logger(this.minLevel, this.redactor, {
      ...this.defaultContext,
      ...context,
    });
  }

  public addSecret(secret?: string | null): void {
    this.redactor.addSecret(secret);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.minLevel];
  }

  private format(level: LogLevel, message: string, context?: LogContext): string {
    const merged = {
      timestamp: new Date().toISOString(),
      level,
      message: this.redactor.redact(message),
      ...this.defaultContext,
      ...context,
    };
    const sanitized = this.redactor.sanitize(merged) as Record<string, unknown>;
    return JSON.stringify(sanitized);
  }

  public debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.format('info', message, context));
    }
  }

  public warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, context));
    }
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errContext: LogContext = { ...context };
      if (error instanceof Error) {
        errContext.errorName = error.name;
        errContext.errorMessage = this.redactor.redact(error.message);
        errContext.stack = error.stack ? this.redactor.redact(error.stack) : undefined;
      } else if (error) {
        errContext.rawError = this.redactor.redact(String(error));
      }
      console.error(this.format('error', message, errContext));
    }
  }
}
