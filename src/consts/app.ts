import { Space_Grotesk as SpaceGrotesk } from 'next/font/google';
import { Color } from '../styles/Color';

export const MAIN_FONT = SpaceGrotesk({
  subsets: ['latin'],
  variable: '--font-main',
  preload: true,
  fallback: ['sans-serif'],
});
export const APP_NAME = 'Dreams Bridge';
export const APP_DESCRIPTION = 'Dreams Bridge is a DApp for Hyperlane Warp Route transfers';
// Public base URL used for Open Graph and wallet metadata
export const APP_URL = 'https://bridge.daydreams.systems';
export const BRAND_COLOR = Color.primary['500'];

// Background
const DEFAULT_BACKGROUND_COLOR = Color.primary['500'];
const DEFAULT_BACKGROUND_IMAGE = 'url(/backgrounds/main.svg)';

// Allow overrides via NEXT_PUBLIC_ env vars
export const BACKGROUND_COLOR =
  process.env.NEXT_PUBLIC_BACKGROUND_COLOR ?? DEFAULT_BACKGROUND_COLOR;
export const BACKGROUND_IMAGE =
  process.env.NEXT_PUBLIC_BACKGROUND_IMAGE ?? DEFAULT_BACKGROUND_IMAGE;
