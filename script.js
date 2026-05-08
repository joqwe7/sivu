const WEATHER_API_URL = new URL("https://api.open-meteo.com/v1/forecast");

WEATHER_API_URL.search = new URLSearchParams({
    latitude: "62.2426",
    longitude: "25.7473",
    current: [
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "pressure_msl",
        "weather_code"
    ].join(","),
    daily: ["temperature_2m_max", "temperature_2m_min"].join(","),
    hourly: "visibility",
    timezone: "Europe/Helsinki",
    forecast_days: "1"
}).toString();

const weatherCodeLabels = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
};

function byId(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = byId(id);

    if (element) {
        element.textContent = value;
    }
}

function setVisible(id, isVisible) {
    const element = byId(id);

    if (element) {
        element.classList.toggle("is-hidden", !isVisible);
    }
}

function formatNumber(value, digits = 0) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return "--";
    }

    return value.toFixed(digits);
}

function formatUpdateTime(isoTime) {
    const date = isoTime ? new Date(isoTime) : new Date();

    return date.toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Helsinki"
    });
}

function closestHourlyVisibility(data) {
    const currentTime = data.current?.time;
    const hourlyTimes = data.hourly?.time;
    const hourlyVisibility = data.hourly?.visibility;

    if (!currentTime || !Array.isArray(hourlyTimes) || !Array.isArray(hourlyVisibility)) {
        return null;
    }

    const currentMs = new Date(currentTime).getTime();
    let closestIndex = 0;
    let closestDistance = Infinity;

    hourlyTimes.forEach((time, index) => {
        const distance = Math.abs(new Date(time).getTime() - currentMs);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });

    return hourlyVisibility[closestIndex] ?? null;
}

function showError(message) {
    const errorMessage = byId("error-message");

    if (!errorMessage) {
        return;
    }

    errorMessage.innerHTML = "";

    const errorBox = document.createElement("div");
    errorBox.className = "error";
    errorBox.textContent = message;
    errorMessage.appendChild(errorBox);
}

function clearError() {
    const errorMessage = byId("error-message");

    if (errorMessage) {
        errorMessage.textContent = "";
    }
}

function renderWeather(data) {
    const current = data.current;
    const daily = data.daily;
    const visibilityMeters = closestHourlyVisibility(data);
    const visibilityKm = typeof visibilityMeters === "number" ? visibilityMeters / 1000 : null;
    const weatherLabel = weatherCodeLabels[current.weather_code] || "Current weather";

    setVisible("loading", false);
    setVisible("weather-content", true);
    setVisible("weather-grid", true);

    setText("temperature", `${formatNumber(current.temperature_2m, 1)}°C`);
    setText("weather-condition", weatherLabel);
    setText("temp-max", `${formatNumber(daily.temperature_2m_max?.[0], 1)}°C`);
    setText("temp-min", `${formatNumber(daily.temperature_2m_min?.[0], 1)}°C`);
    setText("humidity", `${formatNumber(current.relative_humidity_2m)}%`);
    setText("wind-speed", `${formatNumber(current.wind_speed_10m, 1)} km/h`);
    setText("pressure", `${formatNumber(current.pressure_msl)} hPa`);
    setText("visibility", visibilityKm === null ? "-- km" : `${formatNumber(visibilityKm, 1)} km`);
    setText("update-time", `Updated: ${formatUpdateTime(current.time)}`);
}

async function fetchWeatherData() {
    setVisible("loading", true);
    setVisible("weather-content", false);
    setVisible("weather-grid", false);
    setText("update-time", "Loading current weather...");
    clearError();

    try {
        const response = await fetch(WEATHER_API_URL);

        if (!response.ok) {
            throw new Error(`Weather request failed with status ${response.status}.`);
        }

        const data = await response.json();

        if (!data.current || !data.daily) {
            throw new Error("Weather response did not include current and daily data.");
        }

        renderWeather(data);
    } catch (error) {
        console.error("Weather fetch failed:", error);
        setVisible("loading", false);
        setVisible("weather-content", true);
        setVisible("weather-grid", false);
        setText("temperature", "--°C");
        setText("weather-condition", "Weather data unavailable");
        setText("update-time", "Could not update weather");
        showError("Weather data could not be loaded right now. Check your internet connection and try again.");
    }
}

const refreshButton = byId("refresh-weather");

if (refreshButton) {
    refreshButton.addEventListener("click", fetchWeatherData);
    fetchWeatherData();
}
