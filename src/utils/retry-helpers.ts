/**
 * Utility functions for API request retries with exponential backoff
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterFactor?: number;
  retryStatusCodes?: number[];
}

/**
 * Executes an async function with exponential backoff retry logic
 * 
 * @param operation The async function to execute with retry logic
 * @param options Configuration options for the retry behavior
 * @returns The result of the successful operation
 * @throws The last error encountered if all retries fail
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 200,
    maxDelayMs = 10000,
    backoffFactor = 2,
    jitterFactor = 0.25,
    retryStatusCodes = [429, 503, 502, 500]
  } = options;

  let lastError: any;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry based on error
      const shouldRetry = 
        // Check if it's an HTTP error with status code
        (error.status && retryStatusCodes.includes(error.status)) ||
        // Check for Google AI specific error format
        (error.message && error.message.includes('Service Unavailable')) ||
        // Check for network errors
        (error.message && (
          error.message.includes('network') || 
          error.message.includes('timeout') ||
          error.message.includes('overloaded')
        ));
      
      // If we shouldn't retry or we're out of retries, throw the error
      if (!shouldRetry || attempt === maxRetries) {
        throw lastError;
      }
      
      // Log the retry (but not in production to avoid log spam)
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`API request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms`, {
          error: error.message || error,
          status: error.status,
          retryCount: attempt + 1
        });
      }
      
      // Wait before retrying with jitter
      // Jitter helps prevent thundering herd problems
      const jitter = Math.random() * jitterFactor * delayMs;
      await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
      
      // Increase the delay for the next attempt (exponential backoff)
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
  
  // This should never be reached due to the throw in the loop, but TypeScript needs it
  throw lastError;
} 