import { useEffect } from 'react';
import { useStudioConfig } from '@/lib/useStudioConfig';

// Applies the studio's configured brand colors at runtime by overriding the
// brand RGB-channel variables (tailwind teal/gold) plus the matching --primary /
// --accent HSL variables, so the accent palette is white-labelable from Settings.
function hexToRgb(hex) {
  if (!hex) return null;
  const m = String(hex).trim().replace('#', '');
  if (m.length !== 6) return null;
  const n = parseInt(m, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const lighten = ([r, g, b], amt) => [r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt].map(clamp);

export default function ThemeApplier() {
  const { data: cfg } = useStudioConfig();
  useEffect(() => {
    if (!cfg) return;
    const root = document.documentElement;
    const teal = hexToRgb(cfg.color_teal);
    const gold = hexToRgb(cfg.color_gold);
    if (teal) {
      root.style.setProperty('--brand-teal', teal.join(' '));
      root.style.setProperty('--brand-teal-bright', lighten(teal, 0.14).join(' '));
      const [h, s, l] = rgbToHsl(...teal);
      root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    }
    if (gold) {
      root.style.setProperty('--brand-gold', gold.join(' '));
      const [h, s, l] = rgbToHsl(...gold);
      root.style.setProperty('--accent', `${h} ${s}% ${l}%`);
    }
  }, [cfg?.color_teal, cfg?.color_gold]);
  return null;
}
