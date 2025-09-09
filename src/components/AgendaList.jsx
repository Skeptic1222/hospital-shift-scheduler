import { useMemo } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Chip, Divider } from '@mui/material';
import { format, parseISO, isAfter, addDays, startOfDay } from 'date-fns';

const AgendaList = ({ shifts = [], days = 7 }) => {
  const items = useMemo(() => {
    const now = startOfDay(new Date());
    const end = addDays(now, days);
    const parsed = shifts
      .map(s => {
        const date = s.date || s.shift_date || (s.startTime ? s.startTime.slice(0,10) : null);
        const start = s.startTime || s.start_time || s.start_datetime || null;
        const endTime = s.endTime || s.end_time || s.end_datetime || null;
        const d = date ? parseISO(date) : (start ? parseISO(start) : null);
        return d ? { ...s, _date: d, _start: start, _end: endTime } : null;
      })
      .filter(Boolean)
      .filter(s => isAfter(addDays(s._date, 1), now) && s._date <= end)
      .sort((a,b) => a._date - b._date);
    const groups = {};
    parsed.forEach(s => {
      const key = format(s._date, 'yyyy-MM-dd');
      groups[key] = groups[key] || [];
      groups[key].push(s);
    });
    return Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0]));
  }, [shifts, days]);

  if (items.length === 0) {
    return <Typography variant="body2">No upcoming shifts</Typography>;
  }

  return (
    <Box sx={{ overflowY: 'auto', maxHeight: { xs: 350, sm: 450, lg: 500 } }}>
      {items.map(([day, list], idx) => (
        <Box key={day} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{format(parseISO(day), 'EEE, MMM d')}</Typography>
          <List dense>
            {list.map((s) => {
              const dept = s.department_name || s.department || s.department_id || 'Dept';
              const start = s._start ? format(parseISO(s._start), 'HH:mm') : '';
              const end = s._end ? format(parseISO(s._end), 'HH:mm') : '';
              const required = s.required_staff || s.requiredStaff || 1;
              const assigned = (s.assigned_staff && s.assigned_staff.length) || s.assignedCount || 0;
              return (
                <ListItem key={s.id} sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  <ListItemText
                    primary={`${dept} ${start && end ? `${start} - ${end}` : ''}`}
                    secondary={s.notes || s.title || undefined}
                  />
                  <Chip
                    size="small"
                    label={`${assigned}/${required}`}
                    color={assigned >= required ? 'success' : (assigned > 0 ? 'warning' : 'default')}
                  />
                </ListItem>
              );
            })}
          </List>
          {idx < items.length - 1 && <Divider sx={{ mt: 1 }} />}
        </Box>
      ))}
    </Box>
  );
};

export default AgendaList;
