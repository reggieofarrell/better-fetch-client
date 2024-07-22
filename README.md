# Better Fetch Client

A generic REST API client based on native JavaScript `fetch` with optional retry logic. Issues and PRs welcome. I'm trying to keep this pretty basic though.

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
      - [Raw Response](#raw-response)
    - [Handling Errors](#handling-errors)
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

const client = new BetterFetchClient({ baseUrl: 'https://api.example.com', name: 'Example API Client' });
```

Configurable options:

- `baseUrl`: The base URL for the API.
- `headers`: Default headers for the requests.
- `withRetry`: Whether to enable retry logic.
- `maxRetries`: Maximum number of retry attempts.
- `initialDelayMs`: Initial delay in milliseconds before retrying.
- `name`: The name of the client (to be used in error messages, etc).

For more details, refer to the constructor definition in the code.

### Making Requests

#### GET Request

To make a GET request, use the `get` method:

```typescript
try {
  const { data } = await client.get('/endpoint');
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### POST Request

To make a POST request, use the `post` method:

```typescript
try {
  const { data } = await client.post('/endpoint', { key: 'value' });
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### PUT Request

To make a PUT request, use the `put` method:

```typescript
try {
  const { data } = await client.put('/endpoint', { key: 'value' });
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### PATCH Request

To make a PATCH request, use the `patch` method:

```typescript
try {
  const { data } = await client.patch('/endpoint', { key: 'value' });
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### DELETE Request

To make a DELETE request, use the `delete` method:

```typescript
try {
  const { data } = await client.delete('/endpoint');
  console.log(data);
} catch (error) {
  console.error(error);
}
```

#### Raw Response

All of the methods also return the raw reponse returned by `fetch`.

```typescript
try {
  const { rawResponse, data } = await client.get('/endpoint');
  console.log(rawResponse);
  console.log(data);
} catch (error) {
  console.error(error);
}
```

### Handling Errors

Errors are handled by throwing instances of `ApiError`. You can catch these errors and handle them accordingly:

```typescript
try {
  const { data } = await client.get('/endpoint');
  console.log(data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error: ${error.message}, Status: ${error.status}`);
  } else {
    console.error(error);
  }
}
```

## License

This project is licensed under the 0BSD License. See the [LICENSE](./license.txt) file for details.
