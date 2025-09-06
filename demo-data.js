// Demo data generation for SKIP_EXTERNALS=true mode
const { v4: uuidv4 } = require('uuid');

const departments = [
  { code: 'ED', name: 'Emergency Department' },
  { code: 'Infusion', name: 'Infusion' },
  { code: 'CT', name: 'CT' },
  { code: 'MR', name: 'MRI' },
  { code: 'StatLab', name: 'Stat Lab' },
  { code: 'EPLab', name: 'EP Lab' },
  { code: 'Ultrasound', name: 'Ultrasound' },
  { code: 'XRay', name: 'X-Ray' },
  { code: 'CathLab', name: 'Cath Lab' },
  { code: 'OR', name: 'Operating Room' }
];

const titles = ['Rad Tech', 'Lead Rad Tech', 'CT Tech', 'MR Tech', 'Ultrasound Tech'];
const firstNames = ['Alex','Jordan','Taylor','Riley','Casey','Morgan','Avery','Quinn','Hayden','Peyton','Reese','Skyler','Drew','Rowan','Emerson'];
const lastNames = ['Smith','Johnson','Lee','Brown','Davis','Garcia','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris'];

function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function generateStaff(n = 20) {
  const people = [];
  for (let i=0;i<n;i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const email = `${fn}.${ln}${Math.floor(Math.random()*100)}@example.com`.toLowerCase();
    const dept = pick(departments);
    const title = pick(titles);
    people.push({
      id: uuidv4(),
      first_name: fn,
      last_name: ln,
      name: `${fn} ${ln}`,
      email,
      title,
      department_code: dept.code,
      department_name: dept.name,
      notes: `${title} assigned to ${dept.name}`
    });
  }
  return people;
}

// In-memory stores
const onCallStore = {}; // { 'YYYY-MM-DD': { 'ED': {userId,notes}, ... } }
let staffStore = [];
let shiftStore = [];

function seedStaff(count=20) {
  staffStore = generateStaff(count);
  seedShifts(40);
  return staffStore;
}

function listStaff() { return staffStore.slice(); }

function ensureSeeded() { if (!staffStore || staffStore.length === 0) seedStaff(20); }

function setOnCall({ date, department, userId, notes }) {
  if (!onCallStore[date]) onCallStore[date] = {};
  onCallStore[date][department] = { userId, notes: notes || '' };
  return true;
}

function getOnCall({ date }) { return onCallStore[date] || {}; }

function getOnCallRange({ startDate, endDate }) {
  const results = {};
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate()+1)) {
    const key = dt.toISOString().slice(0,10);
    results[key] = onCallStore[key] || {};
  }
  return results;
}

function seedShifts(count=40) {
  ensureSeeded();
  const shifts = [];
  const today = new Date();
  const patterns = [
    { start: '07:00:00', end: '15:00:00' },
    { start: '15:00:00', end: '23:00:00' },
    { start: '23:00:00', end: '07:00:00' },
  ];
  for (let i=0;i<count;i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + Math.floor(Math.random()*7));
    const date = day.toISOString().slice(0,10);
    const dept = pick(departments);
    const pat = pick(patterns);
    shifts.push({
      id: uuidv4(),
      date,
      start_time: pat.start,
      end_time: pat.end,
      required_staff: 1 + Math.floor(Math.random()*3),
      department_id: dept.code,
      status: 'open',
      notes: `${dept.name} coverage`
    });
  }
  shiftStore = shifts;
  return shiftStore;
}

function listShifts({ date, department_id } = {}) {
  if (!shiftStore.length) seedShifts(40);
  return shiftStore.filter(s => (!date || s.date === date) && (!department_id || s.department_id === department_id));
}

function createShift(data) {
  const s = {
    id: uuidv4(),
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
    required_staff: data.required_staff || 1,
    department_id: data.department_id,
    status: data.status || 'open',
    notes: data.notes || '',
    assigned_staff: []
  };
  shiftStore.unshift(s);
  return s;
}

function assignToShift(shiftId, userId) {
  const idx = shiftStore.findIndex(s => s.id === shiftId);
  if (idx === -1) return false;
  const s = shiftStore[idx];
  if (!Array.isArray(s.assigned_staff)) s.assigned_staff = [];
  if (!s.assigned_staff.includes(userId)) s.assigned_staff.push(userId);
  return true;
}

module.exports = {
  departments,
  titles,
  seedStaff,
  listStaff,
  ensureSeeded,
  setOnCall,
  getOnCall,
  getOnCallRange,
  seedShifts,
  listShifts,
  createShift,
  assignToShift
};



