import { isNativeApp } from "./mobile-platform";

export type StoredAppData<TProfile, TFriend, TSettings = undefined> = {
  profile: TProfile | null;
  friends: TFriend[];
  settings?: TSettings;
};

const STORAGE_KEY = "tomotype-public-data-v1";
const DATABASE_NAME = "tomotype_public";
let nativeOperation: Promise<void> = Promise.resolve();

function runNativeOperation<T>(operation: () => Promise<T>) {
  const result = nativeOperation.then(operation, operation);
  nativeOperation = result.then(() => undefined, () => undefined);
  return result;
}

async function getNativeDatabase() {
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistency = await sqlite.checkConnectionsConsistency();
  const existing = await sqlite.isConnection(DATABASE_NAME, false);
  if (!consistency.result && existing.result) await sqlite.closeConnection(DATABASE_NAME, false);
  const db = existing.result && consistency.result
    ? await sqlite.retrieveConnection(DATABASE_NAME, false)
    : await sqlite.createConnection(DATABASE_NAME, false, "no-encryption", 1, false);
  await db.open();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return { sqlite, db };
}

export async function loadDeviceData<TProfile, TFriend, TSettings = undefined>(): Promise<StoredAppData<TProfile, TFriend, TSettings> | null> {
  if (!isNativeApp()) {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as StoredAppData<TProfile, TFriend, TSettings> : null;
  }
  return runNativeOperation(async () => {
    const { sqlite, db } = await getNativeDatabase();
    try {
      const result = await db.query("SELECT json FROM app_state WHERE id = 1 LIMIT 1;");
      const raw = result.values?.[0]?.json;
      return typeof raw === "string" ? JSON.parse(raw) as StoredAppData<TProfile, TFriend, TSettings> : null;
    } finally {
      await db.close();
      await sqlite.closeConnection(DATABASE_NAME, false);
    }
  });
}

export async function saveDeviceData<TProfile, TFriend, TSettings = undefined>(data: StoredAppData<TProfile, TFriend, TSettings>) {
  const json = JSON.stringify(data);
  if (!isNativeApp()) {
    localStorage.setItem(STORAGE_KEY, json);
    return;
  }
  await runNativeOperation(async () => {
    const { sqlite, db } = await getNativeDatabase();
    try {
      await db.run(
        "INSERT OR REPLACE INTO app_state (id, json, updated_at) VALUES (1, ?, ?);",
        [json, new Date().toISOString()],
      );
    } finally {
      await db.close();
      await sqlite.closeConnection(DATABASE_NAME, false);
    }
  });
}

export async function clearDeviceData() {
  if (!isNativeApp()) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  await runNativeOperation(async () => {
    const { sqlite, db } = await getNativeDatabase();
    try {
      await db.run("DELETE FROM app_state WHERE id = 1;");
    } finally {
      await db.close();
      await sqlite.closeConnection(DATABASE_NAME, false);
    }
  });
}
