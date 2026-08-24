// Polyfill for running Buvora in a standard web browser (Tablet/Mobile Client)
if (typeof window !== 'undefined' && !(window as any).ipcRenderer) {
  console.log('Web Browser Mode Detected - Polyfilling Electron APIs');

  const getSecret = () => {
    let secret = localStorage.getItem('buvora_secret');
    if (!secret) {
      secret = window.prompt('Buvora Tablet Mode\n\nPlease enter the Network Secret from the Main Host Computer (found in Settings > Control Center):');
      if (secret) {
        localStorage.setItem('buvora_secret', secret.trim());
      }
    }
    return secret || '';
  };

  const rpcCall = async (method: string, ...args: any[]) => {
    const secret = getSecret();
    if (!secret) throw new Error('No secret provided');
    
    try {
      const response = await fetch('/api/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Buvora-Auth': secret,
          'X-MedFlow-Auth': secret
        },
        body: JSON.stringify({ method, args })
      });

      if (response.status === 401) {
        localStorage.removeItem('buvora_secret');
        alert('Invalid Network Secret. Please refresh the page and try again.');
        throw new Error('Unauthorized');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    } catch (err) {
      console.error(`RPC Error (${method}):`, err);
      throw err;
    }
  };

  (window as any).ipcRenderer = {
    on: () => {},
    off: () => {},
    send: () => {},
    invoke: (channel: string, ...args: any[]) => rpcCall(channel, ...args)
  };

  const getTabletMachineId = () => {
    let mid = localStorage.getItem('buvora_tablet_id');
    if (!mid) {
      mid = 'TAB-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      localStorage.setItem('buvora_tablet_id', mid);
    }
    return mid;
  };

  (window as any).licensing = {
    checkActivation: async () => {
      const key = localStorage.getItem('buvora_tablet_key') || '';
      return await rpcCall('validate-client-license', getTabletMachineId(), key);
    },
    getMachineID: async () => getTabletMachineId(),
    activateLicense: async (key: string) => {
      localStorage.setItem('buvora_tablet_key', key.trim());
      const result = await rpcCall('validate-client-license', getTabletMachineId(), key.trim());
      if (result.status === 'ACTIVATED') {
        return { success: true };
      }
      return { success: false, message: 'Invalid License Key' };
    },
    deactivate: async () => {
      localStorage.removeItem('buvora_tablet_key');
    }
  };

  (window as any).connection = {
    getSettings: async () => ({ mode: 'client', hostIp: window.location.hostname, hostPort: window.location.port, localIp: '127.0.0.1', networkSecret: 'demo-secret-token' }),
    saveSettings: async () => {},
    getServerStatus: async () => 'running',
    testConnection: async () => ({ success: true }),
    saveClientSecret: async () => ({ success: true })
  };

  (window as any).users = {
    getKnownUsers: () => rpcCall('get-known-users'),
    addKnownUser: (userId: string, role: string, doctorId?: string) => rpcCall('add-known-user', userId, role, doctorId),
    deleteKnownUser: (userId: string) => rpcCall('delete-known-user', userId),
    connectUser: async (userId: string) => {
      localStorage.setItem('buvora_user', userId);
      return true;
    },
    getCurrentUser: async () => localStorage.getItem('buvora_user'),
    getCurrentUserRole: async () => {
      const users = await rpcCall('get-known-users');
      const u = users.find((x: any) => x.id === localStorage.getItem('buvora_user'));
      return u ? u.role : 'doctor';
    },
    getCurrentUserDoctorId: async () => {
      const users = await rpcCall('get-known-users');
      const u = users.find((x: any) => x.id === localStorage.getItem('buvora_user'));
      return u ? u.doctorId : null;
    },
    disconnectUser: async () => {
      localStorage.removeItem('buvora_user');
    }
  };

  (window as any).whatsappBot = {
    getStatus: () => rpcCall('ping').then(() => ({ status: 'CONNECTED' })).catch(() => ({ status: 'DISCONNECTED' })),
    onStatusChange: () => () => {},
    getSchedule: () => rpcCall('whatsapp-get-schedule'),
    sendMessage: (phone: string, message: string) => rpcCall('whatsapp-send-message', phone, message)
  };

  const dbMethods = [
    'getDoctors', 'saveDoctor', 'deleteDoctor', 'getServices', 'saveService', 'deleteService',
    'getReceipts', 'getDashboardMetrics', 'saveReceipt', 'saveReceiptAtomic', 'updateReceipt',
    'deleteReceipt', 'getMetadata', 'setMetadata', 'batchImportDoctors', 'getPrescriptions',
    'savePrescription', 'deletePrescription', 'getAppointments', 'saveAppointment',
    'updateAppointmentStatus', 'deleteAppointment'
  ];

  const dbPolyfill: any = {};
  for (const method of dbMethods) {
    const rpcMethodName = 'db-' + method.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    dbPolyfill[method] = (...args: any[]) => rpcCall(rpcMethodName, ...args);
  }
  
  // Custom mapping for options which sometimes requires wrapping in main.ts
  dbPolyfill.getReceipts = (options?: any) => rpcCall('db-get-receipts', options ? [options] : []);

  (window as any).database = dbPolyfill;
}
