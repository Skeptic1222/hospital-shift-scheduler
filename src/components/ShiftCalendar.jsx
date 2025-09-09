import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Grid,
  Tooltip,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  TextField,
} from '@mui/material';
import {
  NavigateBefore,
  NavigateNext,
  Today as TodayIcon,
  ViewWeek as WeekIcon,
  CalendarMonth as MonthIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Circle as CircleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  getDay,
  parseISO,
  differenceInHours
} from 'date-fns';
import { useResponsive } from '../hooks/useResponsive';
import StandardButton from './common/StandardButton';

const SHIFT_COLORS = {
  day: '#3b82f6',      // Blue
  evening: '#f59e0b',  // Amber
  night: '#8b5cf6',    // Purple
  overnight: '#6366f1', // Indigo
  oncall: '#ef4444',   // Red
  training: '#10b981'  // Green
};

const getShiftType = (startTime) => {
  const hour = new Date(startTime).getHours();
  if (hour >= 7 && hour < 15) return 'day';
  if (hour >= 15 && hour < 23) return 'evening';
  if (hour >= 23 || hour < 7) return 'night';
  return 'day';
};

const ShiftCalendar = ({
  shifts = [],
  onShiftClick,
  onDateClick,
  onAddShift,
  selectedDate = new Date(),
  view: propView,
  // height = 600,
  showLegend = true,
  interactive = true,
  currentUserId
}) => {
  const [view, setView] = useState(propView || 'week');
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [focusDate, setFocusDate] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState([]);
  const { isMobile } = useResponsive();

  // Calculate date range based on view
  const dateRange = useMemo(() => {
    if (view === 'day') {
      // Single-day range (start/end same day)
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(currentDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    if (view === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 })
      };
    }
    // month
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    };
  }, [view, currentDate]);

  // Get all days in the current view
  const daysInView = useMemo(() => {
    const days = eachDayOfInterval(dateRange);
    if (view === 'month') {
      const firstDay = days[0];
      const startPadding = getDay(firstDay);
      const paddingDays = [];
      for (let i = startPadding - 1; i >= 0; i--) {
        paddingDays.push(new Date(firstDay.getTime() - (i + 1) * 24 * 60 * 60 * 1000));
      }
      return [...paddingDays, ...days];
    }
    return days;
  }, [dateRange, view]);

  // Group shifts by day
  const shiftsByDay = useMemo(() => {
    const grouped = {};
    
    shifts.forEach(shift => {
      const shiftDate = parseISO(shift.date || shift.startTime);
      const dayKey = format(shiftDate, 'yyyy-MM-dd');
      
      if (!grouped[dayKey]) {
        grouped[dayKey] = [];
      }
      
      grouped[dayKey].push({
        ...shift,
        type: shift.type || getShiftType(shift.startTime),
        duration: differenceInHours(
          parseISO(shift.endTime || shift.end),
          parseISO(shift.startTime || shift.start)
        )
      });
    });
    
    return grouped;
  }, [shifts]);

  const handleNavigate = (direction) => {
    if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const handleDayClick = (day, event) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayShifts = shiftsByDay[dayKey] || [];
    setFocusDate(day);
    
    if (dayShifts.length > 0) {
      setSelectedDayShifts(dayShifts);
      setAnchorEl(event.currentTarget);
    } else if (onDateClick) {
      onDateClick(day);
    }
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    setSelectedDayShifts([]);
    setFocusDate(null);
  };

  const renderShiftBadge = (day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayShifts = shiftsByDay[dayKey] || [];
    
    if (dayShifts.length === 0) return null;
    
    const userShift = dayShifts.find(s => s.userId === currentUserId);
    const openShifts = dayShifts.filter(s => !s.assigned);
    
    return (
      <Box sx={{ position: 'absolute', top: 2, right: 2 }}>
        {userShift && (
          <Tooltip title="You have a shift">
            <CircleIcon sx={{ fontSize: 8, color: SHIFT_COLORS[userShift.type] }} />
          </Tooltip>
        )}
        {openShifts.length > 0 && (
          <Badge badgeContent={openShifts.length} color="error" sx={{ ml: 0.5 }}>
            <Box />
          </Badge>
        )}
      </Box>
    );
  };

  const renderDayContent = (day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayShifts = shiftsByDay[dayKey] || [];
    const isCurrentMonth = isSameMonth(day, currentDate);
    // Coverage aggregates
    const agg = dayShifts.reduce((acc, s) => {
      const req = s.required_staff || s.requiredStaff || 1;
      const asg = (s.assigned_staff && s.assigned_staff.length) || s.assignedCount || 0;
      acc.required += Number(req) || 0;
      acc.assigned += Number(asg) || 0;
      return acc;
    }, { required: 0, assigned: 0 });
    const coverageRatio = agg.required > 0 ? Math.min(1, agg.assigned / agg.required) : 0;
    
    return (
      <Box
        sx={{
          position: 'relative',
          height: view !== 'month' ? { xs: 60, sm: 80, lg: 100 } : { xs: 50, sm: 65, lg: 75 },
          p: { xs: 0.5, sm: 1 },
          bgcolor: isToday(day) ? 'action.hover' : (view === 'month' && agg.required > 0 ? `rgba(16,185,129,${0.12 + 0.28*coverageRatio})` : 'background.paper'),
          opacity: isCurrentMonth ? 1 : 0.5,
          cursor: interactive ? 'pointer' : 'default',
          borderRadius: 0.5,
          border: '1px solid',
          borderColor: (focusDate && format(focusDate, 'yyyy-MM-dd') === dayKey) ? 'primary.main' : 'divider',
          boxShadow: (focusDate && format(focusDate, 'yyyy-MM-dd') === dayKey) ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
          transition: 'all 0.2s ease',
          '&:hover': interactive ? {
            bgcolor: 'action.hover',
            borderColor: 'primary.main'
          } : undefined
        }}
        onClick={(e) => interactive && handleDayClick(day, e)}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: isToday(day) ? 'bold' : 'normal',
            color: isToday(day) ? 'primary.main' : 'text.primary',
            mb: 0.25,
            fontSize: { xs: '0.7rem', sm: '0.875rem' },
            lineHeight: 1.2
          }}
        >
          {format(day, view !== 'month' ? 'EEE d' : 'd')}
        </Typography>
        {agg.required > 0 && (
          <Chip
            size="small"
            label={`${agg.assigned}/${agg.required}`}
            color={agg.assigned >= agg.required ? 'success' : (agg.assigned > 0 ? 'warning' : 'default')}
            sx={{ position: 'absolute', top: 2, right: 2 }}
          />
        )}
        
        {renderShiftBadge(day)}
        
        {(view !== 'month') && dayShifts.length > 0 && (
          <Box sx={{ overflow: 'hidden' }}>
            {dayShifts.slice(0, 1).map((shift, idx) => (
              <Box
                key={idx}
                sx={{
                  fontSize: { xs: '0.55rem', sm: '0.65rem' },
                  bgcolor: shift.assigned ? SHIFT_COLORS[shift.type] : 'grey.400',
                  color: 'white',
                  px: 0.5,
                  py: 0.125,
                  borderRadius: 0.5,
                  mb: 0.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onShiftClick?.(shift);
                }}
              >
                {(() => {
                  try {
                    const time = shift.startTime ? format(parseISO(shift.startTime), 'HH:mm') : '';
                    return isMobile ? time : `${(shift.department || 'Dept').substring(0, 3)} ${time}`;
                  } catch (e) {
                    return (shift.department || 'Shift').substring(0, 8);
                  }
                })()} 
              </Box>
            ))}
            {dayShifts.length > 1 && (
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '0.5rem', sm: '0.6rem' },
                  lineHeight: 1
                }}
              >
                +{dayShifts.length - 1}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  };

  // Helpers for day timeline
  const toMinutes = (t) => {
    if (!t) return 0;
    if (typeof t === 'string' && t.includes('T')) {
      const d = new Date(t);
      return d.getHours() * 60 + d.getMinutes();
    }
    const val = String(t);
    const [hh, mm] = (val || '00:00:00').split(':');
    return (parseInt(hh, 10) || 0) * 60 + (parseInt(mm, 10) || 0);
  };

  const renderDayTimeline = (day) => {
    const HEIGHT = 480; // px
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayShifts = shiftsByDay[dayKey] || [];
    return (
      <Box sx={{ position: 'relative', height: { xs: 380, sm: HEIGHT }, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
        {/* Hour grid */}
        {hours.map((h, i) => (
          <Box key={h} sx={{ position: 'absolute', top: (HEIGHT/24) * i, left: 0, right: 0, height: 1, bgcolor: 'action.hover', opacity: 0.35 }} />
        ))}
        {/* Hour labels (left) */}
        {hours.map((h, i) => (
          <Typography key={`lbl-${h}`} variant="caption" sx={{ position: 'absolute', top: (HEIGHT/24) * i + 2, left: 6, color: 'text.disabled' }}>
            {String(h).padStart(2, '0')}:00
          </Typography>
        ))}
        {/* Shifts */}
        {dayShifts.map((s, idx) => {
          const start = toMinutes(s.start_time || s.startTime || s.start_datetime || s.start);
          const end = toMinutes(s.end_time || s.endTime || s.end_datetime || s.end);
          const duration = Math.max(30, (end || 0) - (start || 0));
          const top = (HEIGHT / 1440) * start;
          const height = Math.max(10, (HEIGHT / 1440) * duration);
          const type = s.type || getShiftType(s.start_time || s.startTime || s.start_datetime || s.start);
          return (
            <Box key={idx} sx={{ position: 'absolute', left: { xs: 72, sm: 84 }, right: 8, top, height, bgcolor: SHIFT_COLORS[type] || 'primary.main', color: 'white', borderRadius: 1, boxShadow: 1, px: 1, py: 0.5, overflow: 'hidden' }} onClick={(e) => { e.stopPropagation(); onShiftClick?.(s); }}>
              <Typography variant="caption" noWrap>
                {(s.department || s.department_name || s.department_id || 'Shift')}: {String(s.start_time || s.startTime).slice(0,5)} - {String(s.end_time || s.endTime).slice(0,5)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ 
      height: '100%',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2,
        flexWrap: 'wrap',
        gap: 1
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => handleNavigate('prev')}>
            <NavigateBefore />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 150, textAlign: 'center' }}>
            {view === 'day'
              ? format(currentDate, 'MMM d, yyyy')
              : view === 'week'
                ? `Week of ${format(dateRange.start, 'MMM d')}`
                : format(currentDate, 'MMMM yyyy')}
          </Typography>
          <IconButton onClick={() => handleNavigate('next')}>
            <NavigateNext />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <StandardButton
            size="small"
            variant="outlined"
            startIcon={<TodayIcon />}
            onClick={(e) => {
              // prevent any parent click handlers from firing
              if (e && typeof e.preventDefault === 'function') e.preventDefault();
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
              const now = new Date();
              // Ensure day view and jump to current day without navigation
              setView('day');
              setCurrentDate(now);
            }}
          >
            Today
          </StandardButton>
          
          {!isMobile && (
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={(e, newView) => newView && setView(newView)}
              size="small"
            >
              <ToggleButton value="week">
                <WeekIcon sx={{ mr: 0.5 }} />
                Week
              </ToggleButton>
              <ToggleButton value="month">
                <MonthIcon sx={{ mr: 0.5 }} />
                Month
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <TextField
            type="date"
            size="small"
            value={format(currentDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const d = new Date(e.target.value + 'T00:00:00');
              if (!isNaN(d)) { setView('day'); setCurrentDate(d); }
            }}
            sx={{ ml: 1, minWidth: 140 }}
          />
          <StandardButton
            size="small"
            variant="outlined"
            onClick={() => { const now = new Date(); setView('day'); setCurrentDate(now); }}
            sx={{ display: format(currentDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') ? 'inline-flex' : 'none' }}
          >
            Back to Today
          </StandardButton>
          
          {onAddShift && (
            <StandardButton
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onAddShift}
              priority="primary"
            >
              Add Shift
            </StandardButton>
          )}
        </Box>
      </Box>

      {/* Calendar Grid or Day Timeline */}
      {view === 'day' ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {renderDayTimeline(currentDate)}
        </Box>
      ) : (
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          minHeight: 0,
          maxHeight: { xs: 350, sm: 450, lg: 500 }
        }}>
          {/* Day Headers */}
          <Grid container spacing={0.5} sx={{ mb: 1 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Grid item xs={12 / 7} key={day}>
                <Typography
                  variant="caption"
                  sx={{
                    textAlign: 'center',
                    display: 'block',
                    fontWeight: 'bold',
                    color: 'text.secondary',
                    fontSize: { xs: '0.65rem', sm: '0.75rem' }
                  }}
                >
                  {isMobile ? day.charAt(0) : day}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar Days */}
          <Grid container spacing={0.5}>
            {daysInView.map((day, idx) => (
              <Grid item xs={12 / 7} key={idx}>
                {renderDayContent(day)}
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Legend */}
      {showLegend && !isMobile && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Shift Types:
          </Typography>
          {Object.entries(SHIFT_COLORS).map(([type, color]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircleIcon sx={{ fontSize: 12, color }} />
              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                {type}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Shift Details Popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, minWidth: { xs: '90vw', sm: 280 }, maxWidth: { xs: '95vw', sm: 400 } }}>
          <Typography variant="h6" gutterBottom>
            Shifts for {selectedDayShifts[0] && (() => {
              try {
                const dateStr = selectedDayShifts[0].date || selectedDayShifts[0].startTime;
                return dateStr ? format(parseISO(dateStr), 'MMM d, yyyy') : 'Selected Day';
              } catch (e) {
                return 'Selected Day';
              }
            })()}
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {selectedDayShifts.map((shift, idx) => (
              <ListItem
                key={idx}
                button
                onClick={() => {
                  onShiftClick?.(shift);
                  handleClosePopover();
                }}
              >
                <ListItemIcon>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: SHIFT_COLORS[shift.type] }}>
                    <ScheduleIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={`${shift.department} - ${shift.role || 'Staff'}`}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {(() => {
                          try {
                            const start = shift.startTime ? format(parseISO(shift.startTime), 'HH:mm') : '??:??';
                            const end = shift.endTime ? format(parseISO(shift.endTime), 'HH:mm') : '??:??';
                            return `${start} - ${end}`;
                          } catch (e) {
                            return 'Time not available';
                          }
                        })()}
                      </Typography>
                      {shift.assigned ? (
                        <Chip
                          label={shift.assignedTo || 'Assigned'}
                          size="small"
                          icon={<CheckIcon />}
                          color="success"
                          sx={{ mt: 0.5 }}
                        />
                      ) : (
                        <Chip
                          label="Open"
                          size="small"
                          icon={<WarningIcon />}
                          color="warning"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </Box>
  );
};

export default ShiftCalendar;
