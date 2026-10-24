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

// 飛機在時間 t 的位置；還沒起飛或已經降落就回傳 null
function planePosition(f, t) {
  if (f.remark && f.remark.includes('取消')) return null;
  const p = (t - f.dep) / f.dur;          // 0 = 剛起飛，1 = 剛降落
  if (p < 0 || p > 1) return null;
  const a = AIRPORTS[f.from], b = AIRPORTS[f.to];
  return [a.lng + (b.lng - a.lng) * p, a.lat + (b.lat - a.lat) * p];
}

// 機頭方向（0 度 = 正北，順時針）
function bearing(f) {
  const a = AIRPORTS[f.from], b = AIRPORTS[f.to];
  const dx = (b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180);
  const dy = b.lat - a.lat;
  return Math.atan2(dx, dy) * 180 / Math.PI;
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
let lastPanelUpdate = 0;

const AIRLINE_NAME = { B7: '立榮航空', AE: '華信航空' };
const hhmm = t => fmt(t).slice(0, 5);   // "07:30:00" → "07:30"

// 航班狀態：回傳 [文字, 顏色]
function flightStatus(f, t) {
  if (f.remark && f.remark.includes('取消')) return ['取消', '#c0392b'];
  if (f.remark && f.remark.includes('延')) return [f.remark, '#b26b00'];
  const arr = f.dep + f.dur;
  if (t > arr) return f.from === 'KNH' ? ['已起飛', '#888888'] : ['已抵達', '#2c7a4b'];
  if (t >= f.dep) return ['飛行中', '#a8236f'];
  if (f.from === 'KNH' && t >= f.dep - 30) return ['登機中', '#b26b00'];
  return ['準時', '#555555'];
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
    <div style="color:#666">${AIRLINE_NAME[f.airline]}</div>
    <div style="margin:10px 0">${AIRPORTS[f.from].name} ${hhmm(f.dep)} → ${AIRPORTS[f.to].name} ${hhmm(f.dep + f.dur)}</div>
    <div style="height:6px;background:#ddd;border-radius:3px">
      <div style="width:${p * 100}%;height:100%;background:#a8236f;border-radius:3px"></div>
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
  const timeOf = f => boardTab === 'dep' ? f.dep : f.dep + f.dur;
  const list = FLIGHTS
    .filter(f => boardTab === 'dep' ? f.from === 'KNH' : f.to === 'KNH')
    .sort((a, b) => timeOf(a) - timeOf(b));

  document.getElementById('board').innerHTML = list.map(f => {
    const other = boardTab === 'dep' ? f.to : f.from;
    const [st, color] = flightStatus(f, t);
    const past = timeOf(f) < t - 15 && st !== '飛行中';
    return `<div class="row ${past ? 'past' : ''}" data-id="${f.id}">
      <span>${hhmm(timeOf(f))}</span>
      <span>${f.no}</span>
      <span>${AIRPORTS[other].name}</span>
      <span class="status" style="color:${color}">${st}</span>
    </div>`;
  }).join('');
}

// 點看板的某一列 → 選那班飛機
document.getElementById('board').addEventListener('click', e => {
  const row = e.target.closest('.row');
  if (row) selectFlight(Number(row.dataset.id));
});

// 切換出發／抵達
function setTab(tab) {
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

// 新版 tick：多了「跟隨」和「每秒更新面板」
function tick() {
  const t = simMinutes();
  const features = [];
  let selectedPos = null;

  for (const f of FLIGHTS) {
    const pos = planePosition(f, t);
    if (!pos) continue;
    if (f.id === selectedId) selectedPos = pos;
    features.push({
      type: 'Feature',
      properties: { id: f.id, no: f.no, airline: f.airline, bearing: bearing(f) },
      geometry: { type: 'Point', coordinates: pos }
    });
  }
  map.getSource('planes').setData({ type: 'FeatureCollection', features });

  if (following && selectedPos) map.setCenter(selectedPos);

    document.getElementById('clock').textContent = `${fmt(t)}　空中 ${features.length} 架　${dataSource}`;

  // 面板不用每一格都重畫，一秒一次就夠
  if (Date.now() - lastPanelUpdate > 1000) {
    lastPanelUpdate = Date.now();
    updateInfo(t);
    renderBoard(t);
  }
  requestAnimationFrame(tick);
}
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

    // 從金門出發：起飛時間用「實際 → 預計 → 表定」裡最新的那個
    for (const d of knh.FIDSDeparture || []) {
      const dur = ROUTE_MIN[d.ArrivalAirportID];
      if (!dur || !AIRLINE_NAME[d.AirlineID]) continue;   // 不認得的航線或航空公司先跳過
      list.push({
        no: `${d.AirlineID} ${d.FlightNumber}`, airline: d.AirlineID,
        from: 'KNH', to: d.ArrivalAirportID,
        dep: timeToMin(d.ActualDepartureTime || d.EstimatedDepartureTime || d.ScheduleDepartureTime),
        dur, remark: d.DepartureRemark || ''
      });
    }

    // 飛往金門：只知道抵達時間，起飛時間 = 抵達 - 飛行時間
    for (const a of knh.FIDSArrival || []) {
      const dur = ROUTE_MIN[a.DepartureAirportID];
      if (!dur || !AIRLINE_NAME[a.AirlineID]) continue;
      const arr = timeToMin(a.ActualArrivalTime || a.EstimatedArrivalTime || a.ScheduleArrivalTime);
      if (arr === null) continue;
      list.push({
        no: `${a.AirlineID} ${a.FlightNumber}`, airline: a.AirlineID,
        from: a.DepartureAirportID, to: 'KNH',
        dep: arr - dur, dur, remark: a.ArrivalRemark || ''
      });
    }

    if (list.length === 0) throw new Error('沒有可用的航班');

    // 換掉舊資料，但記住正在看的是哪一班
    const prevNo = selectedId !== null ? FLIGHTS[selectedId].no : null;
    FLIGHTS.length = 0;
    FLIGHTS.push(...list.filter(f => f.dep !== null));
    FLIGHTS.forEach((f, i) => f.id = i);
    const again = FLIGHTS.find(f => f.no === prevNo);
    selectedId = again ? again.id : null;

    dataSource = `TDX 即時（${hhmm(simMinutes())} 更新）`;
  } catch (err) {
    console.warn('拿不到即時資料，繼續用示意班表：', err);
    dataSource = '示意班表';
  }
}

loadRealFlights();
setInterval(loadRealFlights, 5 * 60 * 1000);   // 每 5 分鐘更新一次