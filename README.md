# Better Fetch Client

A generic REST API client based on native JavaScript `fetch` with optional retry logic.

## Table of Contents

- [Better Fetch Client](#better-fetch-client)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Usage](#usage)
    - [Initialization](#initialization)
    - [Making Requests](#making-requests)
      - [GET Request](#get-request)
      - [POST Request](#post-request)
      - [PUT Request](#put-request)
      - [PATCH Request](#patch-request)
      - [DELETE Request](#delete-request)
    - [Handling Errors](#handling-errors)
    - [Cancelling Requests](#cancelling-requests)
  - [License](#license)

## Installation

To install the package, use npm:

```sh
npm install better-fetch-client
```

## Usage

### Initialization

To create an instance of `BetterFetchClient`, you need to provide the base URL for the API. You can also provide default headers, enable retry logic, set the maximum number of retry attempts, and set the initial delay before retrying.

```typescript
import BetterFetchClient from 'better-fetch-client';

const client = new BetterFetchClient({baseUrl: 'https://api.example.com'});
```

Configurable options:

- `baseUrl`: The base URL for the API.
- `headers`: Default headers for the requests.
- `withRetry`: Whether to enable retry logic.
- `maxRetries`: Maximum number of retry attempts.
- `initialDelayMs`: Initial delay in milliseconds before retrying.

For more details, refer to the constructor definition in the code

### Making Requests

#### GET Request

To make a GET request, use the `get` method:

```typescript
try {
  const { response } = await client.get('/endpoint');
  console.log(response);
} catch (error) {
  console.error(error);
}
```

#### POST Request

To make a POST request, use the `post` method:

```typescript
try {
  const { response } = await client.post('/endpoint', { key: 'value' });
  console.log(response);
} catch (error) {
  console.error(error);
}
```

#### PUT Request

To make a PUT request, use the `put` method:

```typescript
try {
  const { response } = await client.put('/endpoint', { key: 'value' });
  console.log(response);
} catch (error) {
  console.error(error);
}
```

#### PATCH Request

To make a PATCH request, use the `patch` method:

```typescript
try {
  const { response } = await client.patch('/endpoint', { key: 'value' });
  console.log(response);
} catch (error) {
  console.error(error);
}
```

#### DELETE Request

To make a DELETE request, use the `delete` method:

```typescript
try {
  const { response } = await client.delete('/endpoint');
  console.log(response);
} catch (error) {
  console.error(error);
}
```

### Handling Errors

Errors are handled by throwing instances of `ApiError`. You can catch these errors and handle them accordingly:

```typescript
try {
  const { response } = await client.get('/endpoint');
  console.log(response);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error: ${error.message}, Status: ${error.status}`);
  } else {
    console.error(error);
  }
}
```

### Cancelling Requests

You can cancel a request by its identifier using the `cancelRequest` method:

```typescript
const { requestId, response } = client.get('/endpoint');
client.cancelRequest(requestId);

/**
 * For usage where you want to be able to cancel the request, * the response would be awaited separately because requestId
 * is returned immeditately and response is a promise.
 */
const { requestId, response } = client.get('/endpoint');
const data = await response;
```

## License

This project is licensed under the 0BSD License. See the [LICENSE](./license.txt) file for details.
