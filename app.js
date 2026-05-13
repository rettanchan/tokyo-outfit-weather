const TOKYO = { latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" };
const state = { day: 0, data: null };
const $ = (id) => document.getElementById(id);
const els = {
  refresh: $("refresh"), date: $("date"), condition: $("condition"), temp: $("temp"),
  summary: $("summary"), range: $("range"), rain: $("rain"), feel: $("feel"), wind: $("wind"),
  title: $("advice-title"), copy: $("advice-copy"), items: $("items"), rainTitle: $("rain-title"),
  rainCopy: $("rain-copy"), extraCopy: $("extra-copy"), timeline: $("timeline"), updated: $("updated")
};
const weatherText = { 0:"快晴",1:"晴れ",2:"晴れ時々くもり",3:"くもり",45:"霧",48:"霧",51:"小雨",53:"小雨",55:"小雨",61:"雨",63:"雨",65:"強い雨",80:"にわか雨",81:"にわか雨",82:"強いにわか雨",95:"雷雨",96:"雷雨",99:"雷雨" };
const rainCodes = new Set([51,53,55,61,63,65,80,81,82,95,96,99]);

document.querySelectorAll("[data-day]").forEach((button) => {
  button.addEventListener("click", () => { state.day = Number(button.dataset.day); render(); });
});
els.refresh.addEventListener("click", loadWeather);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
loadWeather();

async function loadWeather() {
  els.refresh.disabled = true;
  els.updated.textContent = "更新中...";
  try {
    const params = new URLSearchParams({
      latitude: TOKYO.latitude, longitude: TOKYO.longitude, timezone: TOKYO.timezone, forecast_days: "2",
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
      hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max"
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error("weather request failed");
    state.data = await res.json();
    localStorage.setItem("tokyo-weather-cache-v3", JSON.stringify(state.data));
  } catch {
    state.data = JSON.parse(localStorage.getItem("tokyo-weather-cache-v3") || "null") || fallback();
  } finally {
    els.refresh.disabled = false;
    render();
  }
}

function render() {
  if (!state.data) return;
  document.querySelectorAll("[data-day]").forEach((button) => {
    const active = Number(button.dataset.day) === state.day;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const d = daily(state.day);
  const hours = hourly(d.date);
  const noon = hours.find((h) => h.hour === 12) || hours[0] || { temp: d.max, apparent: d.feelMax, code: d.code };
  const label = state.day === 0 ? "今日" : "明日";
  const advice = outfitAdvice(d, noon);
  els.date.textContent = `${label} ${formatDate(d.date)}`;
  els.condition.textContent = weatherText[d.code] || "天気";
  els.temp.textContent = round(state.day === 0 ? state.data.current?.temperature_2m ?? noon.temp : noon.temp);
  els.range.textContent = `${round(d.max)}° / ${round(d.min)}°`;
  els.rain.textContent = `${round(d.rainProbability)}%・${Number(d.rainSum).toFixed(1)}mm`;
  els.feel.textContent = `${round(noon.apparent ?? d.feelMax)}°`;
  els.wind.textContent = `${round(d.wind)}km/h`;
  els.summary.textContent = `${label}の東京は${weatherText[d.code] || "天気"}、最高${round(d.max)}°・最低${round(d.min)}°の予報です。${d.rainProbability >= 45 ? "雨対策も入れておくと安心です。" : "軽めの雨具で足りそうです。"}`;
  els.title.textContent = advice.title;
  els.copy.textContent = advice.copy;
  els.items.replaceChildren(...advice.items.map((text) => { const li = document.createElement("li"); li.textContent = text; return li; }));
  els.rainTitle.textContent = advice.rainTitle;
  els.rainCopy.textContent = advice.rainCopy;
  els.extraCopy.textContent = advice.extra;
  els.timeline.replaceChildren(...[8,12,18,21].map((hour) => renderHour(hours, hour, d)));
  els.updated.textContent = `更新: ${new Intl.DateTimeFormat("ja-JP", { hour:"2-digit", minute:"2-digit" }).format(new Date())}`;
}

function daily(i) {
  const d = state.data.daily;
  return { date:d.time[i], code:d.weather_code[i], max:d.temperature_2m_max[i], min:d.temperature_2m_min[i], feelMax:d.apparent_temperature_max[i], feelMin:d.apparent_temperature_min[i], rainProbability:d.precipitation_probability_max[i] ?? 0, rainSum:d.precipitation_sum[i] ?? 0, wind:d.wind_speed_10m_max[i] ?? 0 };
}
function hourly(date) {
  const h = state.data.hourly || {};
  return (h.time || []).map((time, i) => ({ time, hour:new Date(time).getHours(), temp:h.temperature_2m?.[i], apparent:h.apparent_temperature?.[i], rain:h.precipitation_probability?.[i] ?? 0, code:h.weather_code?.[i], wind:h.wind_speed_10m?.[i] ?? 0 })).filter((x) => x.time.startsWith(date));
}
function outfitAdvice(d, noon) {
  const temp = noon.apparent ?? d.feelMax ?? d.max;
  const rainy = d.rainProbability >= 45 || d.rainSum >= 1 || rainCodes.has(d.code);
  const windy = d.wind >= 24;
  let title, copy, items;
  if (temp >= 31) { title = "キャミソールやノースリーブで涼しく"; copy = "かなり暑い日。肌離れのよい素材で、キャミソールやショートパンツも取り入れやすいです。"; items = ["キャミソール + リネンシャツ", "ノースリーブ + ワイドパンツ", "ショートパンツ + サンダル"]; }
  else if (temp >= 27) { title = "半袖とショートパンツも快適"; copy = "夏らしい軽さが合う気温。キャミソール、半袖、ショート丈ボトムを使って涼しくまとめられます。"; items = ["半袖ブラウス", "キャミソール + 薄手シャツ", "ショートパンツ + スニーカー"]; }
  else if (temp >= 23) { title = "ブラウスやカットソーで軽やかに"; copy = "暖かく過ごしやすい日。フレアスカートやデニムに、軽い羽織りを足すと調整しやすいです。"; items = ["ブラウス + デニム", "カットソー + フレアスカート", "薄手カーディガン"]; }
  else if (temp >= 18) { title = "長袖トップスに羽織りを"; copy = "少し涼しさもある気温。長袖トップスにカーディガンやライトジャケットが安心です。"; items = ["長袖ブラウス", "カーディガン", "ライトジャケット"]; }
  else if (temp >= 13) { title = "ニットやスウェットが安心"; copy = "肌寒さを感じやすい日。薄手ニットやスウェットに、トレンチコートを合わせるのがおすすめです。"; items = ["薄手ニット", "スウェット + ロングスカート", "トレンチコート"]; }
  else { title = "コートでしっかり防寒"; copy = "冷え込みやすい日。厚手ニット、コート、タイツ、ブーツで暖かくしてください。"; items = ["厚手ニット + コート", "タイツ + スカート", "ショートブーツ"]; }
  return { title, copy, items, rainTitle: rainy ? "濡れにくい足元で" : "雨具は軽めでOK", rainCopy: rainy ? "撥水アウター、折りたたみ傘、濡れても歩きやすい靴が安心です。" : "雨の心配は少なめ。長く外にいる時だけ小さな雨具を。", extra: windy ? "風が強めなので、広がりやすいスカートよりパンツやタイトめのシルエットが快適です。" : "朝晩との差がある日は、脱ぎ着しやすい羽織りを一枚足すと安心です。" };
}
function renderHour(hours, hour, d) { const data = hours.find((h) => h.hour === hour) || { temp:(d.max+d.min)/2, rain:d.rainProbability, code:d.code }; const li = document.createElement("li"); li.innerHTML = `<span>${hour}時</span><strong>${round(data.temp)}°</strong><p>${weatherText[data.code] || "天気"} / ${round(data.rain)}%</p>`; return li; }
function fallback() { const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1); return { current:{ temperature_2m:22, apparent_temperature:22, weather_code:2, wind_speed_10m:8, is_day:1 }, daily:{ time:[iso(today), iso(tomorrow)], weather_code:[2,3], temperature_2m_max:[24,25], temperature_2m_min:[15,16], apparent_temperature_max:[24,25], apparent_temperature_min:[15,16], precipitation_probability_max:[20,30], precipitation_sum:[0,0], wind_speed_10m_max:[10,12] }, hourly:{ time:[], temperature_2m:[], apparent_temperature:[], precipitation_probability:[], weather_code:[], wind_speed_10m:[] } }; }
function iso(date) { return date.toISOString().slice(0, 10); }
function formatDate(value) { return new Intl.DateTimeFormat("ja-JP", { month:"long", day:"numeric", weekday:"short" }).format(new Date(value)); }
function round(value) { return Math.round(Number(value) || 0); }
