# Proxy Scraper with NestJS

A robust proxy-based web scraping system built with NestJS, PostgreSQL, and TypeScript. This system manages a pool of proxies from a JSON file and rotates them to avoid detection while scraping websites.

## Features

- **Proxy Pool Management**: Loads and manages proxies from JSON files
- **Proxy Rotation**: Intelligent rotation mechanisms to distribute load
- **Proxy Validation**: Validates proxy connectivity and performance
- **Automatic Failover**: Handles proxy failures and retries with different proxies
- **Database Integration**: Stores proxy information and usage statistics in PostgreSQL
- **Scraping Service**: Comprehensive scraping functionality with automatic proxy selection

## Prerequisites

- Node.js >= 16
- PostgreSQL database (see Database Setup section)
- Free proxies JSON file (e.g., `free_proxies.json`)

## Installation

1. Clone the repository and navigate to the project directory
2. Install dependencies:

```bash
npm install
```

3. Set up your PostgreSQL database (see Database Setup section)
4. Configure environment variables in `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=proxy_scraper
PORT=3000
```

## Database Setup

You have two options to set up the PostgreSQL database:

### Option 1: Local PostgreSQL

Install PostgreSQL locally and create a database named `proxy_scraper`. Update the `.env` file with your local database credentials.

### Option 2: Docker (Recommended)

Use the provided Docker Compose file to run both the application and database:

```bash
docker-compose up -d
```

This will start both PostgreSQL and the proxy scraper application.

## Usage

### Running the Application

Start the application:

```bash
npm run start
```

The API will be available at `http://localhost:3000`

### Loading Proxies

Load proxies from your JSON file:

```bash
curl -X POST http://localhost:3000/proxies/load-from-json
```

### Getting a Random Proxy

Get a random active proxy:

```bash
curl http://localhost:3000/proxies/random
```

### Scraping with Proxy

Use the scraping service to make requests through proxies. You can also run the example script:

```bash
npm run start:dev
# Then run the example
npx ts-node example.ts
```

### API Endpoints

- `GET /proxies/random` - Get a random active proxy
- `GET /proxies/fresh` - Get a proxy not used recently
- `GET /proxies/:id/validate` - Validate a specific proxy
- `POST /proxies/load-from-json` - Load proxies from JSON file
- `GET /proxies/stats` - Get proxy pool statistics
- `GET /proxies/active` - Get all active proxies
- `POST /proxies/:id/mark-used` - Mark proxy as used
- `POST /proxies/:id/mark-success` - Mark proxy as successful
- `POST /proxies/:id/mark-failure` - Mark proxy as failed

## Architecture

- **Proxy Entity**: Database model for storing proxy information
- **Proxy Service**: Core logic for proxy management and validation
- **Proxy Rotation Service**: Handles proxy selection strategies
- **Scraping Service**: High-level scraping functionality with proxy integration
- **Proxy Controller**: REST API endpoints for proxy management

## Example Usage

The project includes an example script that demonstrates:

1. Loading proxies from the JSON file
2. Performing simple scrapes with proxy rotation
3. Scraping with custom headers
4. Scraping multiple URLs with automatic proxy selection

Run the example with:

```bash
npm run example
```

## Configuration

The system supports various configuration options:

- `maxRetries`: Number of retry attempts when a proxy fails
- `timeout`: Request timeout in milliseconds
- `successCodes`: HTTP status codes considered as successful
- `retryDelay`: Delay between retry attempts
- `failureThreshold`: Number of failures before disabling a proxy

## License

This project is licensed under the MIT License.