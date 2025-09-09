import { createContext, useContext, useState } from 'react';

const NotificationContext = createContext({ notifications: [], add: () => {}, remove: () => {} });

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const add = (n) => {
    const id = n?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { id, severity: 'info', message: '', ...n };
    setNotifications((prev) => [...prev, item]);
    return id;
  };
  const remove = (id) => setNotifications((prev) => prev.filter(n => n.id !== id));
  return (
    <NotificationContext.Provider value={{ notifications, add, remove }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);

export default NotificationContext;
