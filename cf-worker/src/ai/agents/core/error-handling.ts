import { AgentError, RetryConfig } from "./types";

// Custom error classes
export class AgentExecutionError extends Error implements AgentError {
  code: string;
  context?: Record<string, unknown>;
  retryable: boolean;

  constructor(
    message: string,
    code: string,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AgentExecutionError";
    this.code = code;
    this.retryable = retryable;
    this.context = context;
  }
}

export class ToolExecutionError extends Error implements AgentError {
  code: string;
  context?: Record<string, unknown>;
  retryable: boolean;

  constructor(
    message: string,
    toolName: string,
    retryable: boolean = false,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ToolExecutionError";
    this.code = `TOOL_${toolName.toUpperCase()}_ERROR`;
    this.retryable = retryable;
    this.context = { toolName, ...context };
  }
}

export class ConfigurationError extends Error implements AgentError {
  code: string;
  context?: Record<string, unknown>;
  retryable: boolean = false;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "ConfigurationError";
    this.code = "CONFIGURATION_ERROR";
    this.context = context;
  }
}

export class StateError extends Error implements AgentError {
  code: string;
  context?: Record<string, unknown>;
  retryable: boolean = true;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = "StateError";
    this.code = "STATE_ERROR";
    this.context = context;
  }
}

// Retry mechanism
export class RetryManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: string
  ): Promise<T> {
    const retryConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const handledError = ErrorHandler.handle(error);
        if (
          handledError instanceof AgentExecutionError &&
          !handledError.retryable
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay *
            Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );

        console.warn(
          `Retry attempt ${attempt + 1}/${retryConfig.maxRetries} for ${context || "operation"} after ${delay}ms:`,
          lastError?.message
        );

        await this.sleep(delay);
      }
    }

    throw new AgentExecutionError(
      `Operation failed after ${retryConfig.maxRetries} retries`,
      "MAX_RETRIES_EXCEEDED",
      false,
      { lastError: lastError?.message, context }
    );
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Circuit breaker pattern
export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private failureThreshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttemptTime) {
        throw new AgentExecutionError(
          "Circuit breaker is OPEN",
          "CIRCUIT_BREAKER_OPEN",
          true
        );
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    }
  }

  getState(): { state: string; failureCount: number; nextAttemptTime: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}

// Error handler
export class ErrorHandler {
  private static readonly ERROR_CODES = {
    NETWORK_ERROR: "NETWORK_ERROR",
    TIMEOUT_ERROR: "TIMEOUT_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
    RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  };

  static handle(error: unknown, context?: string): AgentError {
    if (
      error instanceof AgentExecutionError ||
      error instanceof ToolExecutionError ||
      error instanceof ConfigurationError ||
      error instanceof StateError
    ) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = this.classifyError(error);

    return new AgentExecutionError(
      errorMessage,
      errorCode,
      this.isRetryable(error),
      { originalError: error, context }
    );
  }

  private static classifyError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("network") || message.includes("fetch")) {
        return this.ERROR_CODES.NETWORK_ERROR;
      }
      if (message.includes("timeout")) {
        return this.ERROR_CODES.TIMEOUT_ERROR;
      }
      if (message.includes("validation") || message.includes("invalid")) {
        return this.ERROR_CODES.VALIDATION_ERROR;
      }
      if (message.includes("auth") || message.includes("unauthorized")) {
        return this.ERROR_CODES.AUTHENTICATION_ERROR;
      }
      if (message.includes("rate limit") || message.includes("too many")) {
        return this.ERROR_CODES.RATE_LIMIT_ERROR;
      }
    }

    return this.ERROR_CODES.UNKNOWN_ERROR;
  }

  private static isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors are usually retryable
      if (message.includes("network") || message.includes("fetch")) {
        return true;
      }

      // Timeout errors are retryable
      if (message.includes("timeout")) {
        return true;
      }

      // Rate limit errors are retryable after delay
      if (message.includes("rate limit") || message.includes("too many")) {
        return true;
      }

      // Validation errors are not retryable
      if (message.includes("validation") || message.includes("invalid")) {
        return false;
      }

      // Authentication errors are not retryable
      if (message.includes("auth") || message.includes("unauthorized")) {
        return false;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }
}

// Error logger
export class ErrorLogger {
  static log(error: AgentError, context?: Record<string, unknown>): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        retryable: error.retryable,
        context: { ...error.context, ...context },
      },
    };

    if (error.retryable) {
      console.warn("Retryable error occurred:", logData);
    } else {
      console.error("Non-retryable error occurred:", logData);
    }
  }
}

// Error recovery strategies
export class ErrorRecovery {
  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    context?: string
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      console.warn(
        `Primary operation failed, trying fallback for ${context}:`,
        error
      );
      return await fallback();
    }
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context?: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new AgentExecutionError(
              `Operation timed out after ${timeoutMs}ms`,
              "TIMEOUT_ERROR",
              true,
              { context }
            )
          );
        }, timeoutMs);
      }),
    ]);
  }
}
