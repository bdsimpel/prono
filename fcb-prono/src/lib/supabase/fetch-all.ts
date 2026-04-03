import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch all rows from a Supabase table, paginating past the 1000-row server limit.
 * Use this for tables that may exceed 1000 rows (predictions, extra_predictions, match_events).
 */
export async function fetchAll<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  columns = "*",
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(`[fetchAll] Error fetching ${table} (offset ${from}):`, error);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
