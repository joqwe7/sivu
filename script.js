const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast?latitude=62.2426&longitude=25.7473&current=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code&daily=temperature_2m_max,temperature_2m_min&hourly=visibility&timezone=Europe%2FHelsinki&forecast_days=1";
const WTTR_URL = "https://wttr.in/Jyvaskyla?format=j1";

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

function formatNumber(value, digits) {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return "--";
    }

    return number.toFixed(digits);
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
    const currentTime = data.current && data.current.time;
    const hourlyTimes = data.hourly && data.hourly.time;
    const hourlyVisibility = data.hourly && data.hourly.visibility;

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

    return hourlyVisibility[closestIndex] == null ? null : hourlyVisibility[closestIndex];
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

async function fetchJson(url) {
    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
}

function normalizeOpenMeteo(data) {
    if (!data.current || !data.daily) {
        throw new Error("Open-Meteo response is missing weather data");
    }

    const current = data.current;
    const daily = data.daily;
    const visibilityMeters = closestHourlyVisibility(data);
    const visibilityKm = typeof visibilityMeters === "number" ? visibilityMeters / 1000 : null;

    return {
        source: "Open-Meteo",
        time: current.time,
        temperature: current.temperature_2m,
        condition: weatherCodeLabels[current.weather_code] || "Current weather",
        tempMax: daily.temperature_2m_max && daily.temperature_2m_max[0],
        tempMin: daily.temperature_2m_min && daily.temperature_2m_min[0],
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        pressure: current.pressure_msl,
        visibilityKm
    };
}

function normalizeWttr(data) {
    const current = data.current_condition && data.current_condition[0];
    const today = data.weather && data.weather[0];

    if (!current || !today) {
        throw new Error("wttr.in response is missing weather data");
    }

    const condition = current.weatherDesc && current.weatherDesc[0] && current.weatherDesc[0].value;

    return {
        source: "wttr.in",
        time: null,
        temperature: current.temp_C,
        condition: condition || "Current weather",
        tempMax: today.maxtempC,
        tempMin: today.mintempC,
        humidity: current.humidity,
        windSpeed: current.windspeedKmph,
        pressure: current.pressure,
        visibilityKm: current.visibility
    };
}

function renderWeather(weather) {
    setVisible("loading", false);
    setVisible("weather-content", true);
    setVisible("weather-grid", true);

    setText("temperature", `${formatNumber(weather.temperature, 1)}°C`);
    setText("weather-condition", weather.condition);
    setText("temp-max", `${formatNumber(weather.tempMax, 1)}°C`);
    setText("temp-min", `${formatNumber(weather.tempMin, 1)}°C`);
    setText("humidity", `${formatNumber(weather.humidity, 0)}%`);
    setText("wind-speed", `${formatNumber(weather.windSpeed, 1)} km/h`);
    setText("pressure", `${formatNumber(weather.pressure, 0)} hPa`);
    setText("visibility", `${formatNumber(weather.visibilityKm, 1)} km`);
    setText("update-time", `Updated: ${formatUpdateTime(weather.time)} (${weather.source})`);
}

async function getWeather() {
    const openMeteoErrors = [];

    try {
        return normalizeOpenMeteo(await fetchJson(OPEN_METEO_URL));
    } catch (error) {
        openMeteoErrors.push(error.message);
    }

    try {
        return normalizeWttr(await fetchJson(WTTR_URL));
    } catch (error) {
        throw new Error(`Open-Meteo: ${openMeteoErrors[0]}. wttr.in: ${error.message}.`);
    }
}

async function fetchWeatherData() {
    setVisible("loading", true);
    setVisible("weather-content", false);
    setVisible("weather-grid", false);
    setText("update-time", "Loading...");
    clearError();

    try {
        renderWeather(await getWeather());
    } catch (error) {
        console.error("Weather fetch failed:", error);
        setVisible("loading", false);
        setVisible("weather-content", true);
        setVisible("weather-grid", false);
        setText("temperature", "--°C");
        setText("weather-condition", "Weather data unavailable");
        setText("update-time", "Could not update weather");
        showError(`Weather data could not be loaded. ${error.message}`);
    }
}

const refreshButton = byId("refresh-weather");

if (refreshButton) {
    refreshButton.addEventListener("click", fetchWeatherData);
    fetchWeatherData();
}
