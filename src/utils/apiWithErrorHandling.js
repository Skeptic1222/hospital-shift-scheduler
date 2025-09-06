import { apiFetch as baseApiFetch } from './api';

// Enhanced API fetch with better error handling and loading states
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch(path, options = {}) {
  try {
    const response = await baseApiFetch(path, options);

    // Handle non-OK responses
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      let errorData = null;

      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Response body is not JSON
        try {
          errorMessage = await response.text() || errorMessage;
        } catch {
          // Unable to read response body
        }
      }

      throw new ApiError(errorMessage, response.status, errorData);
    }

    return response;
  } catch (error) {
    // Network errors or other fetch failures
    if (error.name === 'ApiError') {
      throw error;
    }

    throw new ApiError(
      error.message || 'Network error occurred',
      0,
      null
    );
  }
}

// Utility hook for API calls with loading and error states
import { useState, useCallback } from 'react';

export function useApiCall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (apiCall) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      setLoading(false);
      return result;
    } catch (err) {
      setError(err);
      setLoading(false);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, execute, reset };
}

// Retry logic for failed requests
export async function apiWithRetry(
  apiCall,
  maxRetries = 3,
  retryDelay = 1000
) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, retryDelay * Math.pow(2, i))
        );
      }
    }
  }

  throw lastError;
}

// Batch API calls
export async function apiBatch(apiCalls) {
  const results = await Promise.allSettled(apiCalls);

  const successful = [];
  const failed = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push({ index, value: result.value });
    } else {
      failed.push({ index, reason: result.reason });
    }
  });

  return { successful, failed };
}

export default apiFetch;

