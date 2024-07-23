/**
 * Configuration options for BetterFetchClient.
 */
interface BetterFetchClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  withRetry?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
  name: string;
}

/**
 * A native fetch based client for making HTTP
 * requests with optional retry logic.
 */
export class BetterFetchClient {
  /**
   * The base URL for the API.
   */
  private baseUrl: string;
  /**
   * Default headers for the requests.
   */
  private headers: Record<string, string>;
  /**
   * Whether to enable retry logic.
   */
  private withRetry: boolean;
  /**
   * Maximum number of retry attempts.
   */
  private maxRetries: number;
  /**
   * Initial delay in milliseconds before retrying.
   */
  private initialDelayMs: number;
  /**
   * The name of the client (to be used in error messages, etc).
   * Such as "Instagram API Client" or "Facebook API Client"
   */
  private name: string;

  /**
   * Creates an instance of BetterFetchClient.
   * @param {BetterFetchClientConfig} config - Configuration options for the client.
   */
  constructor(config: BetterFetchClientConfig) {
    const {
      baseUrl,
      headers = {},
      withRetry = false,
      maxRetries = 3,
      initialDelayMs = 500,
      name,
    } = config;


    if (!baseUrl) {
      throw new Error('Base URL is required when setting up a BetterFetchClient');
    }

    this.baseUrl = baseUrl;
    this.headers = { 'Content-Type': 'application/json', ...headers };
    this.withRetry = withRetry;
    this.maxRetries = maxRetries;
    this.initialDelayMs = initialDelayMs;

    if (!name) {
      throw new Error('Name is required when setting up BetterFetchClient');
    }

    this.name = name;
  }

  /**
   * Makes an HTTP request.
   *
   * @param {string} path - The API endpoint path.
   * @param {any} [body=null] - The request payload.
   * @param {Omit<RequestInit, 'body'>} [config={}] - Additional fetch configuration options.
   * @param {number} [retries=this.maxRetries] - Number of retry attempts.
   * @returns {Promise<{ rawResponse: Response, response: RT | null }>} - The raw response and parsed response data.
   * @throws {ApiResponseError} - If the response status is not OK.
   * @throws {ApiParseError} - If the response JSON parsing fails.
   */
  async request<RT = any>(
    path: string,
    body: any = null,
    config: Omit<RequestInit, 'body'> = {},
    retries: number = this.maxRetries,
  ): Promise<{ rawResponse: Response, data: RT | null }> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers({ ...this.headers, ...config.headers });
    const contentType = headers.get('Content-Type');
    const method = config.method || 'GET';

    const requestConfig: RequestInit = {
      method,
      headers: headers,
      body: method !== 'GET' && body ? (contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit) : null,
      signal: config.signal || null, // Attach the signal to the request for cancelling
    };

    let response: Response;
    let data: RT | null = null;

