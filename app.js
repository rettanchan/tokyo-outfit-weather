const TOKYO = {
  latitude: 35.6762,
  longitude: 139.6503,
  timezone: "Asia/Tokyo"
};

const API_URL = new URL("https://api.open-meteo.com/v1/forecast");
API_URL.search = new URLSearchParams({
  latitude: TOKYO.latitude,
  longitude: TOKYO.longitude,
  timezone: TOKYO.timezone,
  forecast_days: "1",
  current: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "showers",
    "weather_code",
    "cloud_cover",
    "wind_speed_10m",
    "is_day"
  ].join(","),
  hourly: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "wind_speed_10m"
  ].join(","),
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "precipitation_probability_max",
    "precipitation_sum",
    "wind_speed_10m_max"
  ].join(",")
});

const el = {
  location: document.querySelector("#location-label"),
  date: document.querySelector("#date-label"),
  condition: document.querySelector("#condition-label"),
  temp: document.querySelector("#current-temp"),
  range: document.querySelector("#range-label"),
  rain: document.querySelector("#rain-label"),
  feel: document.querySelector("#feel-label"),
  sky: document.querySelector("#sky-art"),
  updated: document.querySelector("#updated-label"),
  primaryTitle: document.querySelector("#primary-title"),
  primaryCopy: document.querySelector("#primary-copy"),
  rainTitle: document.querySelector("#rain-title"),
  rainCopy: document.querySelector("#rain-copy"),
  extraTitle: document.querySelector("#extra-title"),
  extraCopy: document.querySelector("#extra-copy"),
  morningTemp: document.querySelector("#morning-temp"),
  morningCopy: document.querySelector("#morning-copy"),
  dayTemp: document.querySelector("#day-temp"),
  dayCopy: document.querySelector("#day-copy"),
  nightTemp: document.querySelector("#night-temp"),
  nightCopy: document.querySelector("#night-copy"),
  shareButton: document.querySelector("#share-button")
};

const weatherText = {
  0: "快晴",
  1: "晴れ",
  2: "晴れ時々くもり",
  3: "くもり",
  45: "霧",
  48: "霧",
  51: "弱い霧雨",
  53: "霧雨",
  55: "強い霧雨",
  61: "小雨",
  63: "雨",
  65: "強い雨",
  66: "冷たい雨",
  67: "冷たい雨",
  71: "弱い雪",
  73: "雪",
  75: "強い雪",
  80: "にわか雨",
  81: "にわか雨",
  82: "強いにわか雨",
  95: "雷雨",
  96: "雷雨",
  99: "強い雷雨"
};

const fallback = {
  current: {
    time: new Date().toISOString(),
    temperature_2m: 20,
    apparent_temperature: 20,
    precipitation: 0,
    weather_code: 2,
    wind_speed_10m: 10,
    is_day: 1
  },
  hourly: {
    time: [],
    temperature_2m: [],
    apparent_temperature: [],
    precipitation_probability: [],
    precipitation: [],
    weather_code: [],
    wind_speed_10m: []
  },
  daily: {
    time: [new Date().toISOString().slice(0, 10)],
    weather_code: [2],
    temperature_2m_max: [24],
    temperature_2m_min: [15],
    apparent_temperature_max: [24],
    apparent_temperature_min: [15],
    precipitation_probability_max: [30],
    precipitation_sum: [0],
    wind_speed_10m_max: [14]
  }
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

init();

async function init() {
  const data = await fetchWeather();
  render(data);
}

async function fetchWeather() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const data = await response.json();
    localStorage.setItem("tokyo-weather-cache", JSON.stringify({ savedAt: Date.now(), data }));
    return data;
  } catch {
    const cached = localStorage.getItem("tokyo-weather-cache");
    if (cached) return JSON.parse(cached).data;
    return fallback;
  }
}

