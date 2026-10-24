// ===== 1. 機場資料 =====
const AIRPORTS = {
  KNH: { name: '金門',     lng: 118.3592, lat: 24.4279 },
  TSA: { name: '台北松山', lng: 121.5525, lat: 25.0697 },
  RMQ: { name: '台中',     lng: 120.6208, lat: 24.2647 },
  CYI: { name: '嘉義',     lng: 120.3928, lat: 23.4618 },
  TNN: { name: '台南',     lng: 120.2057, lat: 22.9504 },
  KHH: { name: '高雄',     lng: 120.3500, lat: 22.5771 },
  MZG: { name: '澎湖馬公', lng: 119.6282, lat: 23.5687 },
};
const KNH = AIRPORTS.KNH;

// ===== 2. 建立地圖 =====
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [119.6, 23.9],
  zoom: 6.5
});

// 底圖載入完成後，才能加上自己的資料
map.on('load', () => {
  const codes = Object.keys(AIRPORTS);

  // ===== 3. 把機場轉成 GeoJSON 的「點」 =====
  const airportPoints = codes.map(code => ({
    type: 'Feature',
    properties: { code: code, name: AIRPORTS[code].name },
    geometry: { type: 'Point', coordinates: [AIRPORTS[code].lng, AIRPORTS[code].lat] }
  }));

  // ===== 4. 從金門連到其他機場的「線」 =====
  const routeLines = codes
    .filter(code => code !== 'KNH')
    .map(code => ({
      type: 'Feature',
      properties: { to: code },
      geometry: {
        type: 'LineString',
        coordinates: [[KNH.lng, KNH.lat], [AIRPORTS[code].lng, AIRPORTS[code].lat]]
      }
    }));

  // ===== 5. 加入資料來源 =====
  map.addSource('airports', { type: 'geojson', data: { type: 'FeatureCollection', features: airportPoints } });
  map.addSource('routes',   { type: 'geojson', data: { type: 'FeatureCollection', features: routeLines } });

  // ===== 6. 加入圖層（先畫線，點才會蓋在線上面） =====
  map.addLayer({
    id: 'routes', type: 'line', source: 'routes',
    paint: { 'line-color': '#a8236f', 'line-width': 1.5, 'line-dasharray': [2, 2] }
  });

  map.addLayer({
    id: 'airports', type: 'circle', source: 'airports',
    paint: {
      'circle-radius': 6,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#a8236f',
      'circle-stroke-width': 2.5
    }
  });

  map.addLayer({
    id: 'airport-labels', type: 'symbol', source: 'airports',
    layout: {
      'text-field': ['concat', ['get', 'name'], '\n', ['get', 'code']],
      'text-font': ['Noto Sans Regular'],
      'text-size': 13,
      'text-anchor': 'top',
      'text-offset': [0, 0.9]
    },
    paint: { 'text-color': '#1c2a31', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 }
  });

  // ===== 7. 點機場跳出名稱，滑鼠移上去變手指 =====
  map.on('click', 'airports', e => {
    const p = e.features[0].properties;
    new maplibregl.Popup().setLngLat(e.lngLat).setText(`${p.name} ${p.code}`).addTo(map);
  });
  map.on('mouseenter', 'airports', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'airports', () => map.getCanvas().style.cursor = '');
    startPlanes();
});
// ================= 第 4 步：飛機 =================

// 測試用：1 = 真實速度；改成 60 就是 1 秒等於 1 分鐘
const SPEED = 1;

// 台灣時間（從午夜算起的分鐘數），不管電腦設定在哪個時區都正確
function taipeiMinutes() {
  const now = new Date();
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  return (utc + 8 * 60) % 1440;
}
const startReal = Date.now();
const startSim = taipeiMinutes();
function simMinutes() {
  return (startSim + (Date.now() - startReal) / 60000 * SPEED) % 1440;
}

