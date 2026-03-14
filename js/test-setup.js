import { vi } from 'vitest';

// Silence console.log during tests — the prediction engine is chatty.
// console.warn and console.error are left intact so real issues surface.
vi.spyOn(console, 'log').mockImplementation(() => {});
