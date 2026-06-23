import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, setDoc, updateDoc, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface SystemInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  arch: string;
  hostname: string;
  cpuCount: number;
  freeMemoryGB: number;
}

interface DesktopIntegrationContextType {
  isElectron: boolean;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  isOnline: boolean;
  wsConnected: boolean;
  isSyncing: boolean;
  systemInfo: SystemInfo | null;
  logDeviceActivity: (action: string, details: string) => Promise<void>;
}

const DesktopIntegrationContext = createContext<DesktopIntegrationContextType>({
  isElectron: false,
  deviceId: '',
  deviceName: '',
  appVersion: 'v1.0.0-web',
  isOnline: true,
  wsConnected: false,
  isSyncing: false,
  systemInfo: null,
  logDeviceActivity: async () => {}
});

export const useDesktop = () => useContext(DesktopIntegrationContext);

export function DesktopIntegrationProvider({ children }: { children: React.ReactNode }) {
  const [isElectron, setIsElectron] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [appVersion, setAppVersion] = useState('v1.0.0-web');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wsConnected, setWsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  
  // Expose API via window cast
  const electronAPI = (window as any).electronAPI;

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logDeviceActivity('NETWORK_ONLINE', 'تم استعادة الاتصال بالشبكة بنجاح وبدء المزامنة.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      logDeviceActivity('NETWORK_OFFLINE', 'تم انقطاع الاتصال بالشبكة. يعمل النظام حالياً في وضع التشغيل دون اتصال (Offline Mode).');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [deviceId]);

  // Expose local WebSocket connection status
  useEffect(() => {
    if (!isElectron) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectLocalWS = () => {
      try {
        const port = 8085;
        socket = new WebSocket(`ws://localhost:${port}`);

        socket.onopen = () => {
          setWsConnected(true);
          console.log('Connected to local Electron WebSocket server.');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Message from local WS:', data);
          } catch (e) {
            console.warn('Received non-JSON message from WebSocket');
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          // Retry connection in 5 seconds
          reconnectTimeout = setTimeout(connectLocalWS, 5000);
        };

        socket.onerror = (err) => {
          console.error('WebSocket Error:', err);
          socket?.close();
        };
      } catch (err) {
        console.error('WebSocket connection failed:', err);
      }
    };

    connectLocalWS();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [isElectron]);

  // Load configuration from Electron IPC
  useEffect(() => {
    if (electronAPI) {
      setIsElectron(true);
      
      Promise.all([
        electronAPI.getSystemInfo(),
        electronAPI.getAppVersion()
      ]).then(([info, ver]) => {
        setSystemInfo(info);
        setDeviceId(info.deviceId);
        setDeviceName(info.deviceName);
        setAppVersion(ver);
        
        console.log(`Running in Desktop Mode. Device ID: ${info.deviceId}, Device Name: ${info.deviceName}`);
      }).catch(err => {
        console.error('Failed to retrieve Electron system info:', err);
      });
    }
  }, [electronAPI]);

  // Log activity helper
  const logDeviceActivity = async (action: string, details: string) => {
    if (!deviceId) return;
    try {
      const activeUser = auth.currentUser;
      const logRef = collection(db, 'pos_devices', deviceId, 'activity_logs');
      await addDoc(logRef, {
        action,
        details,
        timestamp: new Date().toISOString(),
        userId: activeUser?.uid || 'SYSTEM',
        userName: activeUser?.displayName || activeUser?.email || 'النظام'
      });
    } catch (err) {
      console.warn('Failed to write device activity log offline:', err);
    }
  };

  // Device Auto-Registration & Heartbeat loops
  useEffect(() => {
    if (!deviceId) return;

    // Track active user changes to register device owner
    const registerDevice = async () => {
      const activeUser = auth.currentUser;
      
      // Look up user details if logged in
      let branchId = 'default';
      let userRole = 'GUEST';
      let userName = 'غير مسجل';

      if (activeUser) {
        userName = activeUser.displayName || activeUser.email || 'كاشير';
        // Get user profile branches from local session or query (fallback to default)
        try {
          const userSession = sessionStorage.getItem('user');
          if (userSession) {
            const parsed = JSON.parse(userSession);
            branchId = parsed.branchId || 'default';
            userRole = parsed.role || 'CASHIER';
          }
        } catch (e) {}
      }

      const deviceData = {
        id: deviceId,
        name: deviceName,
        branchId,
        linkedUserId: activeUser?.uid || '',
        linkedUserName: userName,
        linkedUserRole: userRole,
        version: appVersion,
        lastSeen: new Date().toISOString(),
        status: 'CONNECTED',
        platform: systemInfo?.platform || 'windows',
        arch: systemInfo?.arch || 'x64',
        hostname: systemInfo?.hostname || ''
      };

      try {
        await setDoc(doc(db, 'pos_devices', deviceId), deviceData, { merge: true });
        await logDeviceActivity('DEVICE_STARTUP', `تم تشغيل تطبيق سطح المكتب وتسجيل الجهاز (${deviceName}) تلقائياً.`);
      } catch (err) {
        console.warn('Failed to auto-register device (running offline):', err);
      }
    };

    registerDevice();

    // 30-Second Heartbeat Interval
    const heartbeatInterval = setInterval(async () => {
      const activeUser = auth.currentUser;
      let branchId = 'default';
      let userName = 'غير مسجل';

      if (activeUser) {
        userName = activeUser.displayName || activeUser.email || 'كاشير';
        try {
          const userSession = sessionStorage.getItem('user');
          if (userSession) {
            const parsed = JSON.parse(userSession);
            branchId = parsed.branchId || 'default';
          }
        } catch (e) {}
      }

      try {
        await updateDoc(doc(db, 'pos_devices', deviceId), {
          lastSeen: new Date().toISOString(),
          status: isOnline ? 'CONNECTED' : 'OFFLINE',
          linkedUserId: activeUser?.uid || '',
          linkedUserName: userName,
          branchId
        });
      } catch (err) {
        console.log('Failed heartbeat update (offline mode)');
      }
    }, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [deviceId, deviceName, appVersion, systemInfo, isOnline]);

  // Track Firestore sync status
  useEffect(() => {
    // If online, listen to Firestore synchronization events
    if (!isOnline) {
      setIsSyncing(false);
      return;
    }

    // Wait for Firestore to trigger sync callbacks
    // A simple way to track active writes is to verify when they are resolved.
    const unsubscribe = db ? onSnapshot(doc(db, 'test', 'connection'), { includeMetadataChanges: true }, (snap) => {
      setIsSyncing(snap.metadata.hasPendingWrites);
    }) : () => {};

    return () => unsubscribe();
  }, [isOnline]);

  return (
    <DesktopIntegrationContext.Provider
      value={{
        isElectron,
        deviceId,
        deviceName,
        appVersion,
        isOnline,
        wsConnected,
        isSyncing,
        systemInfo,
        logDeviceActivity
      }}
    >
      {children}
    </DesktopIntegrationContext.Provider>
  );
}
