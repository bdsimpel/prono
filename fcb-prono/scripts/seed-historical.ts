import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// Load .env.local first
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      // Strip surrounding quotes if present
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same NAME_MAP as generate_leaderboard.py for normalization
const NAME_MAP: Record<string, string> = {
  "Vicky Dhaen": "Vicky D'haen",
  "Vicky D'haen": "Vicky D'haen",
  "Lize Van Assche": "Lize van Assche",
  "Lize Vanassche": "Lize van Assche",
  "Nelly Van Acker": "Nelly Van Acker",
  "Nelly Vanacker": "Nelly Van Acker",
  "Gina Demaertelaere": "Gina De Maertelaere",
  "Gina De Maertelaere": "Gina De Maertelaere",
  "Noa Van de Brande": "Noa Van den Brande",
  "Pieter De Raeymaecker": "Pierre De Raeymaecker",
  "Jef D'haen": "Jef D'haen",
  "Yvan Lammes": "Yvan Lammens",
};

const YEARS = [2019, 2021, 2022, 2023, 2024, 2025];
const LABELS: Record<number, string> = {
  2019: "2018-2019",
  2021: "2020-2021",
  2022: "2021-2022",
  2023: "2022-2023",
  2024: "2023-2024",
  2025: "2024-2025",
  2026: "2025-2026",
};

function normalizeName(name: string): string {
  return NAME_MAP[name] ?? name;
}

function levenshtein(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const la = a.toLowerCase().trim().replace(/\s+/g, " ");
  const lb = b.toLowerCase().trim().replace(/\s+/g, " ");
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshtein(la, lb)) / maxLen;
}