// 450.5 → "07:30:30"
function fmt(t) {
  const h = Math.floor(t / 60), m = Math.floor(t % 60), s = Math.floor((t * 60) % 60);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// 用 canvas 畫一架機頭朝上的小飛機，當作地圖圖示
function makePlaneIcon(color) {
  const size = 48, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.beginPath();
  g.moveTo(0, -20); g.lineTo(3, -6); g.lineTo(18, 4); g.lineTo(18, 8); g.lineTo(3, 3);
  g.lineTo(2, 14); g.lineTo(7, 19); g.lineTo(7, 21); g.lineTo(0, 18);
  g.lineTo(-7, 21); g.lineTo(-7, 19); g.lineTo(-2, 14); g.lineTo(-3, 3);
  g.lineTo(-18, 8); g.lineTo(-18, 4); g.lineTo(-3, -6); g.closePath();
  g.fillStyle = color; g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke();
  return g.getImageData(0, 0, size, size);
}

function startPlanes() {
  map.addImage('plane-B7', makePlaneIcon('#1f8a5b'), { pixelRatio: 2 }); // 立榮：綠
  map.addImage('plane-AE', makePlaneIcon('#2f5fb3'), { pixelRatio: 2 }); // 華信：藍

  map.addSource('planes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'planes', type: 'symbol', source: 'planes',
    layout: {
      'icon-image': ['concat', 'plane-', ['get', 'airline']],
      'icon-size': ['case', ['get', 'selected'], 1.5, 1],        // 選中的放大 1.5 倍
      'symbol-sort-key': ['case', ['get', 'selected'], 1, 0],     // 選中的畫在最上面
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'text-field': ['get', 'no'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1.2],
      'text-allow-overlap': true
    },
    paint: { 'text-color': '#1c2a31', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 }
  });

  tick();
}

// ================= 第 5 步：點擊、跟隨、看板 =================

FLIGHTS.forEach((f, i) => f.id = i);   // 每班飛機一個編號，點擊時用來辨認

let selectedId = null;    // 目前選中的航班
let following = false;    // 地圖要不要跟著它
let boardTab = 'dep';     // 看板顯示出發或抵達
let scrollPending = true; // 下次畫看板時，要不要自動捲到現在時間
let lastPanelUpdate = 0;

const AIRLINE_NAME = { B7: '立榮航空', AE: '華信航空' };
const hhmm = t => fmt(t).slice(0, 5);   // "07:30:00" → "07:30"

// 航班狀態：回傳 [文字, 顏色]。顏色用 CSS 變數，會跟著亮暗主題變
function flightStatus(f, t) {
  const arr = f.dep + f.dur;
  if (f.remark && f.remark.includes('取消')) return ['取消', 'var(--red)'];
  if (t > arr) return f.from === 'KNH' ? ['已起飛', 'var(--muted)'] : ['已抵達', 'var(--green)'];
  if (t >= f.dep) return ['飛行中', 'var(--accent)'];
  if (f.delay >= 5) return [`延誤 ${f.delay} 分`, 'var(--orange)'];
  if (f.remark && f.remark.includes('延')) return [f.remark, 'var(--orange)'];
  if (f.from === 'KNH' && t >= f.dep - 30) return ['登機中', 'var(--orange)'];
  return ['準時', 'var(--text)'];
}

function selectFlight(id) {
  selectedId = id;
  following = true;
  updateInfo(simMinutes());
  renderBoard(simMinutes());
}

// 上方資訊卡
function updateInfo(t) {
  const box = document.getElementById('info');
  if (selectedId === null) {
    box.innerHTML = '點地圖上的飛機，或點下方的班次。';
    return;
  }
  const f = FLIGHTS[selectedId];
  const p = Math.min(1, Math.max(0, (t - f.dep) / f.dur));
  const [st, color] = flightStatus(f, t);
  const left = Math.ceil(f.dep + f.dur - t);
  box.innerHTML = `
    <div style="font-size:20px;font-weight:bold">${f.no}</div>
    <div style="color:var(--muted)">${AIRLINE_NAME[f.airline]}</div>
    <div style="margin:10px 0">${AIRPORTS[f.from].name} ${hhmm(f.dep)} → ${AIRPORTS[f.to].name} ${hhmm(f.dep + f.dur)}</div>
    <div style="height:6px;background:var(--line);border-radius:3px">
      <div style="width:${p * 100}%;height:100%;background:var(--accent);border-radius:3px"></div>
    </div>
    <div style="margin-top:8px;color:${color}">${st}${p > 0 && p < 1 ? `，還有 ${left} 分鐘抵達` : ''}</div>
    <button id="followBtn">${following ? '停止跟隨' : '跟隨這架'}</button>`;
  document.getElementById('followBtn').onclick = () => {
    following = !following;
    updateInfo(simMinutes());
  };
}

