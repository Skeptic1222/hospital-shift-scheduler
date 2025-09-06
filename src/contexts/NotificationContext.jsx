import React, { createContext, useContext, useState } from 'react';

const NotificationContext = createContext({ notifications: [], add: () => {} });

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const add = (n) => setNotifications((prev) => [n, ...prev]);
  return (
    <NotificationContext.Provider value={{ notifications, add }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);

export default NotificationContext;

