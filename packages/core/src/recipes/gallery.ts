/**
 * Re-export of the recipe catalog. The 64 recipe records + tiers live in catalog.ts (the data file);
 * this thin module keeps the historical `gallery` import path working.
 */
export * from './catalog.ts';
