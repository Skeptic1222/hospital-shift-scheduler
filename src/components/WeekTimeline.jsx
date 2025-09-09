import { useMemo, useRef, useState } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { format, parseISO } from 'date-fns';

const hours = Array.from({ length: 24 }, (_, i) => i);

function toMinutes(t) {
  if (!t) return 0;
  if (typeof t === 'string' && t.includes('T')) { const d = new Date(t); return d.getHours()*60 + d.getMinutes(); }
  const [hh, mm] = (t || '00:00:00').split(':'); return (parseInt(hh,10)||0)*60 + (parseInt(mm,10)||0);
}
function toTimeStr(m) { const hh = Math.floor(m/60)%24; const mm = m%60; return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`; }

const dayMs = 24*60; // minutes per day

export default function WeekTimeline({ shifts = [], onShiftUpdate }) {
  const containerRef = useRef(null);
  const [drag, setDrag] = useState(null); // { id, offsetY }

  const days = useMemo(() => {
    const map = {};
    shifts.forEach(s => {
      const date = s.date || s.shift_date || (s.startTime ? s.startTime.slice(0,10) : null);
      if (!date) return;
      const key = date;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const dayKeys = days.map(([k]) => k);

  const handleMouseDown = (e, s) => {
    const startMins = toMinutes(s.start_time || s.startTime || s.start_datetime);
    setDrag({ id: s.id, startMins, startY: e.clientY });
  };
  const handleMouseUp = (e, s) => {
    if (!drag || drag.id !== s.id) return;
    setDrag(null);
  };
  const handleMouseMove = (e, s, dateKey) => {
    if (!drag || drag.id !== s.id) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const deltaPx = e.clientY - drag.startY;
    // map 1px ~ 1 minute (tunable). Use container height for scale: 24h = rect.height
    const scale = rect.height / dayMs;
    const deltaMins = Math.round(deltaPx / scale / 15) * 15;
    const newStart = Math.max(0, Math.min(dayMs - 30, drag.startMins + deltaMins));
    const duration = Math.max(30, toMinutes(s.end_time || s.endTime || s.end_datetime) - toMinutes(s.start_time || s.startTime || s.start_datetime));
    const newEnd = Math.min(dayMs, newStart + duration);
    if (onShiftUpdate) {
      onShiftUpdate({ id: s.id, date: dateKey, start_time: toTimeStr(newStart), end_time: toTimeStr(newEnd) }, true);
    }
  };

  const onUpdateCommit = (s) => {
    if (onShiftUpdate) onShiftUpdate(s, false);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, height: 480 }}>
      {/* Hours rail */}
      <Box sx={{ width: 56, borderRight: '1px solid', borderColor: 'divider', pr: 1 }}>
        {hours.map(h => (
          <Box key={h} sx={{ height: (480/24), fontSize: '0.7rem', color: 'text.secondary' }}>{String(h).padStart(2,'0')}:00</Box>
        ))}
      </Box>
      {/* Days */}
      <Box ref={containerRef} sx={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {dayKeys.map((k, idx) => (
          <Box key={k} sx={{ flex: 1, borderRight: idx<6 ? '1px solid' : 'none', borderColor: 'divider', position: 'relative' }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: 4, left: 4, zIndex: 1 }}>{format(parseISO(k), 'EEE d')}</Typography>
            {/* grid lines */}
            {hours.map((h,i) => (
              <Box key={i} sx={{ position: 'absolute', top: (480/24)*i, left: 0, right: 0, height: 1, bgcolor: 'action.hover', opacity: 0.3 }} />
            ))}
            {days.find(d => d[0]===k)?.[1].map((s) => {
              const start = toMinutes(s.start_time || s.startTime || s.start_datetime);
              const end = toMinutes(s.end_time || s.endTime || s.end_datetime);
              const top = (480/24) * (start/60);
              const height = Math.max(8, (480/24) * ((end - start)/60));
              return (
                <Paper key={s.id}
                  onMouseDown={(e)=>handleMouseDown(e,s)}
                  onMouseUp={(e)=>{ handleMouseUp(e,s); onUpdateCommit({ id: s.id, date: k, start_time: toTimeStr(start), end_time: toTimeStr(end) }); }}
                  onMouseMove={(e)=>handleMouseMove(e,s,k)}
                  sx={{ position: 'absolute', top, left: 4, right: 4, height, p: 0.5, overflow: 'hidden', cursor: 'move' }}>
                  <Typography variant="caption" noWrap>
                    {(s.department_name || s.department_id || 'Dept')}: {String(s.start_time || s.startTime).slice(0,5)} - {String(s.end_time || s.endTime).slice(0,5)}
                  </Typography>
                </Paper>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
