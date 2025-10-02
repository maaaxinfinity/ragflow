import { message } from 'antd';

/**
 * Unified error handler for FreeChat feature
 * Provides consistent error logging and user notifications
 */

export enum ErrorLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface ErrorOptions {
  level?: ErrorLevel;
  showToUser?: boolean;
  userMessage?: string;
}

class ErrorHandler {
  /**
   * Handle error with consistent logging and optional user notification
   * @param error - Error message or Error object
   * @param context - Context where error occurred (e.g., 'FreeChat.sendMessage')
   * @param options - Error handling options
   */
  handle(
    error: string | Error,
    context: string,
    options: ErrorOptions = {}
  ): void {
    const {
      level = ErrorLevel.ERROR,
      showToUser = false,
      userMessage,
    } = options;

    const errorMessage = error instanceof Error ? error.message : error;
    const logMessage = `[${context}] ${errorMessage}`;

    // Log to console based on level
    switch (level) {
      case ErrorLevel.INFO:
        console.info(logMessage);
        break;
      case ErrorLevel.WARN:
        console.warn(logMessage);
        break;
      case ErrorLevel.ERROR:
        console.error(logMessage, error instanceof Error ? error.stack : '');
        break;
    }

    // Show message to user if requested
    if (showToUser) {
      const displayMessage = userMessage || errorMessage;
      switch (level) {
        case ErrorLevel.INFO:
          message.info(displayMessage);
          break;
        case ErrorLevel.WARN:
          message.warning(displayMessage);
          break;
        case ErrorLevel.ERROR:
          message.error(displayMessage);
          break;
      }
    }
  }

  /**
   * Log info message
   */
  info(message: string, context: string): void {
    console.info(`[${context}] ${message}`);
  }

  /**
   * Log warning
   */
  warn(message: string, context: string, showToUser = false): void {
    this.handle(message, context, {
      level: ErrorLevel.WARN,
      showToUser,
    });
  }

  /**
   * Log error
   */
  error(
    error: string | Error,
    context: string,
    showToUser = false,
    userMessage?: string
  ): void {
    this.handle(error, context, {
      level: ErrorLevel.ERROR,
      showToUser,
      userMessage,
    });
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const logInfo = (message: string, context: string) =>
  errorHandler.info(message, context);

export const logWarn = (
  message: string,
  context: string,
  showToUser = false
) => errorHandler.warn(message, context, showToUser);

export const logError = (
  error: string | Error,
  context: string,
  showToUser = false,
  userMessage?: string
) => errorHandler.error(error, context, showToUser, userMessage);
