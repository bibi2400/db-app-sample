import type { ConsumerConfig, DatabaseUiConfig } from './types/consumer-config';

/** Common validation for the consumer's eaf.config.json in runtime and packaging. */
export function parseConsumerConfig(value: unknown): ConsumerConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('eaf.config.json deve contenere un oggetto di configurazione.');
  }
  const databaseUi = (value as { databaseUi?: unknown }).databaseUi;
  if (databaseUi === undefined) return {};
  if (!databaseUi || typeof databaseUi !== 'object' || Array.isArray(databaseUi)) {
    throw new Error('databaseUi deve contenere enabled e showTechnicalInfo opzionali.');
  }
  for (const key of ['enabled', 'showTechnicalInfo'] as const) {
    const option = (databaseUi as DatabaseUiConfig)[key];
    if (option !== undefined && typeof option !== 'boolean') {
      throw new Error(`databaseUi.${key} deve essere un booleano.`);
    }
  }
  return { databaseUi: databaseUi as DatabaseUiConfig };
}
