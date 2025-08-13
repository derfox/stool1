import { useState, useEffect } from 'react';

/**
 * A React hook that detects the browser's online status.
 * It provides the current status and updates automatically when the network connection changes.
 *
 * @returns {boolean} `true` if the browser is online, `false` otherwise.
 */
export const useOnlineStatus = (): boolean => {
  const getOnlineStatus = (): boolean => {
    // Check if navigator and navigator.onLine are available
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true; // Default to true if API is not available (e.g., during SSR)
  };

  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus());

  useEffect(() => {
    // Handlers to update the state
    const handleOnline = () => {
      console.log("Network status: online");
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.log("Network status: offline");
      setIsOnline(false);
    };

    // Add event listeners for network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup function to remove event listeners on component unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount

  return isOnline;
};