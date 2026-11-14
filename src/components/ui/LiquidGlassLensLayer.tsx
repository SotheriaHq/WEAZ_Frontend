import { useEffect } from 'react';
import { startLiquidGlassLens } from './liquidGlassLens';

/**
 * Mount once at the app root. Turns control-sized `.wiez-lg-surface`
 * elements into refracting Strong Lens glass where the browser supports it;
 * renders nothing.
 */
export function LiquidGlassLensLayer() {
  useEffect(() => startLiquidGlassLens(), []);
  return null;
}

export default LiquidGlassLensLayer;
