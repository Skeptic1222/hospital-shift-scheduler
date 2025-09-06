import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingScreen = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
    <CircularProgress />
    <Typography sx={{ mt: 2 }}>Loading...</Typography>
  </Box>
);

export default LoadingScreen;

