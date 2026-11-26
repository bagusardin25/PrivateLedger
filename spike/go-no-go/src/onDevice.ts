export const TEXT_EN = [{ type: 'text' as const, languages: ['en'] }];

export type DeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'api-missing';

interface LanguageModelStatic {
  availability(options?: object): Promise<string>;
}

function languageModelApi(): LanguageModelStatic | undefined {
  return (globalThis as unknown as { LanguageModel?: LanguageModelStatic }).LanguageModel;
}

export async function getDeviceStatus(): Promise<DeviceStatus> {
  const api = languageModelApi();
  if (!api) return 'api-missing';
  try {
    const status = await api.availability({ expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN });
    return status as DeviceStatus;
  } catch {
    return 'unavailable';
  }
}

/**
 * Must run before every request that carries raw transaction data.
 *
 * Firebase AI Logic (checked in 13.2.0 and 13.4.0, `callCloudOrDevice`) sends a
 * request to the cloud model when `window.LanguageModel` does not exist, even
 * if the model was created with ONLY_ON_DEVICE. This guard refuses the request
 * instead of letting it leave the device.
 */
export async function assertOnDeviceReady(): Promise<void> {
  const status = await getDeviceStatus();
  if (status !== 'available') {
    throw new Error(
      `On-device model is not ready (${status}). Request refused so it cannot fall back to the cloud.`,
    );
  }
}
