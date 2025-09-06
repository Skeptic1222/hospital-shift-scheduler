import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box,
  LinearProgress,
  Skeleton,
  IconButton,
  Tooltip,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useResponsive } from '../hooks/useResponsive';

const MetricCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary', 
  trend,
  trendPeriod = 'vs last week',
  urgent,
  loading = false,
  subtitle,
  details,
  progress,
  maxValue,
  unit = '',
  onClick,
  expandable = false,
  children,
  status,
  lastUpdated
}) => {
  const [expanded, setExpanded] = useState(false);
  const { isMobile } = useResponsive();

  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <TrendingUpIcon fontSize="small" />;
    if (trend < 0) return <TrendingDownIcon fontSize="small" />;
    return <TrendingFlatIcon fontSize="small" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return 'text.secondary';
    if (trend > 0) return 'success.main';
    if (trend < 0) return 'error.main';
    return 'text.secondary';
  };

  const getStatusColor = () => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'good': return '#10b981';
      default: return undefined;
    }
  };

  if (loading) {
    return (
      <Card 
        variant="outlined" 
        sx={{ 
          height: '100%',
          minHeight: isMobile ? 120 : 140
        }}
      >
        <CardContent>
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="80%" height={40} sx={{ my: 1 }} />
          <Skeleton variant="text" width="40%" height={16} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        borderLeft: urgent ? '4px solid #f59e0b' : status ? `4px solid ${getStatusColor()}` : undefined,
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease',
        '&:hover': onClick ? {
          boxShadow: 2,
          transform: 'translateY(-2px)'
        } : undefined
      }}
      onClick={onClick}
    >
      <CardContent sx={{ pb: expandable ? 0 : 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="overline" 
              color={color}
              sx={{ 
                fontSize: isMobile ? '0.65rem' : '0.75rem',
                fontWeight: 600,
                letterSpacing: 1
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" display="block" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {urgent && (
              <Tooltip title="Urgent attention required">
                <WarningIcon color="warning" fontSize="small" />
              </Tooltip>
            )}
            {details && (
              <Tooltip title={details}>
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
          {icon && (
            <Box sx={{ color: color === 'primary' ? 'primary.main' : color }}>
              {icon}
            </Box>
          )}
          <Typography 
            variant={isMobile ? 'h5' : 'h4'} 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary'
            }}
          >
            {value}
            {unit && (
              <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                {unit}
              </Typography>
            )}
          </Typography>
        </Box>

        {progress !== undefined && maxValue !== undefined && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Math.round((progress / maxValue) * 100)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={(progress / maxValue) * 100}
              sx={{ 
                height: 6,
                borderRadius: 1,
                backgroundColor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 1
                }
              }}
            />
          </Box>
        )}

        {trend !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getTrendIcon()}
            <Typography 
              variant="caption" 
              color={getTrendColor()}
              sx={{ fontWeight: 500 }}
            >
              {trend >= 0 ? '+' : ''}{trend}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {trendPeriod}
            </Typography>
          </Box>
        )}

        {lastUpdated && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Updated: {new Date(lastUpdated).toLocaleTimeString()}
          </Typography>
        )}
      </CardContent>

      {expandable && (
        <>
          <Box sx={{ px: 2, pb: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              sx={{ width: '100%', borderRadius: 1 }}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            <Divider />
            <Box sx={{ p: 2 }}>
              {children}
            </Box>
          </Collapse>
        </>
      )}
    </Card>
  );
};

// Additional specialized metric card variants
export const StaffMetricCard = ({ available, total, department, urgent }) => (
  <MetricCard
    title={`${department} Staff`}
    value={`${available}/${total}`}
    subtitle="Available / Total"
    progress={available}
    maxValue={total}
    color={available < total * 0.5 ? 'error' : 'success'}
    urgent={urgent}
    status={available < total * 0.3 ? 'critical' : available < total * 0.5 ? 'warning' : 'good'}
  />
);

export const ShiftMetricCard = ({ filled, total, shiftType, trend }) => (
  <MetricCard
    title={`${shiftType} Shifts`}
    value={`${filled}/${total}`}
    subtitle="Filled / Total"
    progress={filled}
    maxValue={total}
    trend={trend}
    color="primary"
    status={filled < total * 0.7 ? 'warning' : 'good'}
  />
);

export const ResponseMetricCard = ({ avgTime, unit = 'min', target, trend }) => {
  const isWithinTarget = target ? avgTime <= target : true;
  
  return (
    <MetricCard
      title="Avg Response Time"
      value={avgTime}
      unit={unit}
      subtitle={target ? `Target: ${target}${unit}` : undefined}
      trend={trend}
      color={isWithinTarget ? 'success' : 'error'}
      status={isWithinTarget ? 'good' : 'warning'}
    />
  );
};

export default MetricCard;

