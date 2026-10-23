const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#city-search");
const locationButton = document.querySelector("#location-button");
const statusMessage = document.querySelector("#status-message");
const hourlyForecast = document.querySelector("#hourly-forecast");
const dailyForecast = document.querySelector("#daily-forecast");
const unitButtons = [...document.querySelectorAll(".unit-button")];

const state = {
  unit: "celsius",
  place: null,
  requestId: 0
};

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Heavy thunderstorm"
};

function describeWeather(code) {
  return weatherDescriptions[code] || "Variable conditions";
}

function weatherIcon(code, isDay = true, className = "") {
  const classAttribute = className ? ` class="${className}"` : "";
  const sun = `<circle cx="45" cy="43" r="16" fill="#FFD271"/><g stroke="#FFD271" stroke-width="3" stroke-linecap="round"><path d="M45 17v-6M45 75v-6M19 43h-6M77 43h-6M27 25l-4-4M67 65l-4-4M63 25l4-4M23 65l4-4"/></g>`;
  const moon = `<path d="M59 19a22 22 0 0 0 24 28 25 25 0 1 1-24-28Z" fill="#D6D9FF"/>`;
  const cloud = `<path d="M28 69h40a15 15 0 0 0 1-30 24 24 0 0 0-45 7 12 12 0 0 0 4 23Z" fill="url(#cloudFill)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  let detail = "";

  if (code === 0 || code === 1) {
    detail = isDay ? sun : moon;
  } else if (code === 2) {
    detail = `${isDay ? sun : moon}<path d="M28 75h42a13 13 0 0 0 1-26 22 22 0 0 0-42 6 10 10 0 0 0-1 20Z" fill="url(#cloudFill)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  } else if (code === 3 || (code >= 45 && code <= 48)) {
    detail = `<path d="M24 68h47a15 15 0 0 0 1-30 25 25 0 0 0-48 7 12 12 0 0 0 0 23Z" fill="url(#cloudFill)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
  } else if (code >= 71 && code <= 86) {
    detail = `${cloud}<g fill="#CDE9FF"><circle cx="39" cy="81" r="3"/><circle cx="54" cy="84" r="3"/><circle cx="67" cy="80" r="3"/></g>`;
  } else if (code >= 95) {
    detail = `${cloud}<path d="m51 66-9 14h9l-4 11 15-18h-10l5-7" fill="#FFD271" stroke="#FFD271" stroke-width="2" stroke-linejoin="round"/>`;
  } else {
    detail = `${cloud}<g stroke="#A9D9FF" stroke-width="4" stroke-linecap="round"><path d="m39 77-4 9M55 77l-4 9M70 77l-4 9"/></g>`;
  }

  return `<svg${classAttribute} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="cloudFill" x1="28" y1="34" x2="69" y2="77" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset="1" stop-color="#DCE7FF"/></linearGradient></defs>${detail}</svg>`;
}

function formatTime(value, timeZone) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function formatHour(value, timeZone) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    timeZone
  }).format(new Date(value));
}

function formatDay(value, timeZone) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone
  }).format(new Date(`${value}T12:00:00`));
}

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
  statusMessage.hidden = false;
}

function clearStatus() {
  statusMessage.hidden = true;
  statusMessage.classList.remove("is-error");
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }

  return data;
}

function locationLabel(place) {
  return [place.admin1, place.country].filter(Boolean).join(", ");
}

async function searchCity(query) {
  const requestId = ++state.requestId;
  setLoading(true);
  clearStatus();

  try {
    const data = await getJson(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (requestId !== state.requestId) return;

    if (!data.locations.length) {
      showStatus(`We couldn’t find “${query}”. Check the spelling or try another city.`, true);
      return;
    }

    await loadPlace(data.locations[0], requestId);
  } catch (error) {
    if (requestId === state.requestId) showStatus(error.message, true);
  } finally {
    if (requestId === state.requestId) setLoading(false);
  }
}

async function loadPlace(place, requestId = ++state.requestId) {
  state.place = place;
  searchInput.value = place.name;
  setLoading(true);
  clearStatus();

  try {
    const params = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      unit: state.unit
    });
    const data = await getJson(`/api/weather?${params}`);
    if (requestId !== state.requestId) return;

    renderWeather(data, place);
    document.title = `${place.name} Weather — Skyline`;
  } catch (error) {
    if (requestId === state.requestId) showStatus(error.message, true);
  } finally {
    if (requestId === state.requestId) setLoading(false);
  }
}

function renderWeather(data, place) {
  const { current, current_units: currentUnits, daily, hourly } = data;
  const timeZone = data.timezone || "UTC";
  const unitSymbol = currentUnits.temperature_2m;
  const now = new Date();
  const localHour = Number(
    new Intl.DateTimeFormat("en", { hour: "2-digit", hourCycle: "h23", timeZone })
      .format(now)
  );

  document.querySelector("#city-name").textContent = place.name;
  document.querySelector("#city-region").textContent = locationLabel(place) || "Local forecast";
  document.querySelector("#weather-description").textContent = describeWeather(current.weather_code);
  document.querySelector("#current-temperature").innerHTML =
    `${Math.round(current.temperature_2m)}<span>°</span>`;
  document.querySelector("#feels-like").textContent =
    `Feels like ${Math.round(current.apparent_temperature)}${unitSymbol}`;
  document.querySelector("#weather-art").innerHTML =
    weatherIcon(current.weather_code, current.is_day === 1);
  document.querySelector("#humidity").innerHTML =
    `${Math.round(current.relative_humidity_2m)}<span>%</span>`;
  document.querySelector("#wind-speed").innerHTML =
    `${Math.round(current.wind_speed_10m)}<span> ${currentUnits.wind_speed_10m}</span>`;
  document.querySelector("#precipitation").innerHTML =
    `${Number(current.precipitation).toFixed(1)}<span> ${currentUnits.precipitation}</span>`;
  document.querySelector("#uv-index").textContent = Math.round(daily.uv_index_max[0]);
  document.querySelector("#uv-caption").textContent = uvDescription(daily.uv_index_max[0]);
  document.querySelector("#sunrise").textContent = formatTime(daily.sunrise[0], timeZone);
  document.querySelector("#sunset").textContent = formatTime(daily.sunset[0], timeZone);
  document.querySelector("#timezone-label").textContent = timeZone.replaceAll("_", " ").toUpperCase();
  document.querySelector("#today-label").textContent =
    new Intl.DateTimeFormat("en", { weekday: "long", timeZone }).format(now).toUpperCase();
  document.querySelector("#updated-label").lastElementChild.textContent =
    `Updated ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(now)}`;

  renderHourly(hourly, current, timeZone, localHour);
  renderDaily(daily, timeZone);
}

function uvDescription(value) {
  if (value < 3) return "Low for today";
  if (value < 6) return "Moderate for today";
  if (value < 8) return "High for today";
  if (value < 11) return "Very high today";
  return "Extreme for today";
}

function renderHourly(hourly, current, timeZone, localHour) {
  const currentHourIndex = hourly.time.findIndex((time) =>
    new Intl.DateTimeFormat("en", { hour: "2-digit", hourCycle: "h23", timeZone })
      .format(new Date(time)).startsWith(String(localHour).padStart(2, "0"))
  );
  const startIndex = currentHourIndex >= 0 ? currentHourIndex : 0;

  hourlyForecast.innerHTML = Array.from({ length: 8 }, (_, offset) => {
    const index = (startIndex + offset) % hourly.time.length;
    const time = hourly.time[index];
    const isNow = offset === 0;
    const temperature = isNow ? current.temperature_2m : hourly.temperature_2m[index];
    const code = isNow ? current.weather_code : hourly.weather_code[index];

    return `
      <article class="hourly-item${isNow ? " is-now" : ""}">
        <span class="hour-time">${isNow ? "Now" : formatHour(time, timeZone)}</span>
        ${weatherIcon(code, true, "hour-icon")}
        <span class="hour-temperature">${Math.round(temperature)}°</span>
      </article>
    `;
  }).join("");
}

function renderDaily(daily, timeZone) {
  const lows = daily.temperature_2m_min;
  const highs = daily.temperature_2m_max;
  const lowLimit = Math.min(...lows);
  const highLimit = Math.max(...highs);
  const spread = Math.max(highLimit - lowLimit, 1);

  dailyForecast.innerHTML = daily.time.map((date, index) => {
    const width = Math.max(17, ((highs[index] - lows[index]) / spread) * 100);
    const name = index === 0 ? "Today" : formatDay(date, timeZone);

    return `
      <article class="daily-item">
        <span class="day-name">${name}<small>${formatDate(date, timeZone)}</small></span>
        <span class="day-condition">
          ${weatherIcon(daily.weather_code[index], true, "day-icon")}
          ${describeWeather(daily.weather_code[index])}
        </span>
        <span class="temperature-range">
          <span class="high">${Math.round(highs[index])}°</span>
          <span class="range-track"><span style="width:${width}%"></span></span>
          <span class="low">${Math.round(lows[index])}°</span>
        </span>
        <span class="rain-chance"><span>↘</span>${Math.round(daily.precipitation_probability_max[index] || 0)}%</span>
      </article>
    `;
  }).join("");
}

function formatDate(value, timeZone) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone
  }).format(new Date(`${value}T12:00:00`));
}

function setLoading(isLoading) {
  document.querySelector("#current-card").classList.toggle("is-loading", isLoading);
  document.querySelector(".details-panel").classList.toggle("is-loading", isLoading);
  hourlyForecast.classList.toggle("is-loading", isLoading);
  dailyForecast.classList.toggle("is-loading", isLoading);
  searchForm.querySelector("button").disabled = isLoading;
  locationButton.disabled = isLoading;
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.length >= 2) searchCity(query);
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Your browser doesn’t support location access. Search for a city instead.", true);
    return;
  }

  clearStatus();
  setLoading(true);
  const requestId = ++state.requestId;
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      if (requestId !== state.requestId) return;

      try {
        const data = await getJson(`/api/geocode?q=${coords.latitude},${coords.longitude}`);
        if (requestId !== state.requestId) return;
        const closest = data.locations[0];
        if (closest) {
          await loadPlace(closest, requestId);
        } else {
          await loadPlace({
            name: "Your location",
            country: "",
            latitude: coords.latitude,
            longitude: coords.longitude
          }, requestId);
        }
      } catch (error) {
        if (requestId === state.requestId) showStatus(error.message, true);
      } finally {
        if (requestId === state.requestId) setLoading(false);
      }
    },
    (error) => {
      if (requestId !== state.requestId) return;
      setLoading(false);
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access was denied. Search for a city instead."
        : "We couldn’t get your location. Please try again or search for a city.";
      showStatus(message, true);
    },
    { timeout: 10000, maximumAge: 300000 }
  );
});

unitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const unit = button.dataset.unit;
    if (unit === state.unit) return;

    state.unit = unit;
    unitButtons.forEach((unitButton) => {
      const isActive = unitButton === button;
      unitButton.classList.toggle("is-active", isActive);
      unitButton.setAttribute("aria-pressed", String(isActive));
    });

    if (state.place) loadPlace(state.place);
  });
});

searchInput.value = "London";
searchCity("London");
