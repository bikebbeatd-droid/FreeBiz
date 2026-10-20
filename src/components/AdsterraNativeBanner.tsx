/**
 * Reusable AdsterraNativeBanner Component
 *
 * Renders an isolated, responsive ad container below the generated QR result.
 * Features:
 * - Separate configuration placeholder for official native banner script and container ID.
 * - Client-side only script injection (SSR-safe).
 * - Script deduplication across renders and route switches.
 * - Distinct, accessible "Advertisement" label.
 * - Completely isolated from QR buttons (download, share, print) to prevent misclicks.
 * - Never renders fake or mock ads.
 */

import React, { useEffect, useRef } from 'react';
import { ADSTERRA_CONFIG } from '../config/adsterra.js';

// Global registry of loaded native script URLs to prevent duplicate insertions
const loadedNativeScriptUrls = new Set<string>();

export interface AdsterraNativeBannerProps {
  /** Optional custom native banner script URL; defaults to ADSTERRA_CONFIG.nativeBanner.scriptUrl */
  scriptUrl?: string;
  /** Container ID specified by Adsterra for the native unit */
  containerId?: string;
  /** Optional custom CSS class name */
  className?: string;
}

export const AdsterraNativeBanner: React.FC<AdsterraNativeBannerProps> = ({
  scriptUrl = ADSTERRA_CONFIG.nativeBanner.scriptUrl,
  containerId = ADSTERRA_CONFIG.nativeBanner.containerId,
  className = ''
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isScriptAppendedRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Guard against Server-Side Rendering
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const cleanUrl = scriptUrl ? scriptUrl.trim() : '';
    // If user has not yet configured the official native banner script, gracefully wait without throwing
    if (!cleanUrl) {
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    // 2. Prevent duplicate insertion in this component instance
    if (isScriptAppendedRef.current) {
      return;
    }

    // 3. Check if script was already inserted globally
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${cleanUrl}"]`);
    if (existingScript || loadedNativeScriptUrls.has(cleanUrl)) {
      isScriptAppendedRef.current = true;
      return;
    }

    // 4. Create and append the official native banner script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = cleanUrl;
    script.async = true;
    script.setAttribute('data-adsterra', 'native-banner');
    script.setAttribute('data-cfasync', 'false');

    script.onload = () => {
      loadedNativeScriptUrls.add(cleanUrl);
    };

    script.onerror = () => {
      console.warn(`[Adsterra] Native banner script could not be loaded: ${cleanUrl}`);
    };

    try {
      wrapper.appendChild(script);
      isScriptAppendedRef.current = true;
      loadedNativeScriptUrls.add(cleanUrl);
    } catch (err) {
      console.warn('[Adsterra] Error mounting native banner script:', err);
    }
  }, [scriptUrl]);

  return (
    <div
      ref={wrapperRef}
      className={`adsterra-ad-container adsterra-native-container ${className}`.trim()}
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
      {/* Target DOM container specified by Adsterra native banner format */}
      <div
        id={containerId}
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

export default AdsterraNativeBanner;
