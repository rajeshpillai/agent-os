export type ErrorCategory =
  | "provider_error"      // LLM API failures
  | "tool_error"          // Tool execution failures
  | "config_error"        // Missing or invalid configuration
  | "timeout_error"       // Operation timed out
  | "validation_error"    // Input validation failures
  | "memory_error"        // Memory store failures
  | "approval_error"      // Approval gate failures
  | "unknown_error";      // Uncategorized

export class AgentError extends Error {
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly cause?: Error;

  constructor(
    message: string,
    category: ErrorCategory,
    options?: { retryable?: boolean; cause?: Error }
  ) {
    super(message);
    this.name = "AgentError";
    this.category = category;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
  }
}

export function categorizeError(error: unknown): AgentError {
  if (error instanceof AgentError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const original = error instanceof Error ? error : undefined;

  // Config (check before provider — "OPENAI_API_KEY" contains "API")
  if (message.includes("config") || message.includes("OPENAI_API_KEY") || message.includes("is required")) {
    return new AgentError(message, "config_error", { retryable: false, cause: original });
  }

  // Provider errors (API failures, rate limits)
  if (message.includes("API") || message.includes("rate limit") || message.includes("429") || message.includes("500") || message.includes("503")) {
    return new AgentError(message, "provider_error", { retryable: true, cause: original });
  }

  // Timeout
  if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("timed out")) {
    return new AgentError(message, "timeout_error", { retryable: true, cause: original });
  }

  // File/memory
  if (message.includes("ENOENT") || message.includes("EACCES") || message.includes("memory")) {
    return new AgentError(message, "memory_error", { retryable: false, cause: original });
  }

  return new AgentError(message, "unknown_error", { retryable: false, cause: original });
}
