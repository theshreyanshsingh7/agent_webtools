# Browser APIs - Playwright Automation Server

A powerful web automation server built with Express.js, TypeScript, and Playwright that provides APIs for web searching, taking screenshots, and performing browser navigation actions.

## Features

- 🔍 Google Search API
- 📸 Website Screenshot API

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

3. Start the server:

```bash
npm start
```

For development:

```bash
npm run dev
```

## API Documentation

### 1. Search API

```http
GET /api/search?query=<search_term>
```

Performs a Google search and returns the top results.

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "title": "Result Title",
      "url": "https://example.com",
      "description": "Result description"
    }
  ]
}
```

### 2. Screenshot API

```http
GET /api/screenshot?url=<website_url>
```

Captures a full-page screenshot of the specified website.

**Response:** PNG image file

Performs browser navigation actions like clicking, typing, waiting, and form submissions.

**Request Body:**

```json
{
  "url": "https://example.com",
  "actions": [
    {
      "type": "click",
      "selector": "#submit-button"
    },
    {
      "type": "type",
      "selector": "#search-input",
      "text": "search query"
    },
    {
      "type": "wait",
      "selector": "#results",
      "timeout": 5000
    },
    {
      "type": "select",
      "selector": "#dropdown",
      "text": "option1"
    }
  ]
}
```

**Available Action Types:**

- `click`: Click on an element (requires selector)
- `type`: Enter text into an input field (requires selector and text)
- `navigate`: Go to a specific URL (requires url)
- `wait`: Wait for element or timeout (requires selector or timeout)
- `select`: Select an option from dropdown (requires selector and text)

**Response:**

```json
{
  "success": true,
  "currentUrl": "https://example.com/results",
  "title": "Page Title"
}
```

## Error Handling

All APIs return appropriate HTTP status codes and error messages:

- 400: Bad Request
  - Missing or invalid parameters
  - Invalid action types or missing required fields
- 500: Internal Server Error
  - Browser automation failures
  - Network issues
  - Server-side errors

## Technologies Used

- Express.js - Web framework
- TypeScript - Type-safe JavaScript
- Playwright - Browser automation
- Node.js - Runtime environment

## TODO

- [ ] Add support for other browsers (e.g., Firefox)
- [ ] Improve error handling for network issues
- [ ] Add more robust tests for API endpoints
- [ ] Implement rate limiting for API requests
- [ ] Add authentication for sensitive endpoints
- [ ] Optimize screenshot capture for performance
- [ ] Enhance navigation API with more action types
- [ ] Add support for headless mode in BING and DUCKDUCKGO search engines