// 下方看板
function renderBoard(t) {
  const board = document.getElementById('board');
  const isDep = boardTab === 'dep';
  const timeOf = f => isDep ? f.dep : f.dep + f.dur;   // 最新的時間（含延誤）

  const list = FLIGHTS
    .filter(f => isDep ? f.from === 'KNH' : f.to === 'KNH')
    .sort((a, b) => (a.sched ?? timeOf(a)) - (b.sched ?? timeOf(b)));   // 照表定時間排

  board.innerHTML = list.map(f => {
    const other = isDep ? f.to : f.from;
    const [st, color] = flightStatus(f, t);
    const now = timeOf(f);
    const sched = f.sched ?? now;
    const changed = Math.abs(now - sched) >= 5 && st !== '取消';   // 時間改了 5 分鐘以上
    const past = now < t - 15 && st !== '飛行中';
    return `<div class="row ${past ? 'past' : ''}" data-id="${f.id}" data-time="${now}">
      <span>${hhmm(now)}${changed ? `<small class="old">${hhmm(sched)}</small>` : ''}</span>
      <span>${f.no}</span>
      <span>${AIRPORTS[other].name}</span>
      <span class="status" style="color:${color}">${st}</span>
    </div>`;
  }).join('');

  // 自動捲到「15 分鐘前」之後的第一班
  if (scrollPending) {
    const rows = [...board.querySelectorAll('.row')];
    const target = rows.find(r => Number(r.dataset.time) >= t - 15);
    board.scrollTop = target ? target.offsetTop : board.scrollHeight;
    scrollPending = false;
  }
}

// 點看板的某一列 → 選那班飛機
document.getElementById('board').addEventListener('click', e => {
  const row = e.target.closest('.row');
  if (row) selectFlight(Number(row.dataset.id));
});

// 切換出發／抵達
function setTab(tab) {
  scrollPending = true;
  boardTab = tab;
  document.getElementById('tabDep').classList.toggle('on', tab === 'dep');
  document.getElementById('tabArr').classList.toggle('on', tab === 'arr');
  renderBoard(simMinutes());
}
document.getElementById('tabDep').onclick = () => setTab('dep');
document.getElementById('tabArr').onclick = () => setTab('arr');

// 地圖載入後：點飛機、手動拖曳就停止跟隨
map.on('load', () => {
  map.on('click', 'planes', e => selectFlight(e.features[0].properties.id));
  map.on('mouseenter', 'planes', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'planes', () => map.getCanvas().style.cursor = '');
  map.on('dragstart', () => {
    following = false;
    updateInfo(simMinutes());
  });
});

// ================= 第 6 步：接上真實航班 =================

const API_URL = 'https://kongdao-api.sd9960528.workers.dev';

// 各航線的飛行時間（分鐘），用來推算另一端的時間
const ROUTE_MIN = { TSA: 55, RMQ: 50, CYI: 45, TNN: 50, KHH: 55, MZG: 35 };

let dataSource = '示意班表';

// "2026-10-24T08:35" → 515（從午夜算起的分鐘數）
function timeToMin(s) {
  if (!s) return null;
  return Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16));
}

async function loadRealFlights() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) throw new Error('資料格式不對');
    const knh = data[0];
    const list = [];

    // 從金門出發
    for (const d of knh.FIDSDeparture || []) {
      const dur = ROUTE_MIN[d.ArrivalAirportID];
      if (!dur || !AIRLINE_NAME[d.AirlineID]) continue;
      const sched = timeToMin(d.ScheduleDepartureTime);
      const dep = timeToMin(d.ActualDepartureTime || d.EstimatedDepartureTime || d.ScheduleDepartureTime);
      if (dep === null) continue;
      list.push({
        no: `${d.AirlineID} ${d.FlightNumber}`, airline: d.AirlineID,
        from: 'KNH', to: d.ArrivalAirportID,
        dep, dur, sched, delay: dep - sched,
        remark: d.DepartureRemark || ''
      });
    }

    // 飛往金門
    for (const a of knh.FIDSArrival || []) {
      const dur = ROUTE_MIN[a.DepartureAirportID];
      if (!dur || !AIRLINE_NAME[a.AirlineID]) continue;
      const sched = timeToMin(a.ScheduleArrivalTime);
      const arr = timeToMin(a.ActualArrivalTime || a.EstimatedArrivalTime || a.ScheduleArrivalTime);
      if (arr === null) continue;
      list.push({
        no: `${a.AirlineID} ${a.FlightNumber}`, airline: a.AirlineID,
        from: a.DepartureAirportID, to: 'KNH',
        dep: arr - dur, dur, sched, delay: arr - sched,
        remark: a.ArrivalRemark || ''
      });
    }

    if (list.length === 0) throw new Error('沒有可用的航班');

    // 換掉舊資料，但記住正在看的是哪一班
    const prevNo = selectedId !== null ? FLIGHTS[selectedId].no : null;
    FLIGHTS.length = 0;
    FLIGHTS.push(...list);
    FLIGHTS.forEach((f, i) => f.id = i);
    const again = FLIGHTS.find(f => f.no === prevNo);
    selectedId = again ? again.id : null;

    // 第一次拿到真實資料時，看板捲到現在時間；之後每 5 分鐘更新就不要亂跳
    if (dataSource === '示意班表') scrollPending = true;
    dataSource = `TDX 即時（${hhmm(simMinutes())} 更新）`;
  } catch (err) {
    console.warn('拿不到即時資料，繼續用示意班表：', err);
    dataSource = '示意班表';
  }
}

