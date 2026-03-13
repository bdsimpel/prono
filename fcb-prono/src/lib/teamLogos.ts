const teamLogoMap: Record<string, string> = {
  'Genk': '/teams/genk.png',
  'Club Brugge': '/teams/club-brugge.png',
  'Union': '/teams/union.png',
  'Anderlecht': '/teams/anderlecht.png',
  'Gent': '/teams/gent.png',
  'Antwerp': '/teams/antwerp.png',
}

export function getTeamLogo(teamName: string): string | null {
  return teamLogoMap[teamName] ?? null
}
