import requests
from bs4 import BeautifulSoup
import pandas as pd
from enum import Enum
import os

# URL of the Voetbalkrant Play-off 1 statistics
url = "https://www.voetbalkrant.com/belgie/play-off-1/statistieken"

# Send a GET request
response = requests.get(url)
response.raise_for_status()

# Parse the HTML content
soup = BeautifulSoup(response.text, "html.parser")


class Category(str, Enum):
    # has a fixed first row
    # Rank, Player, Team, Value
    Topschutter = "Topschutter"
    # Rank, Player, Team, Value
    Meeste_assists = "Meeste assists"
    # has a fixed first row
    # Rank, Team, Number of games, Points lost (but we convert to Points Won)
    Minste_verliespunten = "Minste verliespunten"
    # has a fixed first row
    # Rank, Team, Number of games, Goals scored
    Meeste_doelpunten_gescoord = "Meeste doelpunten gescoord"
    # has a fixed first row
    # Rank, Team, Number of games, Goals conceded
    Beste_verdediging = "Beste verdediging"
    # has a fixed first row
    # Rank, Team, Number of games, Clean sheets
    Clean_sheets = "Clean sheets"  # in table aantal keer ...


# List of teams for categorization
class Team(str, Enum):
    Club_Brugge = "Club Brugge"
    Genk = "Genk"
    Union = "Union"
    Anderlecht = "Anderlecht"
    Gent = "Gent"
    Antwerp = "Antwerp"


# Map teams to their primary goalkeepers
team_to_keeper = {
    Team.Anderlecht: "Coosemans",
    Team.Antwerp: "Lammens",
    Team.Club_Brugge: "Mignolet",
    Team.Gent: "Vandenberghe",
    Team.Union: "Moris",
    Team.Genk: "Penders",
}

# Map team names as they appear in scraping results to our enum values
team_enum_mapping = {
    "Club Brugge": Team.Club_Brugge,
    "KRC Genk": Team.Genk,
    "Union SG": Team.Union,
    "Anderlecht": Team.Anderlecht,
    "KAA Gent": Team.Gent,
    "Antwerp": Team.Antwerp,
    "Royal Antwerp FC": Team.Antwerp,
    "RSC Anderlecht": Team.Anderlecht,
    "KRC Genk": Team.Genk,
    "Union Saint-Gilloise": Team.Union,
    "Club Brugge KV": Team.Club_Brugge,
    "KAA Gent": Team.Gent,
}

# Comprehensive name mapping for all player variations to standardized names
player_name_mapping = {
    # Topscorers
    "David Promise": "Promise",
    "Promise David": "Promise",
    "Tzolis Christos": "Tzolis",
    "Dolberg Kasper": "Dolberg",
    "Kasper Dolberg": "Dolberg",
    "Vermant Romeo": "Vermant",
    "Ivanovic Franjo": "Ivanovic",
    "Arokodare Toluwalase": "Tolu",
    "Ait El Hadj Anouar": "Ait El Hadj",
    "Oh Hyun-Gyu": "Oh",
    "Balikwisha Michel Ange": "Balikwisha",
    "Fadiga Noah": "Fadiga",
    "Khalaili Anan": "Khalaili",
    "Sor Yira Collins": "Sor",
    "Janssen Vincent": "Janssen",
    "Skoras Filip": "Skoras",
    # Assists
    "Leoni Theo": "Leoni",
    "Castro-Montes Alessio": "Castro-Montes",
    "N'Diaye Moussa": "N'Diaye",
    "Hrosovský Patrik": "Hrosovský",
    "Adedeji-Sternberg Noah": "Adedeji-Sternberg",
    "Steuckers Jarne": "Steuckers",
    "Vanaken Hans": "Vanaken",
    "Hans Vanaken": "Vanaken",
    "Kums Sven": "Kums",
    "Heynen Bryan": "Heynen",
    "Huerta Anders": "Huerta",
    "Chery Tjaronn": "Chery",
    "Karetsas Dimitrios": "Karetsas",
    "Kerk Gyrano": "Kerk",
    "Onyedika Raphael": "Onyedika",
    "Bonsu Ba Amadou": "Bonsu Ba",
    "Jashari Ardon": "Jashari",
    "Sabbe Matisse": "Sabbe",
    # Goalkeepers
    "Mignolet Simon": "Mignolet",
    "Simon Mignolet": "Mignolet",
    "Moris Anthony": "Moris",
    "Morris Anthony": "Moris",
    "Coosemans Colin": "Coosemans",
    "Penders Mike": "Penders",
    "Lammens Senne": "Lammens",
    "Jackers Nordin": "Jackers",
    "Van Crombrugge Hendrik": "Van Crombrugge",
    "Vandenberghe Davy": "Vandenberghe",
}


# Function to parse a stats table
def parse_stats_table(heading_text, value_column_name="Value"):
    heading = soup.find("h2", string=heading_text)
    table = heading.find_next("table") if heading else None

    data = []
    if table:
        if heading_text == Category.Topschutter:
            rows = table.find_all("tr")[1:]  # Skip header
        else:
            rows = table.find_all("tr")
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 4:
                rank = cols[0].text.strip().rstrip(".")
                player = cols[1].text.strip()
                # Map the player name to standardized name if available
                player = player_name_mapping.get(player, player)

                team = cols[2].text.strip()
                # Map the team name to our enum values if available
                team = team_enum_mapping.get(team, team)

                stat_value = cols[3].text.strip()

                data.append([int(rank), player, team, int(stat_value)])

    # Create column names with the specified value column name
    columns = ["Rank", "Player", "Team", value_column_name]

    # Convert to DataFrame
    return pd.DataFrame(data, columns=columns)


