# Skyline Weather

A responsive weather app built with JavaScript, Node.js, and Express. Search for cities around the world, check the current conditions and upcoming forecast, switch between Celsius and Fahrenheit, or use your device's location.

Weather and location search are powered by the free [Open-Meteo API](https://open-meteo.com/). No API key or account is required.

## Requirements

- Node.js 18 or newer
- npm

## Run locally

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). To use another port, set the `PORT` environment variable.

For automatic restarts during development, run `npm run dev`.

## Tests

```sh
npm test
```

## API routes

- `GET /api/geocode?q=<city>` searches for matching cities.
- `GET /api/weather?latitude=<lat>&longitude=<lon>&unit=<celsius|fahrenheit>` returns current conditions and a five-day forecast.

The Express server serves the browser app from `public/` and makes requests to Open-Meteo on its behalf.