    try {
      response = await fetch(url, requestConfig);

      if (!response.ok) {
        let errorResponse = null;
        try {
          errorResponse = await response.json();
        } catch (error) {
          errorResponse = await response.text();
        }

        throw new ApiResponseError(
          `[${this.name}] - HTTP ${response.status}`,
          response.status,
          errorResponse
        );
      }

      try {
        const responseContentType = response.headers.get('Content-Type') || '';

        if (responseContentType.includes('application/json')) {
          data = await response.json() as RT;
        } else if (responseContentType.includes('text/')) {
          data = await response.text() as unknown as RT;
        } else if (responseContentType.includes('application/blob')) {
          data = await response.blob() as unknown as RT;
        } else if (responseContentType.includes('application/x-www-form-urlencoded')) {
          const textData = await response.text();
          data = new URLSearchParams(textData) as unknown as RT;
        } else {
          throw new Error(`Unsupported response type: ${responseContentType}`);
        }
      } catch (err) {
        if (err.message.includes('Unsupported response type')) {
          throw err;
        }

        let errorResponse = null;
        try {
          errorResponse = await response.json();
        } catch (error) {
          errorResponse = await response.text();
        }

        throw new ApiParseError(
          `[${this.name}] - Failed to parse response: ${err.message}`,
          response.status,
          errorResponse
        );
      }

      return { rawResponse: response, data };
    } catch (error) {
      // If the request fails, check if we should retry
      if (retries < this.maxRetries && this.shouldRetry(error)) {
        // Calculate the delay before retrying
        const delay = this.initialDelayMs * Math.pow(2, retries);
        console.log(`Retrying... Attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(path, body, config, retries + 1).then(res => res);
      } else {
        // If we should not retry, handle the error
        this.handleError(error);
      }
    }

    return { rawResponse: response!, data };
  }

  /**
   * Determines if a request should be retried.
   * @param {any} error - The error object.
   * @returns {boolean} True if the request should be retried, false otherwise.
   */
  shouldRetry(error: any): boolean {
    // Retry logic condition: typically retries on server errors (5xx)
    return this.withRetry && error instanceof ApiResponseError && error.status >= 500;
  }

  /**
   * Handles errors by rethrowing them. This was done to allow an extended
   * class to handle the error in a more specific way by overriding this method.
   * @param {any} error - The error object.
   * @throws The rethrown error.
   */
  handleError(error: any): void {
    throw error; // Rethrow the error
  }

  /**
   * Makes a GET request.
   * @param {string} path - The API endpoint path.
   * @param {Omit<RequestInit, 'body'|'method'>} [config={}] - Additional fetch configuration options.
   */
  get<RT = any>(path: string, config: Omit<RequestInit, 'body'|'method'> = {}) {
    return this.request<RT>(path, null, { method: 'GET', ...config });
  }

  /**
   * Makes a POST request.
   * @param {string} path - The API endpoint path.
   * @param {any} body - The request body.
   * @param {Omit<RequestInit, 'body'|'method'>} [config={}] - Additional fetch configuration options.
   */
  post<RT = any>(path: string, body: any, config: Omit<RequestInit, 'body'|'method'> = {}) {
    return this.request<RT>(path, body, { method: 'POST', ...config });
  }

  /**
   * Makes a PUT request.
   * @param {string} path - The API endpoint path.
   * @param {any} body - The request body.
   * @param {Omit<RequestInit, 'body'|'method'>} [config={}] - Additional fetch configuration options.
   */
  put<RT = any>(path: string, body: any, config: Omit<RequestInit, 'body'|'method'> = {}) {
    return this.request<RT>(path, body, { method: 'PUT', ...config });
  }

  /**
   * Makes a PATCH request.
   * @param {string} path - The API endpoint path.
   * @param {any} body - The request body.
   * @param {Omit<RequestInit, 'body'|'method'>} [config={}] - Additional fetch configuration options.
   */
  patch<RT = any>(path: string, body: any, config: Omit<RequestInit, 'body'|'method'> = {}) {
    return this.request<RT>(path, body, { method: 'PATCH', ...config });
  }

  /**
   * Makes a DELETE request.
   * @param {string} path - The API endpoint path.
   * @param {Omit<RequestInit, 'body'|'method'>} [config={}] - Additional fetch configuration options.
   */
  delete<RT = any>(path: string, config: Omit<RequestInit, 'body'|'method'> = {}) {
    return this.request<RT>(path, null, { method: 'DELETE', ...config });
  }
}

/**
 * Base class for API errors.
 * @extends Error
 */
export class ApiError extends Error {
  /**
   * The HTTP status code.
   */
  status: number;
  /**
   * The response text.
   */
  response: object|string;

  /**
   * Creates an instance of ApiError.
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code.
   * @param {object|string} response - The response.
   */
  constructor(message: string, status: number, response: object|string) {
    super(message);
    this.status = status;
    this.response = response;
  }
}

/**
 * Error class for API response errors.
 * @extends ApiError
 */
export class ApiResponseError extends ApiError {
  /**
   * Creates an instance of ApiResponseError.
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code.
   * @param {object|string} response - The response body.
   */
  constructor(message: string, status: number, response: object|string) {
    super(message, status, response);
  }
}

/**
 * Error class for API parse errors.
 * @extends ApiError
 */
export class ApiParseError extends ApiError {
  /**
   * Creates an instance of ApiParseError.
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code.
   * @param {object|string} response - The response body
   */
  constructor(message: string, status: number, response: object|string) {
    super(message, status, response);
  }
}
