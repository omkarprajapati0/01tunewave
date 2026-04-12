import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://example.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "supabase-anon-key-not-configured";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
const MISSING_TABLES_STORAGE_KEY = "tunewave_missing_supabase_tables";
const IS_DEV = import.meta.env.DEV;

const getStorageKeyForCurrentSupabase = () => {
  const normalizedUrl = (SUPABASE_URL || "").toLowerCase();
  return `${MISSING_TABLES_STORAGE_KEY}:${normalizedUrl}`;
};

const readMissingSupabaseTables = () => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getStorageKeyForCurrentSupabase());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((table) => (table || "").toString().trim().toLowerCase())
      : [];
  } catch {
    return [];
  }
};

const writeMissingSupabaseTables = (tables) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getStorageKeyForCurrentSupabase(),
      JSON.stringify(tables),
    );
  } catch {
    return;
  }
};

export const isSupabaseTableMarkedMissing = (tableName) => {
  const key = (tableName || "").toString().trim().toLowerCase();
  if (!key) return false;
  return readMissingSupabaseTables().includes(key);
};

export const markSupabaseTableMissing = (tableName) => {
  const key = (tableName || "").toString().trim().toLowerCase();
  if (!key) return;

  const existing = new Set(readMissingSupabaseTables());
  if (existing.has(key)) return;
  existing.add(key);
  writeMissingSupabaseTables(Array.from(existing));
};

export const clearMarkedMissingSupabaseTables = () => {
  writeMissingSupabaseTables([]);
};

export const hasSupabaseEnvConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);

if (!hasSupabaseEnvConfig) {
  if (IS_DEV) {
    console.warn(
      "Supabase env vars are missing. Using non-production fallback values. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for production.",
    );
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