function render(data) {
  const current = data.current || fallback.current;
  const daily = normalizeDaily(data.daily);
  const hours = normalizeHours(data.hourly);
  const now = new Date(current.time || Date.now());
  const feels = round(current.apparent_temperature ?? current.temperature_2m);
  const temp = round(current.temperature_2m ?? feels);
  const condition = weatherText[current.weather_code] || weatherText[daily.code] || "天気";
  const outfit = getOutfit({
    temp: feels,
    max: daily.max,
    min: daily.min,
    rainProbability: daily.rainProbability,
    rainSum: daily.rainSum,
    wind: current.wind_speed_10m ?? daily.wind,
    code: current.weather_code ?? daily.code
  });

  el.location.textContent = "Tokyo · Live forecast";
  el.date.textContent = formatDate(now);
  el.condition.textContent = condition;
  el.temp.textContent = temp;
  el.range.textContent = `${round(daily.max)}℃ / ${round(daily.min)}℃`;
  el.rain.textContent = `${round(daily.rainProbability)}%`;
  el.feel.textContent = `${feels}℃`;
  el.primaryTitle.textContent = outfit.title;
  el.primaryCopy.textContent = outfit.copy;
  el.rainTitle.textContent = outfit.rainTitle;
  el.rainCopy.textContent = outfit.rainCopy;
  el.extraTitle.textContent = outfit.extraTitle;
  el.extraCopy.textContent = outfit.extraCopy;
  el.updated.textContent = `更新: ${formatTime(now)} · Open-Meteo予報`;

  el.sky.dataset.weather = getSkyType(current.weather_code ?? daily.code, current.is_day);

  renderTimeline(hours, daily);
  setupShare({ condition, temp, outfit });
}

function normalizeDaily(daily = fallback.daily) {
  return {
    date: daily.time?.[0],
    code: daily.weather_code?.[0],
    max: daily.temperature_2m_max?.[0],
    min: daily.temperature_2m_min?.[0],
    apparentMax: daily.apparent_temperature_max?.[0],
    apparentMin: daily.apparent_temperature_min?.[0],
    rainProbability: daily.precipitation_probability_max?.[0] ?? 0,
    rainSum: daily.precipitation_sum?.[0] ?? 0,
    wind: daily.wind_speed_10m_max?.[0] ?? 0
  };
}

function normalizeHours(hourly = fallback.hourly) {
  return (hourly.time || []).map((time, index) => ({
    time,
    hour: new Date(time).getHours(),
    temp: hourly.temperature_2m?.[index],
    apparent: hourly.apparent_temperature?.[index],
    rainProbability: hourly.precipitation_probability?.[index] ?? 0,
    precipitation: hourly.precipitation?.[index] ?? 0,
    code: hourly.weather_code?.[index],
    wind: hourly.wind_speed_10m?.[index] ?? 0
  }));
}

function getOutfit({ temp, max, min, rainProbability, rainSum, wind, code }) {
  const rainy = rainProbability >= 50 || rainSum >= 1 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  const maybeRain = !rainy && rainProbability >= 30;
  const gap = Math.abs((max ?? temp) - (min ?? temp));
  const windy = wind >= 24;

  let title = "長袖 + 軽い羽織り";
  let copy = "暑すぎず寒すぎない体感です。ロンTやシャツに、脱ぎ着しやすいカーディガンや薄手ジャケットが合います。";

  if (temp >= 30) {
    title = "涼しい半袖 + 日差し対策";
    copy = "かなり暑く感じます。通気性のいい半袖、薄手ボトム、帽子や日焼け止めを優先してください。";
  } else if (temp >= 26) {
    title = "半袖 + 薄い羽織り";
    copy = "日中は軽装で十分です。冷房や夜の移動に備えて、薄いシャツやカーディガンがあると快適です。";
  } else if (temp >= 22) {
    title = "薄手の長袖か半袖 + 羽織り";
    copy = "歩くと少し暖かい体感です。薄手の長袖を基本に、暑がりなら半袖へ軽い羽織りを足すのがちょうどいいです。";
  } else if (temp >= 18) {
    title = "長袖 + カーディガン";
    copy = "過ごしやすいけれど、日陰や夕方は少し涼しくなります。長袖に軽い羽織りで調整しやすく。";
  } else if (temp >= 14) {
    title = "スウェット + 薄手アウター";
    copy = "肌寒さがあります。厚めの長袖やスウェットに、トレンチやライトジャケットを重ねると安心です。";
  } else if (temp >= 10) {
    title = "ニット + コート";
    copy = "冷えやすい体感です。ニットや厚手トップスにコート、首元の防寒もあると楽です。";
  } else {
    title = "冬コート + 防寒小物";
    copy = "しっかり寒いです。冬用コート、マフラー、暖かいインナーまで入れてください。";
  }

  const rainTitle = rainy ? "傘と濡れにくい靴" : maybeRain ? "折りたたみ傘" : "雨具は軽めでOK";
  const rainCopy = rainy
    ? `雨の可能性が高めです。降水確率${round(rainProbability)}%なので、傘と滑りにくい靴を選ぶと動きやすいです。`
    : maybeRain
      ? `降水確率${round(rainProbability)}%。小さめの折りたたみ傘をバッグに入れておくと安心です。`
      : `降水確率${round(rainProbability)}%。大きな傘は不要そうですが、長時間外なら小さい雨具だけあると安心です。`;

  const extraTitle = windy ? "風を通しにくい羽織り" : gap >= 8 ? "脱ぎ着しやすさ重視" : "身軽な持ち物";
  const extraCopy = windy
    ? `風がやや強めです。軽い服でも、風を通しにくいアウターを選ぶと体感が安定します。`
    : gap >= 8
      ? `朝晩と日中の差が大きい日です。前開きの羽織りでこまめに調整できる服装が向いています。`
      : "大きな寒暖差は控えめです。必要な持ち物を絞って、歩きやすさを優先して大丈夫です。";

  return { title, copy, rainTitle, rainCopy, extraTitle, extraCopy };
}