loadRealFlights();
setInterval(loadRealFlights, 5 * 60 * 1000);   // 每 5 分鐘更新一次
// ================= 第 9 步：弧線航線、加減速、飛行軌跡 =================

const K = Math.cos(24 * Math.PI / 180);   // 在台灣的緯度，一度經度比一度緯度短
const ARC = 0.08;                          // 弧線彎曲的程度
const FC = features => ({ type: 'FeatureCollection', features });

// 從機場 from 飛到 to，進度 u（0～1）時的位置。用「二次貝茲曲線」畫出弧線
function curvePoint(from, to, u) {
  const a = AIRPORTS[from], b = AIRPORTS[to];
  const ax = a.lng * K, ay = a.lat, bx = b.lng * K, by = b.lat;
  // 控制點：兩個機場的中點，往「前進方向的右邊」推一點
  const cx = (ax + bx) / 2 + (by - ay) * ARC;
  const cy = (ay + by) / 2 - (bx - ax) * ARC;
  const v = 1 - u;
  const x = v * v * ax + 2 * v * u * cx + u * u * bx;
  const y = v * v * ay + 2 * v * u * cy + u * u * by;
  return [x / K, y];
}

// 時間進度 p → 距離進度：起降時慢、巡航時快
function ease(p) {
  const s = 0.5 - 0.5 * Math.cos(Math.PI * p);
  return 0.35 * s + 0.65 * p;
}

function progressOf(f, t) {
  return Math.min(1, Math.max(0, (t - f.dep) / f.dur));
}

// 新版：飛機位置沿著弧線走
function planePosition(f, t) {
  if (f.remark && f.remark.includes('取消')) return null;
  const p = (t - f.dep) / f.dur;
  if (p < 0 || p > 1) return null;
  return curvePoint(f.from, f.to, ease(p));
}

// 新版：機頭方向 = 弧線在這一點的切線方向
function bearing(f, t) {
  const u = ease(progressOf(f, t));
  const a = curvePoint(f.from, f.to, Math.max(0, u - 0.01));
  const b = curvePoint(f.from, f.to, Math.min(1, u + 0.01));
  return Math.atan2((b[0] - a[0]) * K, b[1] - a[1]) * 180 / Math.PI;
}

// 把弧線的一段切成很多小點，變成可以畫的線
function curveLine(from, to, u0, u1) {
  const pts = [];
  for (let i = 0; i <= 40; i++) pts.push(curvePoint(from, to, u0 + (u1 - u0) * i / 40));
  return pts;
}
const lineFeature = (coords, part) => ({
  type: 'Feature', properties: { part }, geometry: { type: 'LineString', coordinates: coords }
});

// 每條航線畫去程、回程兩條弧線
function curvedRoutes() {
  const features = [];
  for (const code of Object.keys(AIRPORTS)) {
    if (code === 'KNH') continue;
    features.push(lineFeature(curveLine('KNH', code, 0, 1), 'route'));
    features.push(lineFeature(curveLine(code, 'KNH', 0, 1), 'route'));
  }
  return FC(features);
}

// 選中飛機的軌跡：飛過的（done）和還沒飛的（todo）
function trailData(t) {
  if (selectedId === null) return FC([]);
  const f = FLIGHTS[selectedId];
  if (f.remark && f.remark.includes('取消')) return FC([]);
  const u = ease(progressOf(f, t));
  return FC([
    lineFeature(curveLine(f.from, f.to, 0, u), 'done'),
    lineFeature(curveLine(f.from, f.to, u, 1), 'todo')
  ]);
}

map.on('load', () => {
  // 把第 3 步的直線航線換成弧線
  map.getSource('routes').setData(curvedRoutes());

  // 軌跡圖層，放在飛機圖層的下面（第二個參數 'planes' 的意思）
  map.addSource('trail', { type: 'geojson', data: FC([]) });
  map.addLayer({
    id: 'trail-done', type: 'line', source: 'trail',
    filter: ['==', ['get', 'part'], 'done'],
    paint: { 'line-color': '#a8236f', 'line-width': 3 }
  }, 'planes');
  map.addLayer({
    id: 'trail-todo', type: 'line', source: 'trail',
    filter: ['==', ['get', 'part'], 'todo'],
    paint: { 'line-color': '#a8236f', 'line-width': 2, 'line-dasharray': [1, 1.5], 'line-opacity': 0.7 }
  }, 'planes');
});

