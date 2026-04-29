const TOKYO = {
  latitude: 35.6762,
  longitude: 139.6503,
  timezone: "Asia/Tokyo"
};

const PREFERENCE_KEY = "tokyo-outfit-preference";
const preferences = {
  hot: { label: "暑がり", offset: 2 },
  normal: { label: "普通", offset: 0 },
  cold: { label: "寒がり", offset: -2 }
};

let latestWeatherData = null;

const PRIMARY_API_URL = buildWeatherUrl("https://api.open-meteo.com/v1/jma", {
  current: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "weather_code",
    "cloud_cover",
    "wind_speed_10m",
    "is_day"
  ],
  hourly: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "weather_code",
    "wind_speed_10m"
  ],
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "precipitation_sum",
    "wind_speed_10m_max"
  ]
});

const PRECIP_API_URL = buildWeatherUrl("https://api.open-meteo.com/v1/forecast", {
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
  ],
  hourly: [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "wind_speed_10m"
  ],
  daily: [
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "precipitation_probability_max",
    "precipitation_sum",
    "wind_speed_10m_max"
  ]
});

function buildWeatherUrl(endpoint, variables) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
  latitude: TOKYO.latitude,
  longitude: TOKYO.longitude,
  timezone: TOKYO.timezone,
  forecast_days: "1",
  current: variables.current.join(","),
  hourly: variables.hourly.join(","),
  daily: variables.daily.join(",")
  });
  return url;
}

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
  outfitList: document.querySelector("#outfit-list"),
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
  shareButton: document.querySelector("#share-button"),
  preferenceButtons: [...document.querySelectorAll("[data-preference]")]
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
  setupPreference();
  const data = await fetchWeather();
  latestWeatherData = data;
  render(data);
}

async function fetchWeather() {
  try {
    const [primary, precip] = await Promise.all([
      fetchJson(PRIMARY_API_URL),
      fetchJson(PRECIP_API_URL).catch(() => null)
    ]);
    const data = mergeWeather(primary, precip);
    localStorage.setItem("tokyo-weather-cache", JSON.stringify({ savedAt: Date.now(), data }));
    return data;
  } catch {
    const cached = localStorage.getItem("tokyo-weather-cache");
    if (cached) return JSON.parse(cached).data;
    return fallback;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`weather ${response.status}`);
  return response.json();
}

function mergeWeather(primary, precip) {
  if (!precip) return { ...primary, source: "Open-Meteo JMA" };
  return {
    ...primary,
    source: "Open-Meteo JMA + Forecast",
    hourly: {
      ...primary.hourly,
      precipitation_probability: precip.hourly?.precipitation_probability || []
    },
    daily: {
      ...primary.daily,
      precipitation_probability_max: precip.daily?.precipitation_probability_max || [0]
    }
  };
}

