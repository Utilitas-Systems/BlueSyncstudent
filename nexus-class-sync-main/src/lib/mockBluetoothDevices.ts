export const MOCK_BLUETOOTH_CHANGED_EVENT = 'bluesync:mock-bluetooth-changed';
const STORAGE_KEY = 'bluesync_mock_bluetooth_device';

export type MockBluetoothDevice = {
  id: string;
  name: string;
  type: string;
  isConnected: boolean;
  sharing: boolean;
  isMock: true;
};

export const MOCK_BLUETOOTH_DEVICE: MockBluetoothDevice = {
  id: 'mock:test-device-not-real',
  name: 'test device (NOT REAL)',
  type: 'bluetooth',
  isConnected: true,
  sharing: true,
  isMock: true,
};

export function isMockBluetoothEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMockBluetoothEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOCK_BLUETOOTH_CHANGED_EVENT));
  }
}

export function getMockBluetoothDevices(): MockBluetoothDevice[] {
  return isMockBluetoothEnabled() ? [MOCK_BLUETOOTH_DEVICE] : [];
}

export function onMockBluetoothChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MOCK_BLUETOOTH_CHANGED_EVENT, handler);
  return () => window.removeEventListener(MOCK_BLUETOOTH_CHANGED_EVENT, handler);
}
