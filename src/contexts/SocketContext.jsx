import { createContext, useContext } from 'react';

const SocketContext = createContext(null);

export const SocketProvider = ({ socket, children }) => (
  <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
);

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
