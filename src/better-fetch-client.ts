/**
 * A native fetch based client for making HTTP
 * requests with optional retry logic.
 */
class BetterFetchClient {
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
   * Creates an instance of BetterFetchClient.
   * @param {string} baseUrl - The base URL for the API.
   * @param {Record<string, string>} headers - Default headers for the requests. (default: {})
   * @param {boolean} withRetry - Whether to enable retry logic. (default: true)
   * @param {number} maxRetries - Maximum number of retry attempts. (default: 3)
   * @param {number} initialDelayMs - Initial delay in milliseconds before retrying. (default: 500)
   */
  constructor(
    baseUrl: string,
    headers: Record<string, string> = {},
    withRetry: boolean = true,
    maxRetries: number = 3,
    initialDelayMs: number = 500
  ) {
    this.baseUrl = baseUrl;
    this.headers = new Headers(headers);
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
   * @returns {Promise<RT>} The response data.
   * @throws {ApiResponseError} - If the response status is not OK.
   * @throws {ApiParseError} - If the response JSON parsing fails.
   */
  async request<RT = any>(
    method: string,
    path: string,
    body: Record<string, any> | null = null,
    customHeaders: Record<string, string> = {},
    retries: number = 0
  ): Promise<RT | null> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers({ ...this.headers, ...customHeaders });

    const config: RequestInit = {
      method: method,
      headers: headers,
      body: method !== 'GET' && body ? JSON.stringify(body) : null,
    };

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

      return data;
    } catch (error) {
      // If the request fails, check if we should retry
      if (retries < this.maxRetries && this.shouldRetry(error)) {
        // Calculate the delay before retrying
        const delay = this.initialDelayMs * Math.pow(2, retries);
        console.log(`Retrying... Attempt ${retries + 1}/${this.maxRetries} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(method, path, body, customHeaders, retries + 1);
      } else {
        // If we should not retry, handle the error
        this.handleError(error);
      }
    }

    return null;
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
    throw error; // Rethrow the error after logging it
  }

  /**
   * Makes a GET request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, string>} headers - Custom headers for the request.
   * @returns {Promise<RT>} The response data.
   */
  get<RT = any>(path: string, headers: Record<string, string> = {}): Promise<RT | null> {
    return this.request('GET', path, null, headers);
  }

  /**
   * Makes a POST request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request.
   * @returns {Promise<RT>} The response data.
   */
  post<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}): Promise<RT | null> {
    return this.request('POST', path, body, headers);
  }

  /**
   * Makes a PUT request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request.
   * @returns {Promise<RT>} The response data.
   */
  put<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}): Promise<RT | null> {
    return this.request('PUT', path, body, headers);
  }

  /**
   * Makes a PATCH request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, any>} body - The request body.
   * @param {Record<string, string>} headers - Custom headers for the request.
   * @returns {Promise<RT>} The response data.
   */
  patch<RT = any>(path: string, body: Record<string, any>, headers: Record<string, string> = {}): Promise<RT | null> {
    return this.request('PATCH', path, body, headers);
  }

  /**
   * Makes a DELETE request.
   * @param {string} path - The API endpoint path.
   * @param {Record<string, string>} headers - Custom headers for the request.
   * @returns {Promise<RT>} The response data.
   */
  delete<RT = any>(path: string, headers: Record<string, string> = {}): Promise<RT | null> {
    return this.request('DELETE', path, null, headers);
  }
}

/**
 * Base class for API errors.
 * @extends Error
 */
class ApiError extends Error {
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
class ApiResponseError extends ApiError {
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
class ApiParseError extends ApiError {
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
