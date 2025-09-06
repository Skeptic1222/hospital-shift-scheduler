// Updated: Button sizing fix - timestamp 17:21 - CACHE BUST VERSION 2
import React from 'react';
import { Card, CardContent, Typography, Grid } from '@mui/material';
import StandardButton from './common/StandardButton';

// Force cache bust
const VERSION = '2.0.1';

const QuickActions = ({ onAction }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>Quick Actions</Typography>
      <Grid container spacing={1}>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('viewSchedule')}
          >
            View Schedule
          </StandardButton>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('requestTimeOff')}
          >
            Request Time Off
          </StandardButton>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('swapShift')}
          >
            Swap Shift
          </StandardButton>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('viewOpenShifts')}
          >
            Open Shifts
          </StandardButton>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('viewOnCall')}
          >
            On-Call Board
          </StandardButton>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <StandardButton 
            variant="outlined" 
            size="medium"
            fullWidth
            sx={{ 
              fontSize: { xs: '0.875rem', sm: '0.8rem', md: '0.875rem' },
              padding: '8px 12px',
              minHeight: '42px'
            }}
            onClick={() => onAction?.('viewStaff')}
          >
            Staff Directory
          </StandardButton>
        </Grid>
      </Grid>
    </CardContent>
  </Card>
);

export default QuickActions;
