#!/usr/bin/env python3
"""
Generate SQL INSERT statements for matches from games.xlsx.
Run: python scripts/generate-seed.py > seed-matches.sql

Update games.xlsx with new season data, then re-run this script.
"""
import pandas as pd
import os

# Team name -> Supabase team ID mapping
# Must match the teams table: Genk=1, Club Brugge=2, Union=3, Anderlecht=4, Gent=5, Antwerp=6
TEAM_IDS = {
    "Genk": 1,
    "Club Brugge": 2,
    "Union": 3,
    "Anderlecht": 4,
    "Gent": 5,
    "Antwerp": 6,
}

# Cup final teams (update per season)
CUP_FINAL_HOME = "Anderlecht"
CUP_FINAL_AWAY = "Club Brugge"

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    prono_root = os.path.dirname(root)
    games_path = os.path.join(prono_root, "src", "prono_2025", "input", "games.xlsx")

    df = pd.read_excel(games_path)

    print("-- Auto-generated from games.xlsx")
    print("-- Run this AFTER creating tables (supabase-schema.sql)")
    print("-- To refresh: DELETE FROM results; DELETE FROM predictions; DELETE FROM matches;")
    print()
    print("DELETE FROM matches;")
    print()
    print("INSERT INTO matches (home_team_id, away_team_id, speeldag, match_datetime, is_cup_final) VALUES")

    lines = []
    for _, row in df.iterrows():
        home = row["home_team"].strip()
        away = row["away_team"].strip()
        home_id = TEAM_IDS[home]
        away_id = TEAM_IDS[away]
        speeldag = int(row["speeldag"])
        dt = pd.Timestamp(row["datetime"]).strftime("%Y-%m-%dT%H:%M:%SZ")
        lines.append(f"  ({home_id}, {away_id}, {speeldag}, '{dt}', false)")

    # Cup final
    lines.append(f"  ({TEAM_IDS[CUP_FINAL_HOME]}, {TEAM_IDS[CUP_FINAL_AWAY]}, NULL, NULL, true)")

    print(",\n".join(lines) + ";")


if __name__ == "__main__":
    main()
