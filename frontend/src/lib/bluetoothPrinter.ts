/**
 * Web Bluetooth API Manager for Thermal Printers
 * Supports native GATT connection, auto-reconnect, write-chunking, and event handling.
 */

// Common Bluetooth Thermal Printer Service & Characteristic UUIDs
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000e781-0000-1000-8000-00805f9b34fb', // Thermal Printer Service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Service
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000af00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP)
];

export interface ConnectedDeviceInfo {
  id: string;
  name: string;
}

export type DisconnectListener = (device: any) => void;

class BluetoothPrinterManager {
  private activeDevice: any = null;
  private activeCharacteristic: any = null;
  private disconnectListeners: Set<DisconnectListener> = new Set();

  /**
   * Check if Web Bluetooth API is supported by the browser
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'bluetooth' in navigator && Boolean((navigator as any).bluetooth);
  }

  /**
   * Request Bluetooth Device selection via Browser Popup
   */
  public async requestDevice(): Promise<any> {
    if (!this.isSupported()) {
      throw new Error('Browser Anda tidak mendukung Web Bluetooth API.');
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICES,
      });

      return device;
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
        throw new Error('Pemilihan perangkat dibatalkan.');
      } else if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
        throw new Error('Website membutuhkan izin Bluetooth untuk mencetak struk.');
      }
      throw err;
    }
  }

  /**
   * Get previously granted devices using navigator.bluetooth.getDevices()
   */
  public async getGrantedDevices(): Promise<any[]> {
    if (!this.isSupported()) return [];
    try {
      if ('getDevices' in (navigator as any).bluetooth) {
        return await (navigator as any).bluetooth.getDevices();
      }
    } catch (err) {
      console.warn('[WebBluetooth] getDevices not supported or failed:', err);
    }
    return [];
  }

  /**
   * Connect to GATT Server of a Bluetooth device and discover printable characteristic
   */
  public async connect(device: any): Promise<ConnectedDeviceInfo> {
    if (!device) {
      throw new Error('Printer tidak aktif.');
    }

    // Attach disconnect listener
    device.removeEventListener('gattserverdisconnected', this.handleDisconnected);
    device.addEventListener('gattserverdisconnected', this.handleDisconnected);

    let gattServer = device.gatt;
    if (!gattServer.connected) {
      try {
        gattServer = await device.gatt.connect();
      } catch (err: any) {
        console.error('[WebBluetooth] Connect error:', err);
        throw new Error('Printer tidak aktif atau di luar jangkauan.');
      }
    }

    // Discover services & writable characteristic
    let characteristic: any = null;

    try {
      const services = await gattServer.getPrimaryServices();

      for (const service of services) {
        try {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            const props = char.properties;
            if (props.write || props.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
        } catch (e) {
          // Ignore service read error and try next
        }
        if (characteristic) break;
      }
    } catch (err: any) {
      console.error('[WebBluetooth] Service discovery error:', err);
    }

    // Fallback: search explicitly by known services if getPrimaryServices returned nothing
    if (!characteristic) {
      for (const uuid of PRINTER_SERVICES) {
        try {
          const service = await gattServer.getPrimaryService(uuid);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              characteristic = char;
              break;
            }
          }
        } catch (e) {
          // Continue to next service UUID
        }
        if (characteristic) break;
      }
    }

    if (!characteristic) {
      throw new Error('Karakteristik pencetakan printer tidak ditemukan.');
    }

    this.activeDevice = device;
    this.activeCharacteristic = characteristic;

    return {
      id: device.id,
      name: device.name || 'Printer Bluetooth',
    };
  }

  /**
   * Disconnect current active device
   */
  public disconnect(): void {
    if (this.activeDevice && this.activeDevice.gatt.connected) {
      this.activeDevice.gatt.disconnect();
    }
    this.activeDevice = null;
    this.activeCharacteristic = null;
  }

  /**
   * Check if currently connected
   */
  public isConnected(): boolean {
    return Boolean(this.activeDevice && this.activeDevice.gatt && this.activeDevice.gatt.connected && this.activeCharacteristic);
  }

  /**
   * Send binary data (Uint8Array) to thermal printer with MTU chunking
   */
  public async print(binaryData: Uint8Array, chunkSize: number = 64): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer tidak terhubung.');
    }

    try {
      const totalLength = binaryData.length;
      let offset = 0;

      while (offset < totalLength) {
        const chunk = binaryData.slice(offset, offset + chunkSize);
        
        if (this.activeCharacteristic.properties.writeWithoutResponse) {
          await this.activeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await this.activeCharacteristic.writeValue(chunk);
        }

        offset += chunkSize;
        // Small delay to prevent buffer drop on Bluetooth microcontrollers
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    } catch (err: any) {
      console.error('[WebBluetooth] Print error:', err);
      throw new Error('Gagal mengirim data ke printer: ' + (err.message || 'Error koneksi.'));
    }
  }

  /**
   * Register onDisconnect event listener
   */
  public onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => {
      this.disconnectListeners.delete(listener);
    };
  }

  private handleDisconnected = (event: any) => {
    const device = event.target;
    console.warn('[WebBluetooth] Device disconnected:', device?.name || device?.id);
    this.activeDevice = null;
    this.activeCharacteristic = null;

    this.disconnectListeners.forEach((listener) => listener(device));
  };
}

export const bluetoothPrinter = new BluetoothPrinterManager();