# Function to parse team stats tables
def parse_team_stats_table(heading_text, value_column_name="Value"):
    heading = soup.find("h2", string=heading_text)

    # For Clean_sheets, we need to find it differently as it's in the "Aantal keer..." section
    if heading_text == Category.Clean_sheets:
        anchor = soup.find("a", {"name": "statsMostTimesCleansheets"})
        table = anchor.find_next("table") if anchor else None
    else:
        table = heading.find_next("table") if heading else None

    data = []
    if table:
        rows = table.find_all("tr")[1:]  # Skip header
        for row in rows:
            cols = row.find_all("td")
            if len(cols) >= 4:
                rank = cols[0].text.strip().rstrip(".")
                team_element = cols[1].find("a")
                team = (
                    team_element.text.strip() if team_element else cols[1].text.strip()
                )
                # Map team names to our standardized enum values
                team_enum = team_enum_mapping.get(team, team)

                games = cols[2].text.strip()
                stat_value = cols[3].text.strip()

                # Try to convert to int, handle special cases
                try:
                    stat_value_int = int(stat_value)
                except ValueError:
                    # Handle special values like scientific notation or non-numeric values
                    if (
                        heading_text == Category.Minste_verliespunten
                        and "E-" in stat_value
                    ):
                        stat_value_int = 0  # Scientific notation near zero
                    else:
                        # Try to handle cases like "-1" (negative values)
                        try:
                            stat_value_int = float(stat_value)
                        except ValueError:
                            stat_value_int = stat_value  # Keep as string if not numeric

                data.append([int(rank), team_enum, int(games), stat_value_int])

    # Create column names with the specified value column name
    columns = ["Rank", "Team", "Games", value_column_name]

    # Convert to DataFrame
    return pd.DataFrame(data, columns=columns)


# Create output directory
output_dir = os.path.join(
    os.path.dirname(__file__),
    "input",
    "stats",
)
os.makedirs(output_dir, exist_ok=True)

# Parse top scorers
scorers_df = parse_stats_table("Topschutter", "Goals")
if not scorers_df.empty:
    print("Top Scorers:")
    print(scorers_df)
    # Save to CSV
    scorers_df.to_csv(os.path.join(output_dir, "topscorers.csv"), index=False)

# Parse most assists
assists_df = parse_stats_table("Meeste assists", "Assists")
if not assists_df.empty:
    print("\nMost Assists:")
    print(assists_df)
    # Save to CSV
    assists_df.to_csv(os.path.join(output_dir, "assists.csv"), index=False)

# Parse team statistics
# Points won (calculated from least points lost)
points_lost_df = parse_team_stats_table(Category.Minste_verliespunten, "Points_Lost")
if not points_lost_df.empty:
    # Calculate points won (3 * games - points_lost)
    points_won_df = points_lost_df.copy()
    points_won_df["Points_Won"] = points_won_df.apply(
        lambda row: 3 * row["Games"] - row["Points_Lost"], axis=1
    )

    # Drop the Points_Lost column
    points_won_df = points_won_df.drop(columns=["Points_Lost"])

    print("\nPoints Won:")
    print(points_won_df)

    # Save to CSV
    points_won_df.to_csv(os.path.join(output_dir, "points_won.csv"), index=False)

# Most goals scored
goals_scored_df = parse_team_stats_table(
    Category.Meeste_doelpunten_gescoord, "Goals_Scored"
)
if not goals_scored_df.empty:
    print("\nMost Goals Scored:")
    print(goals_scored_df)
    # Save to CSV
    goals_scored_df.to_csv(
        os.path.join(output_dir, "most_goals_scored.csv"), index=False
    )

# Best defense (fewest goals conceded)
best_defense_df = parse_team_stats_table(Category.Beste_verdediging, "Goals_Conceded")
if not best_defense_df.empty:
    print("\nBest Defense:")
    print(best_defense_df)
    # Save to CSV
    best_defense_df.to_csv(os.path.join(output_dir, "best_defense.csv"), index=False)

# Clean sheets
clean_sheets_df = parse_team_stats_table(Category.Clean_sheets, "Clean_Sheets")
if not clean_sheets_df.empty:
    print("\nClean Sheets:")
    print(clean_sheets_df)
    # Save to CSV
    clean_sheets_df.to_csv(os.path.join(output_dir, "clean_sheets.csv"), index=False)

    # Create a dataframe that maps teams with clean sheets to their goalkeepers
    keeper_clean_sheets = []
    for _, row in clean_sheets_df.iterrows():
        team = row["Team"]
        # If the team is in our enum mapping, get the corresponding goalkeeper
        if isinstance(team, Team):
            keeper = team_to_keeper.get(team)
            if keeper:
                keeper_clean_sheets.append(
                    {
                        "Team": team.value,
                        "Goalkeeper": keeper,
                        "Clean_Sheets": row["Clean_Sheets"],
                    }
                )

    # Create and save the keeper-to-clean-sheets mapping
    if keeper_clean_sheets:
        keeper_df = pd.DataFrame(keeper_clean_sheets)
        print("\nGoalkeeper Clean Sheets:")
        print(keeper_df)
        keeper_df.to_csv(
            os.path.join(output_dir, "goalkeeper_clean_sheets.csv"), index=False
        )