function render(data) {
  const current = data.current || fallback.current;
  const daily = normalizeDaily(data.daily);
  const hours = normalizeHours(data.hourly);
  const now = new Date(current.time || Date.now());
  const feels = round(current.apparent_temperature ?? current.temperature_2m);
  const temp = round(current.temperature_2m ?? feels);
  const preference = getPreference();
  const condition = weatherText[current.weather_code] || weatherText[daily.code] || "天気";
  const outfit = getOutfit({
    temp: feels + preferences[preference].offset,
    actualFeels: feels,
    preference,
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
  renderOutfitList(outfit.items);
  el.rainTitle.textContent = outfit.rainTitle;
  el.rainCopy.textContent = outfit.rainCopy;
  el.extraTitle.textContent = outfit.extraTitle;
  el.extraCopy.textContent = outfit.extraCopy;
  el.updated.textContent = `更新: ${formatTime(now)} · ${data.source || "Open-Meteo"}予報`;

  el.sky.dataset.weather = getSkyType(current.weather_code ?? daily.code, current.is_day);

  renderTimeline(hours, daily, preferences[preference].offset);
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
  const outfitTemp = windy ? temp - 2 : temp;

  let title = "長袖を基本にした服装";
  let copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。長袖シャツやロンTを基本に、外にいる時間が長ければ薄手の羽織りを合わせると過ごしやすいです。`;
  let items = ["長袖シャツ", "ロンT", "半袖 + 薄手アウター"];

  if (outfitTemp >= 28) {
    title = "半袖1枚で涼しく";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。日中は暑さを感じやすいため、半袖1枚や通気性の良い服装が向いています。`;
    items = ["半袖Tシャツ + 薄手パンツ", "半袖シャツ + 軽いボトム", "ノースリーブ + 薄手シャツ"];
  } else if (outfitTemp >= 24) {
    title = "半袖 + 必要なら薄手の羽織り";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。日中は半袖で快適に過ごせます。朝晩や冷房が気になる場合は、薄手の羽織りがあると安心です。`;
    items = ["半袖Tシャツ", "半袖 + 薄手カーディガン", "半袖シャツ + 薄手パンツ"];
  } else if (outfitTemp >= 20) {
    title = "長袖シャツやロンT";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。日中は過ごしやすく、長袖シャツやロンTがちょうどよい気温です。暑がりの方は半袖に薄手アウターでも調整しやすいです。`;
    items = ["長袖シャツ", "ロンT", "半袖 + 薄手アウター"];
  } else if (outfitTemp >= 16) {
    title = "長袖 + ライトアウター";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。少し涼しさを感じるため、長袖に軽めのアウターを合わせるとちょうどよい一日です。`;
    items = ["長袖 + ライトアウター", "薄手ニット", "ロンT + ジャケット"];
  } else if (outfitTemp >= 12) {
    title = "ニットやスウェット";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。肌寒さがあるため、ニットやスウェットを中心に、外出時は軽めのコートを合わせると安心です。`;
    items = ["ニット + 軽めコート", "スウェット + ライトコート", "長袖インナー + ジャケット"];
  } else if (outfitTemp >= 8) {
    title = "コートや防寒アウター";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。冷え込みを感じやすいので、コートや防寒アウターを着て出かけるのがおすすめです。`;
    items = ["コート + ニット", "防寒アウター + スウェット", "厚手トップス + 暖かいパンツ"];
  } else {
    title = "冬用コートで防寒重視";
    copy = `今日は最高${round(max)}℃・最低${round(min)}℃です。しっかり寒い一日です。冬用コートに防寒インナーを合わせ、外にいる時間が長い場合は首元や手元も暖かくしてください。`;
    items = ["冬用コート + 防寒インナー", "ダウン + 厚手ニット", "コート + マフラー"];
  }

  const gapAdvice = gap >= 8
    ? "昼は暖かく、朝晩は羽織りがあると安心です。"
    : "寒暖差は大きすぎないため、基本の服装で過ごしやすい見込みです。";

  const rainTitle = rainy ? "傘と濡れにくい靴" : maybeRain ? "折りたたみ傘" : "雨具は軽めでOK";
  const rainCopy = rainy
    ? `雨が降りやすい予報です。傘を持ち、防水性のあるアウターや濡れにくい靴を選ぶと安心です。`
    : maybeRain
      ? `にわか雨の可能性があります。小さめの折りたたみ傘をバッグに入れておくと安心です。`
      : `雨の心配は比較的少なめです。長時間外にいる場合だけ、念のため小さな雨具があると安心です。`;

  const extraTitle = "一言アドバイス";
  const extraCopy = windy
    ? `${gapAdvice} 風が強めで体感温度が下がりやすいため、普段より一段階暖かめの服装がおすすめです。`
    : gap >= 8
      ? gapAdvice
      : rainy
        ? "服装は暖かさだけでなく、濡れにくさも意識すると快適です。靴やバッグの素材も確認しておくと安心です。"
        : "身軽な服装で過ごしやすい見込みです。外に長くいる場合は、薄手の羽織りを一枚足すと調整しやすいです。";

  return { title, copy, items, rainTitle, rainCopy, extraTitle, extraCopy };
}

function setupPreference() {
  updatePreferenceButtons(getPreference());
  el.preferenceButtons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const value = button.dataset.preference;
      if (!preferences[value]) return;
      localStorage.setItem(PREFERENCE_KEY, value);
      updatePreferenceButtons(value);
      if (latestWeatherData) render(latestWeatherData);
    });
  });
}

function getPreference() {
  const saved = localStorage.getItem(PREFERENCE_KEY);
  return preferences[saved] ? saved : "normal";
}

function updatePreferenceButtons(value) {
  el.preferenceButtons.forEach((button) => {
    const active = button.dataset.preference === value;
    button.setAttribute("aria-checked", String(active));
    button.classList.toggle("is-active", active);
  });
}

function renderOutfitList(items) {
  el.outfitList.replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    return li;
  }));
}

function renderTimeline(hours, daily, preferenceOffset = 0) {
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
    const clothingTemp = (average ?? (daily.min + daily.max) / 2) + preferenceOffset;
    slot.copyEl.textContent = timelineCopy(slot.label, clothingTemp, rain, code);
  });
}

function timelineCopy(label, temp, rain, code) {
  const rainy = rain >= 50 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  const rainNote = rainy ? " + 傘" : "";

  if (temp >= 28) return `${label}は半袖1枚${rainNote}`;
  if (temp >= 24) return `${label}は半袖 + 薄手の羽織り${rainNote}`;
  if (temp >= 20) return `${label}は長袖シャツかロンT${rainNote}`;
  if (temp >= 16) return `${label}は長袖 + ライトアウター${rainNote}`;
  if (temp >= 12) return `${label}はニットやスウェット${rainNote}`;
  if (temp >= 8) return `${label}はコートや防寒アウター${rainNote}`;
  return `${label}は冬用コートで防寒${rainNote}`;
}

function getSkyType(code, isDay) {
  if (!isDay) return "night";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) return "rain";
  if ([2, 3, 45, 48].includes(code)) return "cloud";
  return "sun";
}

function setupShare({ condition, temp, outfit }) {
  if (!el.shareButton) return;
  el.shareButton.onclick = async () => {
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
  };
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
