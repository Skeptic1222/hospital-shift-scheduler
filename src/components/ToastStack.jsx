import { useEffect, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useNotification } from '../contexts/NotificationContext';

const ToastStack = () => {
  const { notifications, remove } = useNotification();
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!current && notifications.length > 0) {
      setCurrent(notifications[0]);
    }
  }, [notifications, current]);

  const handleClose = () => {
    if (current) remove(current.id);
    setCurrent(null);
  };

  if (!current) return null;

  return (
    <Snackbar
      open={true}
      autoHideDuration={3000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert onClose={handleClose} severity={current.severity || 'info'} sx={{ width: '100%' }}>
        {current.message}
      </Alert>
    </Snackbar>
  );
};

export default ToastStack;
