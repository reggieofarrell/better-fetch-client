/**
 * Configuration options for BetterFetchClient.
 */
 interface BetterFetchClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  withRetry?: boolean;
  maxRetries?: number;
  initialDelayMs?: number;
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
  private headers: Headers;
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
   * Object to store AbortController instances for each request.
   */
  private abortControllers: { [key: string]: AbortController } = {};

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
    } = config;

    // Add default Content-Type header
    this.baseUrl = baseUrl;
    this.headers = new Headers({ 'Content-Type': 'application/json', ...headers });
    this.withRetry = withRetry;
    this.maxRetries = maxRetries;
    this.initialDelayMs = initialDelayMs;
  }

  /**
   * Makes an HTTP request.
   * @param {string} method - The HTTP method (GET, POST, etc.).
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any> | null} body - The request body. (default: null)
   * @param {Record<string, string>} customHeaders - Custom headers for the request. (default: {})
   * @param {number} retries - Current retry attempt. (default: 0)
   * @param {string} requestId - The unique identifier for the request. (default: `${method}-${path}-${Date.now()}`)
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   * @throws {ApiResponseError} - If the response status is not OK.
   * @throws {ApiParseError} - If the response JSON parsing fails.
   */
  async request<RT = any>(
    method: string,
    path: string,
    body: Record<string, any> | null = null,
    customHeaders: Record<string, string> = {},
    retries: number = 0,
    requestId: string = `${method}-${path}-${Date.now()}`
  ): Promise<{ requestId: string, response: Promise<RT | null> }> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers({ ...this.headers, ...customHeaders });

    // Create a new AbortController for this request
    const abortController = new AbortController();
    const { signal } = abortController;

    // Store the AbortController in the object
    this.abortControllers[requestId] = abortController;

    const config: RequestInit = {
      method: method,
      headers: headers,
      body: method !== 'GET' && body ? JSON.stringify(body) : null,
      signal: signal, // Attach the signal to the request
    };

    const responsePromise = (async () => {
      try {
        const response = await fetch(url, config);
        let data: RT | null = null;

        try {
          data = await response.json(); // Always attempt to parse JSON, regardless of response status
        } catch (err) {
          throw new ApiParseError(
            'Failed to parse JSON response',
            response.status,
            await response.text(),
            data
          );
        }

        if (!response.ok) {
          throw new ApiResponseError(
            'HTTP error with JSON body',
            response.status,
            await response.text(),
            data
          );
        }

        // Remove the AbortController from the object after the request completes
        delete this.abortControllers[requestId];

        return data;
      } catch (error) {
        // Remove the AbortController from the object if an error occurs
        delete this.abortControllers[requestId];

        // If the request fails, check if we should retry
        if (retries < this.maxRetries && this.shouldRetry(error)) {
          // Calculate the delay before retrying
          const delay = this.initialDelayMs * Math.pow(2, retries);
          console.log(`Retrying... Attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(method, path, body, customHeaders, retries + 1, requestId).then(res => res.response);
        } else {
          // If we should not retry, handle the error
          this.handleError(error);
        }
      }

      return null;
    })();

    return { requestId, response: responsePromise };
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
   * Cancels a request by its identifier.
   * @param {string} requestId - The unique identifier for the request.
   */
  cancelRequest(requestId: string): void {
    const abortController = this.abortControllers[requestId];
    if (abortController) {
      abortController.abort();
      delete this.abortControllers[requestId];
    }
  }

  /**
   * Makes a GET request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, string>} headers - Custom headers for the request. (default: {})
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   */
  get<RT = any>(path: string, headers: Record<string, string> = {}) {
    return this.request<RT>('GET', path, null, headers);
  }

  /**
   * Makes a POST request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request. (default: {})
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   */
  post<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}) {
    return this.request<RT>('POST', path, body, headers);
  }

  /**
   * Makes a PUT request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request. (default: {})
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   */
  put<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}) {
    return this.request<RT>('PUT', path, body, headers);
  }

  /**
   * Makes a PATCH request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request. (default: {})
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   */
  patch<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}) {
    return this.request<RT>('PATCH', path, body, headers);
  }

  /**
   * Makes a DELETE request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, string>} headers - Custom headers for the request. (default: {})
   * @returns {Promise<{ requestId: string, response: Promise<RT | null> }>} The response data and request ID.
   */
  delete<RT = any>(path: string, headers: Record<string, string> = {}) {
    return this.request<RT>('DELETE', path, null, headers);
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
  responseText: string;
  /**
   * The parsed response data.
   */
  data: any;

  /**
   * Creates an instance of ApiError.
   * @param {string} message - The error message.
   * @param {number} status - The HTTP status code.
   * @param {string} responseText - The response text.
   * @param {any} data - The parsed response data.
   */
  constructor(message: string, status: number, responseText: string, data: any = null) {
    super(message);
    this.status = status;
    this.responseText = responseText;
    this.data = data;
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
   * @param {string} responseText - The response text.
   * @param {any} data - The parsed response data.
   */
  constructor(message: string, status: number, responseText: string, data: any = null) {
    super(message, status, responseText, data);
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
   * @param {string} responseText - The response text.
   * @param {any} data - The parsed response data.
   */
  constructor(message: string, status: number, responseText: string, data: any = null) {
    super(message, status, responseText, data);
  }
}