// 新版 tick：多了 selected 標記和軌跡
function tick() {
  const t = simMinutes();
  const features = [];
  let selectedPos = null;

  for (const f of FLIGHTS) {
    const pos = planePosition(f, t);
    if (!pos) continue;
    const isSel = f.id === selectedId;
    if (isSel) selectedPos = pos;
    features.push({
      type: 'Feature',
      properties: { id: f.id, no: f.no, airline: f.airline, bearing: bearing(f, t), selected: isSel },
      geometry: { type: 'Point', coordinates: pos }
    });
  }
  map.getSource('planes').setData(FC(features));
  const trail = map.getSource('trail');
  if (trail) trail.setData(trailData(t));

  if (following && selectedPos) map.setCenter(selectedPos);

  document.getElementById('clock').textContent = `${fmt(t)}　空中 ${features.length} 架　${dataSource}`;

  if (Date.now() - lastPanelUpdate > 1000) {
    lastPanelUpdate = Date.now();
    updateInfo(t);
    renderBoard(t);
  }
  requestAnimationFrame(tick);
}
// ================= 第 10 步：暗色主題 =================

const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DARK_STYLE  = 'https://tiles.openfreemap.org/styles/dark';

// 換底圖時要保留的「我們自己的」資料和圖層
const MY_SOURCES = ['airports', 'routes', 'trail', 'planes'];
const MY_LAYERS  = ['routes', 'airports', 'airport-labels', 'trail-done', 'trail-todo', 'planes'];

let isDark = false;

// 依目前主題，幫我們自己的圖層上色
function applyMapColors() {
  const c = isDark
    ? { accent: '#ff6bb5', text: '#e4ecee', halo: '#0b161d', fill: '#16232a' }
    : { accent: '#a8236f', text: '#1c2a31', halo: '#ffffff', fill: '#ffffff' };
  map.setPaintProperty('routes', 'line-color', c.accent);
  map.setPaintProperty('airports', 'circle-color', c.fill);
  map.setPaintProperty('airports', 'circle-stroke-color', c.accent);
  map.setPaintProperty('trail-done', 'line-color', c.accent);
  map.setPaintProperty('trail-todo', 'line-color', c.accent);
  for (const id of ['airport-labels', 'planes']) {
    map.setPaintProperty(id, 'text-color', c.text);
    map.setPaintProperty(id, 'text-halo-color', c.halo);
  }
}

function setTheme(dark) {
  isDark = dark;
  document.body.classList.toggle('dark', dark);
  document.getElementById('themeBtn').textContent = dark ? '亮色地圖' : '暗色地圖';
  try { localStorage.setItem('kongdao-theme', dark ? 'dark' : 'light'); } catch (e) {}

  // 換底圖：新底圖的圖層 + 我們原本的機場、航線、飛機
  map.setStyle(dark ? DARK_STYLE : LIGHT_STYLE, {
    transformStyle: (prev, next) => {
      if (!prev) return next;
      const sources = { ...next.sources };
      for (const id of MY_SOURCES) if (prev.sources[id]) sources[id] = prev.sources[id];
      const mine = prev.layers.filter(l => MY_LAYERS.includes(l.id));
      return { ...next, sources, layers: [...next.layers, ...mine] };
    }
  });
  map.once('style.load', applyMapColors);
}

// 換底圖後飛機圖示會不見，地圖找不到圖示時，就依主題重畫一個
map.on('styleimagemissing', e => {
  if (e.id === 'plane-B7') map.addImage('plane-B7', makePlaneIcon(isDark ? '#4fd197' : '#1f8a5b'), { pixelRatio: 2 });
  if (e.id === 'plane-AE') map.addImage('plane-AE', makePlaneIcon(isDark ? '#7aa4ff' : '#2f5fb3'), { pixelRatio: 2 });
});

document.getElementById('themeBtn').onclick = () => setTheme(!isDark);

// 第一次打開：上次選過就用上次的；沒選過就跟著電腦的亮暗設定
map.on('load', () => {
  let saved = null;
  try { saved = localStorage.getItem('kongdao-theme'); } catch (e) {}
  const wantDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (wantDark) setTheme(true);
});