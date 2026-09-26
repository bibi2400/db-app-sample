export interface DatabaseUiConfig {
  /** Hide database administration UI and use an internal database when false. */
  enabled?: boolean;
  /** Show the read-only database path inside technical information. */
  showTechnicalInfo?: boolean;
}

export interface ConsumerConfig {
  databaseUi?: DatabaseUiConfig;
}
