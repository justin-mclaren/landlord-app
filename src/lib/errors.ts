/**
 * Error handling utilities
 * Provides custom error classes and error handling helpers
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      error: this.userMessage || this.message,
      code: this.code,
      ...(this.context && { context: this.context }),
    };
  }
}

/**
 * Validation error (400)
 * Used for invalid user input
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      "VALIDATION_ERROR",
      400,
      message, // User-friendly message
      { field, ...context }
    );
  }
}

/**
 * Not found error (404)
 * Used when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `${resource} not found${identifier ? `: ${identifier}` : ""}`,
      "NOT_FOUND",
      404,
      `We couldn't find that ${resource.toLowerCase()}.`,
      { resource, identifier, ...context }
    );
  }
}

/**
 * External API error (502/503)
 * Used when external APIs fail
 */
export class APIError extends AppError {
  constructor(
    service: string,
    message: string,
    public readonly originalError?: Error,
    statusCode: number = 502,
    context?: Record<string, unknown>
  ) {
    super(
      `${service} API error: ${message}`,
      "API_ERROR",
      statusCode,
      `We're having trouble fetching data from ${service}. Please try again.`,
      { service, originalError: originalError?.message, ...context }
    );
  }
}

/**
 * Rate limit error (429)
 * Used when rate limits are exceeded
 */
export class RateLimitError extends AppError {
  constructor(
    service: string,
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Rate limit exceeded for ${service}`,
      "RATE_LIMIT_ERROR",
      429,
      "Too many requests. Please wait a moment and try again.",
      { service, retryAfter, ...context }
    );
  }
}

/**
 * Configuration error (500)
 * Used when required configuration is missing
 */
export class ConfigurationError extends AppError {
  constructor(
    configKey: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Missing required configuration: ${configKey}`,
      "CONFIGURATION_ERROR",
      500,
      "Server configuration error. Please contact support.",
      { configKey, ...context }
    );
  }
}

/**
 * Data quality error (422)
 * Used when data is incomplete or invalid
 */
export class DataQualityError extends AppError {
  constructor(
    message: string,
    public readonly missingFields?: string[],
    context?: Record<string, unknown>
  ) {
    super(
      message,
      "DATA_QUALITY_ERROR",
      422,
      "The property data is incomplete. We couldn't generate a full report.",
      { missingFields, ...context }
    );
  }
}

/**
 * Timeout error (504)
 * Used when operations take too long
 */
export class TimeoutError extends AppError {
  constructor(
    operation: string,
    timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      "TIMEOUT_ERROR",
      504,
      "The request took too long. Please try again.",
      { operation, timeoutMs, ...context }
    );
  }
}

/**
 * Network error (503)
 * Used when network requests fail
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public readonly originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(
      `Network error: ${message}`,
      "NETWORK_ERROR",
      503,
      "Network connection failed. Please check your connection and try again.",
      { originalError: originalError?.message, ...context }
    );
  }
}

/**
 * Cache error (non-fatal)
 * Used when cache operations fail but we can continue
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly key?: string,
    public readonly operation?: string
  ) {
    super(message);
    this.name = "CacheError";
  }
}

/**
 * Parse error (422)
 * Used when parsing/validation fails
 */
export class ParseError extends AppError {
  constructor(
    message: string,
    public readonly source?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Parse error: ${message}`,
      "PARSE_ERROR",
      422,
      "We couldn't parse the data. Please check the format and try again.",
      { source, ...context }
    );
  }
}

/**
 * Convert any error to AppError
 * Useful for error handling in catch blocks
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes("429") || error.message.includes("rate limit")) {
      return new RateLimitError("external_service", undefined, {
        originalMessage: error.message,
      });
    }

    if (error.message.includes("timeout") || error.name === "AbortError") {
      return new TimeoutError("unknown", 0, {
        originalMessage: error.message,
      });
    }

    if (error.message.includes("network") || error.message.includes("fetch")) {
      return new NetworkError(error.message, error);
    }

    // Generic API error
    return new APIError("unknown", error.message, error);
  }

  // Unknown error type
  return new AppError(
    String(error),
    "UNKNOWN_ERROR",
    500,
    "An unexpected error occurred. Please try again."
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return (
      error instanceof RateLimitError ||
      error instanceof TimeoutError ||
      error instanceof NetworkError ||
      (error instanceof APIError && error.statusCode >= 500)
    );
  }
  return false;
}

/**
 * Extract user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred. Please try again.";
}

/**
 * Extract error code
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

/**
 * Extract HTTP status code
 */
export function getStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

