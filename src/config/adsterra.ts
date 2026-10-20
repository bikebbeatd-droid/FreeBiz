/**
 * Adsterra Advertisement Configuration
 *
 * Central configuration for official Adsterra Banner and Native Banner ad units.
 * Paste your official Adsterra scripts, container IDs, or atOptions blocks here.
 */

export interface AdsterraBannerOptions {
  key?: string;
  format?: string;
  height?: number;
  width?: number;
  params?: Record<string, unknown>;
}

export interface AdsterraBannerConfig {
  enabled: boolean;
  /** Official banner script URL provided by Adsterra */
  scriptUrl: string;
  /** Optional atOptions configuration for standard iframe banners */
  atOptions?: AdsterraBannerOptions;
}

export interface AdsterraNativeBannerConfig {
  enabled: boolean;
  /** Container DOM ID specified by Adsterra for the native unit */
  containerId: string;
  /** Official native banner script URL provided by Adsterra */
  scriptUrl: string;
}

export interface AdsterraConfig {
  banner: AdsterraBannerConfig;
  nativeBanner: AdsterraNativeBannerConfig;
}

export const ADSTERRA_CONFIG: AdsterraConfig = {
  /**
   * 1. Official Adsterra Banner Configuration
   * Script supplied: https://pl31915705.profitableratecpmnetwork.com/d7/8d/64/d78d648ad19b642e3c73593076404d42.js
   */
  banner: {
    enabled: true,
    scriptUrl: 'https://pl31915705.profitableratecpmnetwork.com/d7/8d/64/d78d648ad19b642e3c73593076404d42.js',
    atOptions: undefined
  },

  /**
   * 2. Official Adsterra Native Banner Configuration
   * Paste your native banner container ID and script URL below when generated in Adsterra.
   */
  nativeBanner: {
    enabled: true,
    containerId: 'adsterra-native-banner-slot',
    // Paste official native banner script URL here:
    scriptUrl: ''
  }
};
