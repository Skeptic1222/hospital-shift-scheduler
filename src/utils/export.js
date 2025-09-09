function pad(n){ return n.toString().padStart(2,'0'); }

function toICSDate(dt){
  const d = new Date(dt);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth()+1) +
    pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  );
}

export function exportShiftsICS(shifts = [], filename = 'shifts.ics') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shiftwise//EN'
  ];
  shifts.forEach((s, idx) => {
    const date = s.date || s.shift_date || (s.startTime ? s.startTime.slice(0,10) : null);
    const start = s.startTime || s.start_time || s.start_datetime || (date ? `${date}T${s.start_time||'07:00:00'}` : null);
    const end = s.endTime || s.end_time || s.end_datetime || (date ? `${date}T${s.end_time||'15:00:00'}` : null);
    const dept = s.department_name || s.department || s.department_id || 'Department';
    const title = s.title || `${dept} Shift`;
    const uid = (s.id || `${Date.now()}-${idx}`) + '@shiftwise';
    if (!start || !end) return;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${toICSDate(new Date())}`);
    lines.push(`DTSTART:${toICSDate(start)}`);
    lines.push(`DTEND:${toICSDate(end)}`);
    lines.push(`SUMMARY:${title}`);
    if (s.notes) lines.push(`DESCRIPTION:${String(s.notes).replace(/\n/g,'\\n')}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportShiftsCSV(shifts = [], filename = 'shifts.csv') {
  const headers = ['date','start','end','department','required','assigned','status','notes'];
  const rows = shifts.map(s => {
    const date = s.date || s.shift_date || '';
    const start = s.start_time || s.startTime || s.start_datetime || '';
    const end = s.end_time || s.endTime || s.end_datetime || '';
    const dept = s.department_name || s.department_id || s.department || '';
    const required = s.required_staff || s.requiredStaff || '';
    const assigned = (s.assigned_staff && s.assigned_staff.length) || s.assignedCount || '';
    const status = s.status || '';
    const notes = (s.notes || '').toString().replace(/\r?\n/g, ' ');
    return [date,start,end,dept,required,assigned,status,`"${notes.replace(/"/g,'""')}"`].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

