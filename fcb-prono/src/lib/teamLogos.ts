const teamLogoMap: Record<string, string> = {
  'Union': '/teams/union.png',
  'Club Brugge': '/teams/club-brugge.png',
  'STVV': '/teams/stvv.png',
  'Anderlecht': '/teams/anderlecht.png',
  'Gent': '/teams/gent.png',
  'Mechelen': '/teams/mechelen.png',
}

export function getTeamLogo(teamName: string): string | null {
  return teamLogoMap[teamName] ?? null
}
