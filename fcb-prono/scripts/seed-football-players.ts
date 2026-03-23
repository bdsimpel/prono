import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  console.error('Set them in ../.env or pass them directly')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface PlayerRow {
  name: string
  team: string
  position: string
  goals: number
  assists: number
  clean_sheets: number | null
}

async function main() {
  const xlsxPath = path.resolve(__dirname, '../../data/Players.xlsx')
  const workbook = XLSX.readFile(xlsxPath)

  // Fetch team names from DB to filter and map sheet names
  const { data: teams, error: teamsError } = await supabase.from('teams').select('name')
  if (teamsError || !teams) {
    console.error('Error fetching teams:', teamsError)
    process.exit(1)
  }
  const dbTeamNames = teams.map(t => t.name as string)

  // Map sheet name to DB team name using fuzzy/contains matching
  function matchTeamName(sheetName: string): string | null {
    // Exact match first
    const exact = dbTeamNames.find(t => t === sheetName)
    if (exact) return exact

    // DB name contained in sheet name (e.g. "Mechelen" in "KV Mechelen")
    const contained = dbTeamNames.find(t => sheetName.includes(t))
    if (contained) return contained

    // Sheet name contained in DB name
    const reverse = dbTeamNames.find(t => t.includes(sheetName))
    if (reverse) return reverse

    return null
  }

  const allPlayers: PlayerRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const dbTeamName = matchTeamName(sheetName)
    if (!dbTeamName) {
      console.warn(`Sheet "${sheetName}" does not match any team in DB, skipping`)
      continue
    }
    const sheet = workbook.Sheets[sheetName]
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })

    // Find the main player table (first header row with "Player")
    let mainHeaderIdx = -1
    let keeperHeaderIdx = -1

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row && String(row[0]).trim() === 'Player') {
        if (mainHeaderIdx === -1) {
          mainHeaderIdx = i
        } else {
          keeperHeaderIdx = i
        }
      }
    }

    if (mainHeaderIdx === -1) {
      console.warn(`No player table found in sheet "${sheetName}", skipping`)
      continue
    }

    // Parse main player table headers
    const mainHeaders = (rows[mainHeaderIdx] as string[]).map(h => String(h ?? '').trim())
    const posCol = mainHeaders.indexOf('Pos')
    const glsCol = mainHeaders.indexOf('Gls')
    const astCol = mainHeaders.indexOf('Ast')

    // Parse keeper table to get clean sheets
    const keeperCS: Record<string, number> = {}
    if (keeperHeaderIdx !== -1) {
      const keeperHeaders = (rows[keeperHeaderIdx] as string[]).map(h => String(h ?? '').trim())
      const csCol = keeperHeaders.indexOf('CS')

      for (let i = keeperHeaderIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        if (!row || !row[0] || String(row[0]).trim() === '') break
        const name = String(row[0]).trim()
        const cs = csCol !== -1 ? Number(row[csCol]) || 0 : 0
        keeperCS[name] = cs
      }
    }

    // Parse main player rows
    for (let i = mainHeaderIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[0] || String(row[0]).trim() === '') break

      // Stop if we hit the keeper header
      if (keeperHeaderIdx !== -1 && i >= keeperHeaderIdx) break

      const name = String(row[0]).trim()
      const pos = posCol !== -1 ? String(row[posCol] ?? '').trim() : ''
      const goals = glsCol !== -1 ? Number(row[glsCol]) || 0 : 0
      const assists = astCol !== -1 ? Number(row[astCol]) || 0 : 0

      const isGK = pos === 'GK'
      const cleanSheets = isGK ? (keeperCS[name] ?? 0) : null

      allPlayers.push({
        name,
        team: dbTeamName,
        position: pos,
        goals,
        assists,
        clean_sheets: cleanSheets,
      })
    }

    console.log(`Parsed ${sheetName}: found players up to keeper table`)
  }

  console.log(`\nTotal players: ${allPlayers.length}`)

  // Truncate and insert
  const { error: deleteError } = await supabase.from('football_players').delete().neq('id', 0)
  if (deleteError) {
    console.error('Error truncating:', deleteError)
    process.exit(1)
  }

  // Insert in batches of 50
  for (let i = 0; i < allPlayers.length; i += 50) {
    const batch = allPlayers.slice(i, i + 50)
    const { error } = await supabase.from('football_players').insert(batch)
    if (error) {
      console.error(`Error inserting batch at ${i}:`, error)
      process.exit(1)
    }
  }

  console.log(`Inserted ${allPlayers.length} players into football_players`)
}

main().catch(console.error)