function renderTimeline(hours, daily) {
  const slots = [
    { key: "morning", label: "朝", start: 6, end: 10, tempEl: el.morningTemp, copyEl: el.morningCopy },
    { key: "day", label: "昼", start: 11, end: 16, tempEl: el.dayTemp, copyEl: el.dayCopy },
    { key: "night", label: "夜", start: 18, end: 23, tempEl: el.nightTemp, copyEl: el.nightCopy }
  ];

  slots.forEach((slot) => {
    const slice = hours.filter((hour) => hour.hour >= slot.start && hour.hour <= slot.end);
    const temps = slice.map((hour) => hour.apparent ?? hour.temp).filter(Number.isFinite);
    const rains = slice.map((hour) => hour.rainProbability ?? 0);
    const codes = slice.map((hour) => hour.code).filter(Number.isFinite);
    const average = temps.length ? temps.reduce((sum, value) => sum + value, 0) / temps.length : null;
    const rain = rains.length ? Math.max(...rains) : daily.rainProbability;
    const code = codes[0] ?? daily.code;

    slot.tempEl.textContent = average === null ? `${round(daily.min)}-${round(daily.max)}℃` : `${round(average)}℃`;
    slot.copyEl.textContent = timelineCopy(average ?? (daily.min + daily.max) / 2, rain, code);
  });
}

function timelineCopy(temp, rain, code) {
  if (rain >= 50 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return "雨具を手元に。";
  if (temp >= 26) return "軽装で涼しく。";
  if (temp >= 22) return "薄手で快適。";
  if (temp >= 18) return "羽織りで調整。";
  if (temp >= 14) return "少し暖かめに。";
  return "しっかり防寒。";
}

function getSkyType(code, isDay) {
  if (!isDay) return "night";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  if ([2, 3, 45, 48].includes(code)) return "cloud";
  return "sun";
}

function setupShare({ condition, temp, outfit }) {
  el.shareButton?.addEventListener("click", async () => {
    const shareData = {
      title: "東京の天気と服装",
      text: `東京はいま${condition}、${temp}℃。${outfit.title}がおすすめ。`,
      url: location.href
    };

    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
      return;
    }

    await navigator.clipboard?.writeText(shareData.text).catch(() => {});
    el.shareButton.setAttribute("aria-label", "服装メモをコピーしました");
    setTimeout(() => el.shareButton.setAttribute("aria-label", "共有"), 1400);
  }, { once: true });
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO.timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO.timezone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function round(value) {
  return Math.round(Number(value) || 0);
}
