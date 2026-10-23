const express = require("express");
const path = require("node:path");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.join(__dirname, "public");
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

app.use(express.static(publicDirectory));

async function fetchOpenMeteo(url) {
  let response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    if (error.name === "TimeoutError") {
      throw Object.assign(new Error("The weather service took too long to respond."), {
        status: 504
      });
    }

    throw Object.assign(new Error("Unable to reach the weather service. Please try again."), {
      status: 502
    });
  }

  if (!response.ok) {
    throw Object.assign(new Error("The weather service is temporarily unavailable."), {
      status: 502
    });
  }

  return response.json();
}

app.get("/api/geocode", async (request, response, next) => {
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";

  if (query.length < 2 || query.length > 100) {
    return response.status(400).json({
      error: "Enter a city name between 2 and 100 characters."
    });
  }

  try {
    const url = new URL(OPEN_METEO_GEOCODING_URL);
    url.search = new URLSearchParams({
      name: query,
      count: "5",
      language: "en",
      format: "json"
    });

    const data = await fetchOpenMeteo(url);
    const locations = (data.results || []).map((place) => ({
      id: place.id,
      name: place.name,
      country: place.country,
      admin1: place.admin1 || "",
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone
    }));

    response.json({ locations });
  } catch (error) {
    next(error);
  }
});

app.get("/api/weather", async (request, response, next) => {
  const latitude = Number(request.query.latitude);
  const longitude = Number(request.query.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return response.status(400).json({
      error: "A valid latitude and longitude are required."
    });
  }

  try {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m"
      ].join(","),
      hourly: "temperature_2m,weather_code",
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "sunrise",
        "sunset",
        "precipitation_probability_max",
        "uv_index_max"
      ].join(","),
      temperature_unit: request.query.unit === "fahrenheit" ? "fahrenheit" : "celsius",
      wind_speed_unit: request.query.unit === "fahrenheit" ? "mph" : "kmh",
      precipitation_unit: "mm",
      timezone: "auto",
      forecast_days: "5"
    });

    const weather = await fetchOpenMeteo(url);
    response.json(weather);
  } catch (error) {
    next(error);
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status === 500) {
    console.error("Unexpected server error:", error);
  }

  response.status(status).json({
    error: status === 500 ? "Something went wrong. Please try again." : error.message
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Weather app running at http://localhost:${port}`);
  });
}

module.exports = app;
