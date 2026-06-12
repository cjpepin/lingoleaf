import { openDemoDb, type DemoDb } from '@portfolio/demo-local';

const APP_ID = 'lingoleaf';
const SCHEMA_VERSION = 1;

let dbPromise: ReturnType<typeof openDemoDb> | null = null;

export async function getDb(): Promise<DemoDb> {
  if (!dbPromise) {
    dbPromise = openDemoDb(APP_ID, SCHEMA_VERSION);
  }
  return dbPromise;
}
