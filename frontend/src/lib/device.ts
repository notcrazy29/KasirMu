/**
 * Utility to generate and persist a unique Device ID in local storage
 * and detect browser / operating system details.
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
}

export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceId: 'server-side',
      deviceName: 'Server',
      browser: 'Unknown',
      os: 'Unknown',
    };
  }

  // 1. Unique Device ID (Persisted in localStorage)
  let deviceId = localStorage.getItem('kasirmu_device_id');
  if (!deviceId) {
    const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    deviceId = `dev_${randomHex}`;
    localStorage.setItem('kasirmu_device_id', deviceId);
  }

  // 2. Browser Detection
  const ua = navigator.userAgent;
  let browser = 'Chrome';
  if (ua.includes('Firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('SamsungBrowser')) {
    browser = 'Samsung Internet';
  } else if (ua.includes('Opera') || ua.includes('OPR')) {
    browser = 'Opera';
  } else if (ua.includes('Trident')) {
    browser = 'Internet Explorer';
  } else if (ua.includes('Edg')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari')) {
    browser = 'Safari';
  }

  // 3. Operating System Detection
  let os = 'Windows';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) os = 'iOS';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';

  // 4. Device Name
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const deviceType = isMobile ? 'Mobile' : 'Desktop';
  const deviceName = `${browser} on ${os} (${deviceType})`;

  return {
    deviceId,
    deviceName,
    browser,
    os,
  };
}
