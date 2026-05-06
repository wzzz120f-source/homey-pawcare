/**
 * 日志工具
 * 提供统一的日志记录功能
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  requestId?: string;
}

class Logger {
  private isDevelopment: boolean;
  private requestId?: string;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | string, context?: LogContext) {
    const errorContext = {
      ...context,
      ...(error instanceof Error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
      ...(typeof error === 'string' && { errorMessage: error }),
    };
    this.log('error', message, errorContext);
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
    };

    if (this.isDevelopment) {
      this.logToDev(entry);
    } else {
      this.logToProd(entry);
    }
  }

  private logToDev(entry: LogEntry) {
    const { level, message, context, timestamp } = entry;
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, context);
        break;
      case 'info':
        console.log(prefix, message, context);
        break;
      case 'warn':
        console.warn(prefix, message, context);
        break;
      case 'error':
        console.error(prefix, message, context);
        break;
    }
  }

  private logToProd(entry: LogEntry) {
    // 在生产环境中，可以将日志发送到外部日志服务
    // 例如：Sentry, LogRocket, DataDog 等
    // 这里是一个示例实现
    if (entry.level === 'error') {
      // 发送错误日志到外部服务
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry) {
    // TODO: 实��外部日志服务集成
    // 例如：
    // fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) })
  }
}

export const logger = new Logger();
