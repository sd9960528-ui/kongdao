// 示意班表（不是官方資料，第 6 步會換成 TDX 的真實航班）
// toKNH：飛往金門的起飛時間；fromKNH：從金門起飛的時間
const SCHEDULE = [
  { airline: 'B7', route: 'TSA', dur: 55, firstNo: 8801,
    toKNH:   ['07:00','08:15','10:30','12:15','14:25','16:40','18:50'],
    fromKNH: ['08:00','09:35','11:45','13:30','15:40','17:55','20:10'] },
  { airline: 'AE', route: 'TSA', dur: 60, firstNo: 1261,
    toKNH:   ['06:30','07:35','09:05','10:50','12:45','13:50','15:15','17:25','19:35'],
    fromKNH: ['07:40','08:50','10:20','12:10','14:00','15:05','16:30','18:40','20:50'] },
  { airline: 'B7', route: 'RMQ', dur: 50, firstNo: 8951,
    toKNH:   ['07:50','10:25','13:10','15:00','17:10'],
    fromKNH: ['09:00','11:40','14:20','16:15','18:25'] },
  { airline: 'AE', route: 'RMQ', dur: 50, firstNo: 1281,
    toKNH:   ['08:30','12:00','16:50'],
    fromKNH: ['09:50','13:20','18:10'] },
  { airline: 'B7', route: 'KHH', dur: 55, firstNo: 9101,
    toKNH:   ['07:30','09:10','10:55','14:30','15:45','17:50'],
    fromKNH: ['08:45','10:25','12:10','15:45','17:00','19:05'] },
  { airline: 'B7', route: 'TNN', dur: 50, firstNo: 9031,
    toKNH:   ['09:40','12:50','16:00'],
    fromKNH: ['10:55','14:05','17:15'] },
  { airline: 'B7', route: 'CYI', dur: 45, firstNo: 9051,
    toKNH:   ['12:15'], fromKNH: ['13:25'] },
  { airline: 'B7', route: 'MZG', dur: 35, firstNo: 9071,
    toKNH:   ['11:10'], fromKNH: ['12:20'] },
];

// "07:30" → 450（從午夜算起的分鐘數）
function toMin(s) {
  const [h, m] = s.split(':');
  return Number(h) * 60 + Number(m);
}

// 把上面的表展開成一班一班的航班
const FLIGHTS = [];
for (const r of SCHEDULE) {
  r.toKNH.forEach((t, i) => FLIGHTS.push({
    no: `${r.airline} ${r.firstNo + i * 2}`, airline: r.airline,
    from: r.route, to: 'KNH', dep: toMin(t), dur: r.dur
  }));
  r.fromKNH.forEach((t, i) => FLIGHTS.push({
    no: `${r.airline} ${r.firstNo + 1 + i * 2}`, airline: r.airline,
    from: 'KNH', to: r.route, dep: toMin(t), dur: r.dur
  }));
}