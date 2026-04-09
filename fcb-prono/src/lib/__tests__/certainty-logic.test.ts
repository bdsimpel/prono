import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCleanSheetLeaderCertain, isBestTeamLeaderCertain } from '../playoff-stats'

// Helper to build clean sheet test data
function csTest(
  gks: { name: string; teamId: number; cs: number }[],
  teamRemaining: Record<number, number>, // teamId → remaining matches
) {
  const allTeamIds = new Set([
    ...gks.map(g => g.teamId),
    ...Object.keys(teamRemaining).map(Number),
  ])
  const teams = [...allTeamIds].map(id => ({
    id,
    remainingMatches: teamRemaining[id] ?? 0,
  }))
  const gkTeams: Record<string, number> = {}
  const playerCleanSheets: Record<string, number> = {}
  for (const g of gks) {
    gkTeams[g.name] = g.teamId
    playerCleanSheets[g.name] = g.cs
  }
  const maxCS = Math.max(...Object.values(playerCleanSheets))
  return { maxCS, teams, gkTeams, playerCleanSheets }
}

describe('isCleanSheetLeaderCertain', () => {
  it('1: leader=2, others=0 with 2 remaining each → certain (can only tie)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 0 }],
      { 1: 2, 2: 2 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('2: leader=2, others=0 with 3 remaining → not certain (0+3=3 > 2)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 0 }],
      { 1: 0, 2: 3 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })

  it('3: tied leaders GK_A=2 GK_B=2, B has 1 remaining → not certain (B could reach 3)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 2 }],
      { 1: 0, 2: 1 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })

  it('4: tied leaders GK_A=2 GK_B=2, neither has remaining → certain (final tie)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 2 }],
      { 1: 0, 2: 0 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('5: leader=3, others=1 with 1 remaining → certain (1+1=2 < 3)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 3 }, { name: 'GK_B', teamId: 2, cs: 1 }],
      { 1: 0, 2: 1 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('6: all matches played, sole leader → certain', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 4 }, { name: 'GK_B', teamId: 2, cs: 1 }],
      { 1: 0, 2: 0 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('7: 3 teams, different remaining: A=3(0rem), B=1(1rem), C=0(3rem) → certain (C can only tie at 3)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 3 }, { name: 'GK_B', teamId: 2, cs: 1 }, { name: 'GK_C', teamId: 3, cs: 0 }],
      { 1: 0, 2: 1, 3: 3 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('8: 3 teams: A=3(0rem), B=1(1rem), C=0(4rem) → not certain (C: 0+4=4 > 3)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 3 }, { name: 'GK_B', teamId: 2, cs: 1 }, { name: 'GK_C', teamId: 3, cs: 0 }],
      { 1: 0, 2: 1, 3: 4 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })

  it('9: A=2(0rem), B=0(2rem), C=0(3rem) → not certain (C: 0+3=3 > 2)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 0 }, { name: 'GK_C', teamId: 3, cs: 0 }],
      { 1: 0, 2: 2, 3: 3 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })

  it('10: A=2(0rem), B=0(1rem), C=1(1rem) → certain (B:0+1=1, C:1+1=2, only ties)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }, { name: 'GK_B', teamId: 2, cs: 0 }, { name: 'GK_C', teamId: 3, cs: 1 }],
      { 1: 0, 2: 1, 3: 1 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('11: A=4(2rem), B=0(4rem), C=2(3rem) → not certain (C: 2+3=5 > 4)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 4 }, { name: 'GK_B', teamId: 2, cs: 0 }, { name: 'GK_C', teamId: 3, cs: 2 }],
      { 1: 2, 2: 4, 3: 3 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })

  it('12: A=5(1rem), B=3(2rem), C=1(4rem) → certain (B:3+2=5, C:1+4=5, only ties)', () => {
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 5 }, { name: 'GK_B', teamId: 2, cs: 3 }, { name: 'GK_C', teamId: 3, cs: 1 }],
      { 1: 1, 2: 2, 3: 4 },
    )
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), true)
  })

  it('handles team with no known GK (0 CS assumed)', () => {
    // Team 3 has no GK events but 3 remaining games
    const d = csTest(
      [{ name: 'GK_A', teamId: 1, cs: 2 }],
      { 1: 0, 2: 2, 3: 3 },
    )
    // Team 3 has no GK entry → 0 CS, 0+3=3 > 2 → not certain
    assert.equal(isCleanSheetLeaderCertain(d.maxCS, d.teams, d.gkTeams, d.playerCleanSheets), false)
  })
})

describe('isBestTeamLeaderCertain', () => {
  it('1: A=15(0rem), B=12(1rem) → certain (12+3=15, can only tie)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 15, remaining: 0 },
      { points: 12, remaining: 1 },
    ]), true)
  })

  it('2: A=15(0rem), B=12(2rem) → not certain (12+6=18 > 15)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 15, remaining: 0 },
      { points: 12, remaining: 2 },
    ]), false)
  })

  it('3: A=15(0rem), B=15(1rem) → not certain (tied leader B has remaining)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 15, remaining: 0 },
      { points: 15, remaining: 1 },
    ]), false)
  })

  it('4: A=15(0rem), B=15(0rem) → certain (tied, final)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 15, remaining: 0 },
      { points: 15, remaining: 0 },
    ]), true)
  })

  it('5: A=20(0rem), others ≤14 with max 1 remaining → certain', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 20, remaining: 0 },
      { points: 14, remaining: 1 },
      { points: 12, remaining: 1 },
    ]), true)
  })

  it('6: A=18(0rem), B=15(1rem), C=12(3rem) → not certain (C: 12+9=21 > 18)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 18, remaining: 0 },
      { points: 15, remaining: 1 },
      { points: 12, remaining: 3 },
    ]), false)
  })

  it('7: A=18(0rem), B=15(1rem), C=12(2rem) → certain (B:15+3=18, C:12+6=18, only ties)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 18, remaining: 0 },
      { points: 15, remaining: 1 },
      { points: 12, remaining: 2 },
    ]), true)
  })

  it('8: A=18(2rem), B=10(0rem), C=9(4rem) → not certain (C: 9+12=21 > 18)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 18, remaining: 2 },
      { points: 10, remaining: 0 },
      { points: 9, remaining: 4 },
    ]), false)
  })

  it('9: A=20(1rem), B=20(0rem) → not certain (tied leader A has remaining)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 20, remaining: 1 },
      { points: 20, remaining: 0 },
    ]), false)
  })

  it('10: A=20(0rem), B=20(0rem), C=14(2rem) → certain (C:14+6=20 only ties, leaders have 0 rem)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 20, remaining: 0 },
      { points: 20, remaining: 0 },
      { points: 14, remaining: 2 },
    ]), true)
  })

  it('11: A=20(0rem), B=20(1rem), C=14(2rem) → not certain (tied leader B has remaining)', () => {
    assert.equal(isBestTeamLeaderCertain([
      { points: 20, remaining: 0 },
      { points: 20, remaining: 1 },
      { points: 14, remaining: 2 },
    ]), false)
  })
})
