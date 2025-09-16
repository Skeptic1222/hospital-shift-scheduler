/**
 * Mobile-optimized Shift Card with Touch Gestures
 * Swipeable card for shift management
 */

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Avatar,
  IconButton,
  Collapse,
  Button,
  Divider,
  Stack
} from '@mui/material';
import {
  AccessTime,
  LocationOn,
  Person,
  SwapHoriz,
  CheckCircle,
  Cancel,
  ExpandMore,
  AttachMoney,
  Group,
  Warning,
  LocalHospital
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

const MobileShiftCard = ({ 
  shift, 
  onClaim, 
  onDecline, 
  onSwap,
  onViewDetails,
  userRole = 'user'
}) => {
  const [expanded, setExpanded] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const haptic = useHapticFeedback();
  
  // Swipe gesture setup
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-200, 0, 200],
    ['#f44336', '#ffffff', '#4caf50']
  );
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    
    if (info.offset.x > threshold) {
      // Swiped right - claim shift
      haptic.impact('medium');
      onClaim?.(shift);
    } else if (info.offset.x < -threshold) {
      // Swiped left - decline shift
      haptic.impact('light');
      onDecline?.(shift);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'success',
      filled: 'default',
      partial: 'warning',
      urgent: 'error',
      cancelled: 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'urgent') return <Warning color="error" />;
    if (priority === 'high') return <AttachMoney color="warning" />;
    return null;
  };

  const calculatePay = () => {
    const hours = (new Date(shift.end_time) - new Date(shift.start_time)) / (1000 * 60 * 60);
    const rate = shift.hourly_rate || 45;
    const differential = shift.shift_differential || 0;
    return (hours * rate * (1 + differential / 100)).toFixed(2);
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -200, right: 200 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      onDragStart={() => setSwiping(true)}
      onDragEnd={() => setSwiping(false)}
      style={{ x, rotate }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        sx={{
          mb: 2,
          position: 'relative',
          overflow: 'visible',
          minHeight: 140,
          touchAction: swiping ? 'none' : 'auto',
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          background,
          opacity,
          transition: 'box-shadow 0.3s',
          '&:hover': {
            boxShadow: 4
          }
        }}
      >
        {/* Swipe Indicators */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: 16,
            transform: 'translateY(-50%)',
            opacity: useTransform(x, [0, -100], [0, 1]),
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Cancel color="error" sx={{ mr: 1 }} />
          <Typography variant="body2" color="error">Decline</Typography>
        </Box>
        
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: 16,
            transform: 'translateY(-50%)',
            opacity: useTransform(x, [0, 100], [0, 1]),
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <Typography variant="body2" color="success">Claim</Typography>
          <CheckCircle color="success" sx={{ ml: 1 }} />
        </Box>

        <CardContent onClick={() => !swiping && setExpanded(!expanded)}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalHospital color="primary" />
              <Typography variant="h6" component="div">
                {shift.department_name}
              </Typography>
              {getPriorityIcon(shift.priority)}
            </Box>
            <Chip 
              label={shift.status} 
              color={getStatusColor(shift.status)}
              size="small"
            />
          </Box>

          {/* Main Info */}
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime fontSize="small" color="action" />
              <Typography variant="body1">
                {format(new Date(shift.shift_date), 'MMM dd, yyyy')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(new Date(shift.start_time), 'h:mm a')} - 
                {format(new Date(shift.end_time), 'h:mm a')}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOn fontSize="small" color="action" />
              <Typography variant="body2">
                {shift.location || 'Main Hospital'}
              </Typography>
            </Box>

            {shift.assigned_to && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person fontSize="small" color="action" />
                <Typography variant="body2">
                  {shift.staff_name || 'Assigned'}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney fontSize="small" color="success" />
              <Typography variant="body2" color="success.main" fontWeight="bold">
                ${calculatePay()} estimated
              </Typography>
              {shift.shift_differential > 0 && (
                <Chip 
                  label={`+${shift.shift_differential}%`} 
                  size="small" 
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
          </Stack>

          {/* Expand Icon */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <IconButton 
              size="small"
              sx={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
            >
              <ExpandMore />
            </IconButton>
          </Box>
        </CardContent>

        {/* Expanded Details */}
        <Collapse in={expanded}>
          <Divider />
          <CardContent>
            <Stack spacing={2}>
              {shift.notes && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">
                    {shift.notes}
                  </Typography>
                </Box>
              )}

              {shift.requirements && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Requirements
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {shift.requirements.map((req, idx) => (
                      <Chip key={idx} label={req} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {shift.queue_position && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Your Position
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Group />
                    <Typography variant="h6" color="primary">
                      #{shift.queue_position}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      in queue
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                {shift.status === 'open' && (
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic.impact('medium');
                      onClaim?.(shift);
                    }}
                    startIcon={<CheckCircle />}
                    sx={{ minHeight: 48 }}
                  >
                    Claim Shift
                  </Button>
                )}

                {shift.status === 'filled' && shift.can_swap && (
                  <Button
                    variant="outlined"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      haptic.selection();
                      onSwap?.(shift);
                    }}
                    startIcon={<SwapHoriz />}
                    sx={{ minHeight: 48 }}
                  >
                    Request Swap
                  </Button>
                )}

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails?.(shift);
                  }}
                  sx={{ minHeight: 48 }}
                >
                  View Details
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Collapse>
      </Card>
    </motion.div>
  );
};

export default MobileShiftCard;