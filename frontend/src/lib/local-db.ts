export type JsonRecord = Record<string, any>;

export type LocalDatabase = {
  subscriptions: JsonRecord[];
  accounts: JsonRecord[];
  links: JsonRecord[];
  watchlist: JsonRecord[];
  reminders: JsonRecord[];
  promos: JsonRecord[];
  inbox: JsonRecord[];
  chatHistory: JsonRecord[];
  prompts: JsonRecord[];
  settings: JsonRecord | null;
};

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type LocalDb = {
  read<T>(reader: (db: LocalDatabase) => T | Promise<T>): Promise<T>;
  write(
    writer: (
      db: LocalDatabase,
    ) => { next: LocalDatabase; result: any } | Promise<{ next: LocalDatabase; result: any }>,
  ): Promise<any>;
};

export const LOCAL_DB_KEY = "submind.localdb.v1";

export function emptyDatabase(): LocalDatabase {
  return {
    subscriptions: [],
    accounts: [],
    links: [],
    watchlist: [],
    reminders: [],
    promos: [],
    inbox: [],
    chatHistory: [],
    prompts: [],
    settings: null,
  };
}

function asRows(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as JsonRecord[];
}

export function parseDatabase(raw: string | null): LocalDatabase {
  if (!raw) return emptyDatabase();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Local SubMind data is unreadable.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Local SubMind data is unreadable.");
  }
  const data = parsed as Partial<LocalDatabase>;
  return {
    subscriptions: asRows(data.subscriptions),
    accounts: asRows(data.accounts),
    links: asRows(data.links),
    watchlist: asRows(data.watchlist),
    reminders: asRows(data.reminders),
    promos: asRows(data.promos),
    inbox: asRows(data.inbox),
    chatHistory: asRows(data.chatHistory),
    prompts: asRows(data.prompts),
    settings:
      data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)
        ? (data.settings as JsonRecord)
        : null,
  };
}

export function createMemoryKv(initial: Record<string, string> = {}): KeyValueStore {
  const data: Record<string, string> = { ...initial };
  return {
    async getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    async setItem(key, value) {
      data[key] = value;
    },
  };
}

export function createLocalDb(kv: KeyValueStore, initialize?: (db: LocalDatabase) => LocalDatabase): LocalDb {
  let chain: Promise<unknown> = Promise.resolve();
  let snapshot: LocalDatabase | null = null;
  let initialized = false;

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = chain.then(work, work);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function load(): Promise<LocalDatabase> {
    let raw: string | null;
    try {
      raw = await kv.getItem(LOCAL_DB_KEY);
    } catch {
      if (snapshot) return snapshot;
      throw new Error("Could not read SubMind data on this phone.");
    }
    if (raw == null) {
      if (snapshot) return initializeOnce(snapshot);
      snapshot = emptyDatabase();
      return initializeOnce(snapshot);
    }
    snapshot = parseDatabase(raw);
    return initializeOnce(snapshot);
  }

  async function initializeOnce(current: LocalDatabase): Promise<LocalDatabase> {
    if (initialized || !initialize) return current;
    const next = initialize(current);
    if (next !== current) await persist(next);
    initialized = true;
    return next;
  }

  async function persist(db: LocalDatabase): Promise<void> {
    await kv.setItem(LOCAL_DB_KEY, JSON.stringify(db));
    snapshot = db;
  }

  return {
    read<T>(reader: (db: LocalDatabase) => T | Promise<T>): Promise<T> {
      return enqueue(async () => reader(await load()));
    },
    write(
      writer: (
        db: LocalDatabase,
      ) => { next: LocalDatabase; result: any } | Promise<{ next: LocalDatabase; result: any }>,
    ): Promise<any> {
      return enqueue(async () => {
        const { next, result } = await writer(await load());
        await persist(next);
        return result;
      });
    },
  };
}