async function main() {
  const xlsxPath = path.resolve(__dirname, "../../data/fcb_prono_leaderboard.xlsx");
  if (!fs.existsSync(xlsxPath)) {
    console.error(`Excel file not found: ${xlsxPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(xlsxPath);

  // --- Parse Overview sheet ---
  const overview = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Overview"]
  );

  // --- Parse Year Stats sheet ---
  const yearStats = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Year Stats"]
  );

  const yearStatsMap: Record<number, { max_points: number; player_count: number }> = {};
  for (const row of yearStats) {
    const year = Number(row["Year"]);
    yearStatsMap[year] = {
      max_points: Number(row["Max Points"]),
      player_count: Number(row["Players"]),
    };
  }

  // --- Parse Z-Score sheet ---
  const zScoreSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Z-Score"]
  );
  const zScoreMap: Record<string, Record<number, number>> = {};
  for (const row of zScoreSheet) {
    const name = String(row["Player"]);
    zScoreMap[name] = {};
    for (const year of YEARS) {
      const val = row[`${year} Z`];
      if (val !== undefined && val !== "-") zScoreMap[name][year] = Number(val);
    }
  }

  // --- Parse Percentile Rank sheet ---
  const pctlSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Percentile Rank"]
  );
  const pctlMap: Record<string, Record<number, number>> = {};
  for (const row of pctlSheet) {
    const name = String(row["Player"]);
    pctlMap[name] = {};
    for (const year of YEARS) {
      const val = row[`${year} Pctl`];
      if (val !== undefined && val !== "-") pctlMap[name][year] = Number(val);
    }
  }

  // --- Parse Points % sheet ---
  const pctSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Points %"]
  );
  const pointsPctMap: Record<string, Record<number, number>> = {};
  for (const row of pctSheet) {
    const name = String(row["Player"]);
    pointsPctMap[name] = {};
    for (const year of YEARS) {
      const val = row[`${year} %`];
      if (val !== undefined && val !== "-") pointsPctMap[name][year] = Number(val);
    }
  }

  // --- Parse Combined Ranking sheet ---
  const combinedSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Combined Ranking"]
  );

  // ========== STEP 1: Clear existing data ==========
  console.log("Clearing existing historical data...");
  await supabase.from("edition_scores").delete().neq("id", 0);
  await supabase.from("alltime_scores").delete().neq("id", 0);
  await supabase.from("editions").delete().neq("id", 0);

  // ========== STEP 2: Insert editions ==========
  console.log("Inserting editions...");
  const editionRows = YEARS.map((year) => ({
    year,
    label: LABELS[year],
    max_points: yearStatsMap[year]?.max_points ?? null,
    player_count: yearStatsMap[year]?.player_count ?? 0,
    is_current: false,
  }));

  // Also insert 2026 as current edition
  editionRows.push({
    year: 2026,
    label: LABELS[2026],
    max_points: 400,
    player_count: 0, // will be set by counting current players
    is_current: true,
  });

  const { data: insertedEditions, error: edErr } = await supabase
    .from("editions")
    .insert(editionRows)
    .select();

  if (edErr) {
    console.error("Failed to insert editions:", edErr);
    process.exit(1);
  }

  const editionIdMap: Record<number, number> = {};
  for (const ed of insertedEditions!) {
    editionIdMap[ed.year] = ed.id;
  }

  // Update current edition player_count from existing players
  const { count: currentPlayerCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  if (currentPlayerCount) {
    await supabase
      .from("editions")
      .update({ player_count: currentPlayerCount })
      .eq("year", 2026);
  }

  // ========== STEP 3: Insert edition_scores ==========
  console.log("Inserting edition scores...");
  const editionScoreRows: {
    edition_id: number;
    player_name: string;
    rank: number;
    total_score: number;
    z_score: number | null;
    percentile: number | null;
    points_pct: number | null;
  }[] = [];

  for (const row of overview) {
    const playerName = String(row["Player"]);
    for (const year of YEARS) {
      const rankKey = `${year} Rank`;
      const ptsKey = `${year} Pts`;
      const rankVal = row[rankKey];
      const ptsVal = row[ptsKey];
      if (rankVal !== undefined && rankVal !== "-" && ptsVal !== undefined && ptsVal !== "-") {
        editionScoreRows.push({
          edition_id: editionIdMap[year],
          player_name: playerName,
          rank: Number(rankVal),
          total_score: Number(ptsVal),
          z_score: zScoreMap[playerName]?.[year] ?? null,
          percentile: pctlMap[playerName]?.[year] ?? null,
          points_pct: pointsPctMap[playerName]?.[year] ?? null,
        });
      }
    }
  }

  // Insert in batches of 100
  for (let i = 0; i < editionScoreRows.length; i += 100) {
    const batch = editionScoreRows.slice(i, i + 100);
    const { error } = await supabase.from("edition_scores").insert(batch);
    if (error) {
      console.error(`Failed to insert edition_scores batch ${i}:`, error);
    }
  }
  console.log(`Inserted ${editionScoreRows.length} edition scores.`);

  // ========== STEP 4: Insert alltime_scores ==========
  console.log("Inserting alltime scores...");
  const alltimeRows: {
    player_name: string;
    years_played: number;
    avg_z_score: number | null;
    avg_percentile: number | null;
    avg_points_pct: number | null;
    combined_score: number | null;
    best_rank: number | null;
    best_rank_year: number | null;
  }[] = [];

  for (const row of combinedSheet) {
    const playerName = String(row["Player"]);
    const yearsPlayed = Number(row["Years Played"]);
    const avgZ = row["Avg Z-Score"] !== undefined ? Number(row["Avg Z-Score"]) : null;
    const avgP = row["Avg Percentile"] !== undefined ? Number(row["Avg Percentile"]) : null;
    const avgPct = row["Avg Points %"] !== undefined ? Number(row["Avg Points %"]) : null;
    const combinedScore = row["Combined Score"] !== undefined ? Number(row["Combined Score"]) : null;

    // Find best rank from edition_scores
    let bestRank: number | null = null;
    let bestRankYear: number | null = null;
    for (const es of editionScoreRows) {
      if (es.player_name === playerName) {
        if (bestRank === null || es.rank < bestRank) {
          bestRank = es.rank;
          const edition = insertedEditions!.find((e) => e.id === es.edition_id);
          bestRankYear = edition?.year ?? null;
        }
      }
    }

    alltimeRows.push({
      player_name: playerName,
      years_played: yearsPlayed,
      avg_z_score: avgZ,
      avg_percentile: avgP,
      avg_points_pct: avgPct,
      combined_score: combinedScore,
      best_rank: bestRank,
      best_rank_year: bestRankYear,
    });
  }

  const { error: atErr } = await supabase.from("alltime_scores").insert(alltimeRows);
  if (atErr) {
    console.error("Failed to insert alltime_scores:", atErr);
  }
  console.log(`Inserted ${alltimeRows.length} alltime scores.`);

  // ========== STEP 5: Match existing players to historical names ==========
  console.log("Matching existing players to historical names...");
  const { data: players } = await supabase
    .from("players")
    .select("id, display_name");

  const historicalNames = alltimeRows.map((r) => r.player_name);

  let matchCount = 0;
  for (const player of players || []) {
    let bestMatch = "";
    let bestSim = 0;
    for (const hName of historicalNames) {
      const sim = similarity(player.display_name, hName);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = hName;
      }
    }
    if (bestSim >= 0.85) {
      await supabase
        .from("players")
        .update({ matched_historical_name: bestMatch })
        .eq("id", player.id);
      console.log(`  ${player.display_name} -> ${bestMatch} (${(bestSim * 100).toFixed(0)}%)`);
      matchCount++;
    }
  }
  console.log(`Matched ${matchCount} of ${players?.length ?? 0} players.`);

  console.log("\nDone! Historical data seeded successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
