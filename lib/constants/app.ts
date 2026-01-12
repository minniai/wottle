export const DEFAULT_APP_PORT = 3000;
export const APP_PORT = Number.parseInt(process.env.APP_PORT ?? String(DEFAULT_APP_PORT), 10);
export const BASE_URL = process.env.BASE_URL ?? `http://localhost:${APP_PORT}`;
