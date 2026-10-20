/**
 * Reusable AdsterraBanner Component
 *
 * Renders an isolated, responsive ad container below QR controls.
 * Features:
 * - Loads official Adsterra banner script strictly on the client side (SSR-safe).
 * - Deduplicates scripts to ensure each approved script is loaded only once.
 * - Displays a clear, accessible "Advertisement" label.
 * - Never renders mock ads or fake banners.
 * - Graceful degradation if blocked by ad-blocker or network filters.
 */

import React, { useEffect, useRef } from 'react';
import { ADSTERRA_CONFIG, AdsterraBannerOptions } from '../config/adsterra.js';

// Global registry of loaded script URLs to prevent duplicate insertions across rerenders/routes
const loadedScriptUrls = new Set<string>();

export interface AdsterraBannerProps {
  /** Optional custom banner script URL; defaults to ADSTERRA_CONFIG.banner.scriptUrl */
  scriptUrl?: string;
  /** Optional atOptions configuration object if required by specific banner unit */
  atOptions?: AdsterraBannerOptions;
  /** Optional custom CSS class name */
  className?: string;
  /** Optional custom container DOM ID */
  containerId?: string;
}

export const AdsterraBanner: React.FC<AdsterraBannerProps> = ({
  scriptUrl = ADSTERRA_CONFIG.banner.scriptUrl,
  atOptions = ADSTERRA_CONFIG.banner.atOptions,
  className = '',
  containerId = 'adsterra-banner-container'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScriptAppendedRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Guard against Server-Side Rendering
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // 2. Validate that an official script URL is configured
    const cleanUrl = scriptUrl ? scriptUrl.trim() : '';
    if (!cleanUrl) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    // 3. Prevent duplicate insertion in this component instance
    if (isScriptAppendedRef.current) {
      return;
    }

    // 4. Set atOptions in window scope if provided
    if (atOptions && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).atOptions = atOptions;
    }

    // 5. Check if script was already inserted globally into document
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${cleanUrl}"]`);
    if (existingScript || loadedScriptUrls.has(cleanUrl)) {
      isScriptAppendedRef.current = true;
      return;
    }

    // 6. Create and append the official Adsterra script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = cleanUrl;
    script.async = true;
    script.setAttribute('data-adsterra', 'banner');

    script.onload = () => {
      loadedScriptUrls.add(cleanUrl);
    };

    script.onerror = () => {
      // Graceful error handling: ad blocker or network block must not break UI
      console.warn(`[Adsterra] Banner script could not be reached (possibly blocked by client filter): ${cleanUrl}`);
    };

    try {
      container.appendChild(script);
      isScriptAppendedRef.current = true;
      loadedScriptUrls.add(cleanUrl);
    } catch (err) {
      console.warn('[Adsterra] Error mounting banner script:', err);
    }

    return () => {
      // Keep script cached; do not duplicate on remount
    };
  }, [scriptUrl, atOptions]);

  return (
    <div
      id={containerId}
      ref={containerRef}
      className={`adsterra-ad-container adsterra-banner-container ${className}`.trim()}
      role="region"
      aria-label="Advertisement"
      style={{
        marginTop: '1.25rem',
        marginBottom: '0.75rem',
        padding: '0.5rem',
        borderRadius: '8px',
        border: '1px dashed #cbd5e1',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        clear: 'both'
      }}
    >
      <span
        className="adsterra-ad-label"
        style={{
          fontSize: '0.65rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#94a3b8',
          marginBottom: '0.25rem',
          userSelect: 'none'
        }}
      >
        Advertisement
      </span>
      <div
        className="adsterra-ad-slot"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50px'
        }}
      />
    </div>
  );
};

export default AdsterraBanner;
