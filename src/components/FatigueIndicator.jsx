import React from 'react';
import { LinearProgress, Box, Typography } from '@mui/material';

const FatigueIndicator = ({ score = 0, consecutiveDays = 0 }) => (
  <Box>
    <Typography variant="body2">Score: {score}</Typography>
    <LinearProgress variant="determinate" value={Math.min(100, score)} />
    <Typography variant="caption" color="text.secondary">Consecutive days: {consecutiveDays}</Typography>
  </Box>
);

export default FatigueIndicator;

