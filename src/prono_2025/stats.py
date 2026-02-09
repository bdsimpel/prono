import os
from enum import Enum, auto
from collections import Counter
from typing import Dict, List, Set, Tuple

name_mapping = {
    "Bonsu Ba": "Ba",
    "Chery": "Chery",
    "Coosemans": "Coosemans",
    "Dolberg": "Dolberg",
    "Hans": "Vanaken",
    "Hans Vanaken": "Vanaken",
    "Heynen": "Heynen",
    "Huerta": "Huerta",
    "Ivanovic": "Ivanovic",
    "Jackers": "Jackers",
    "Janssen": "Janssen",
    "Jashari": "Jashari",
    "Jutgla": "Jutgla",
    "Karetsas": "Karetsas",
    "Kasper Dolberg": "Dolberg",
    "Kerk": "Kerk",
    "Kums": "Kums",
    "Lammens": "Lammens",
    "Mignolet": "Mignolet",
    "Moris": "Moris",
    "Morris": "Moris",
    "Oh": "Oh",
    "Onyedika": "Onyedika",
    "Penders": "Penders",
    "Promise": "Promise",
    "Promise David": "Promise",
    "Sabbe": "Sabbe",
    "Simon Mignolet": "Mignolet",
    "Skoras": "Skoras",
    "Steuckers": "Steuckers",
    "Tolu": "Tolu",
    "Tzolis": "Tzolis",
    "Van Crombrugge": "Van Crombrugge",
    "Vanaken": "Vanaken",
}


class ExtraQuestion(Enum):
    BEKERWINNAAR = auto()
    BESTE_PLOEG_POI = auto()
    TOPSCORER_POI = auto()
    ASSISTENKONING_POI = auto()
    MEESTE_CLEAN_SHEETS_POI = auto()
    MEESTE_GEMAAKTE_GOALS_POI = auto()
    MINSTE_GOALS_TEGEN_POI = auto()
    KAMPIOEN = auto()

    @classmethod
    def from_string(cls, question: str) -> "ExtraQuestion":
        mapping = {
            "Bekerwinnaar": cls.BEKERWINNAAR,
            "Beste ploeg van POI": cls.BESTE_PLOEG_POI,
            "Topscorer POI": cls.TOPSCORER_POI,
            "Assistenkoning POI": cls.ASSISTENKONING_POI,
            "Meeste Clean Sheats POI": cls.MEESTE_CLEAN_SHEETS_POI,
            "Meeste gemaakte goals POI": cls.MEESTE_GEMAAKTE_GOALS_POI,
            "Minste goals tegen POI": cls.MINSTE_GOALS_TEGEN_POI,
            "Kampioen": cls.KAMPIOEN,
        }
        return mapping.get(question.strip())


def get_player_names_from_extra_questions() -> Dict[ExtraQuestion, List[str]]:
    """
    Extracts all player names from the extra questions in the prono submissions.
    Returns a dictionary mapping question types to lists of player names.
    Only includes questions that expect player names as answers.
    """
    # Find the spelers directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    spelers_dir = os.path.join(current_dir, "input", "spelers")

    # Questions that expect player names as answers
    player_questions = {
        ExtraQuestion.TOPSCORER_POI,
        ExtraQuestion.ASSISTENKONING_POI,
        ExtraQuestion.MEESTE_CLEAN_SHEETS_POI,
    }

    # Dictionary to store all player names by question
    all_players: Dict[ExtraQuestion, List[str]] = {
        question: [] for question in player_questions
    }

    # Process each player's CSV file
    for filename in os.listdir(spelers_dir):
        if not filename.endswith(".csv"):
            continue

        csv_path = os.path.join(spelers_dir, filename)

        try:
            with open(csv_path, "r", encoding="utf-8") as file:
                lines = file.readlines()

                # Extract player's answers to the extra questions
                for i, line in enumerate(lines):
                    if i < 10:  # Skip match predictions
                        continue

                    parts = line.strip().split(";")
                    if len(parts) < 2 or not parts[0].strip():
                        continue

                    question = ExtraQuestion.from_string(parts[0].strip())
                    if question in player_questions and parts[1].strip():
                        all_players[question].append(parts[1].strip())
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    return all_players


def get_team_names_from_extra_questions() -> Dict[ExtraQuestion, List[str]]:
    """
    Extracts all team names from the extra questions in the prono submissions.
    Returns a dictionary mapping question types to lists of team names.
    Only includes questions that expect team names as answers.
    """
    # Find the spelers directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    spelers_dir = os.path.join(current_dir, "input", "spelers")

    # Questions that expect team names as answers
    team_questions = {
        ExtraQuestion.BESTE_PLOEG_POI,
        ExtraQuestion.MEESTE_GEMAAKTE_GOALS_POI,
        ExtraQuestion.MINSTE_GOALS_TEGEN_POI,
        ExtraQuestion.BEKERWINNAAR,
        ExtraQuestion.KAMPIOEN,
    }

    # Dictionary to store all team names by question
    all_teams: Dict[ExtraQuestion, List[str]] = {
        question: [] for question in team_questions
    }

    # Process each player's CSV file
    for filename in os.listdir(spelers_dir):
        if not filename.endswith(".csv"):
            continue

        csv_path = os.path.join(spelers_dir, filename)

        try:
            with open(csv_path, "r", encoding="utf-8") as file:
                lines = file.readlines()

                # Extract player's answers to the extra questions
                for i, line in enumerate(lines):
                    if i < 10:  # Skip match predictions
                        continue

                    parts = line.strip().split(";")
                    if len(parts) < 2 or not parts[0].strip():
                        continue

                    question = ExtraQuestion.from_string(parts[0].strip())
                    if question in team_questions and parts[1].strip():
                        all_teams[question].append(parts[1].strip())
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    return all_teams


def get_player_names_with_counts() -> Dict[ExtraQuestion, List[tuple]]:
    """
    Returns player names with their counts, sorted by popularity.
    """
    players_by_question = get_player_names_from_extra_questions()
    result = {}

    for question, names in players_by_question.items():
        # Count occurrences of each name
        counter = Counter(names)
        # Sort by count (descending), then by name (ascending) for ties
        sorted_names = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
        result[question] = sorted_names

    return result


def get_team_names_with_counts() -> Dict[ExtraQuestion, List[Tuple[str, int]]]:
    """
    Returns team names with their counts, sorted by popularity.
    """
    teams_by_question = get_team_names_from_extra_questions()
    result = {}

    for question, names in teams_by_question.items():
        # Count occurrences of each team name
        counter = Counter(names)
        # Sort by count (descending), then by name (ascending) for ties
        sorted_names = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
        result[question] = sorted_names

    return result


def print_player_names_summary():
    """
    Prints a summary of all player names mentioned in extra questions.
    """
    players_with_counts = get_player_names_with_counts()

    question_labels = {
        ExtraQuestion.TOPSCORER_POI: "Topscorer POI",
        ExtraQuestion.ASSISTENKONING_POI: "Assistenkoning POI",
        ExtraQuestion.MEESTE_CLEAN_SHEETS_POI: "Meeste Clean Sheets POI",
    }

    print("PLAYER NAMES FROM EXTRA QUESTIONS")
    print("=================================")

    for question, names_counts in players_with_counts.items():
        if not names_counts:
            continue

        print(f"\n{question_labels[question]}:")
        print("-" * len(question_labels[question]))

        for name, count in names_counts:
            print(f"{name}: {count}")

    # Print a unique set of all player names across all categories
    all_players = set()
    for names_counts in players_with_counts.values():
        all_players.update(name for name, _ in names_counts)

    print("\nAll Unique Player Names:")
    print("------------------------")
    for name in sorted(all_players):
        print(name)


def print_team_names_summary():
    """
    Prints a summary of all team names mentioned in extra questions.
    """
    teams_with_counts = get_team_names_with_counts()

    question_labels = {
        ExtraQuestion.BESTE_PLOEG_POI: "Beste ploeg van POI",
        ExtraQuestion.MEESTE_GEMAAKTE_GOALS_POI: "Meeste gemaakte goals POI",
        ExtraQuestion.MINSTE_GOALS_TEGEN_POI: "Minste goals tegen POI",
        ExtraQuestion.BEKERWINNAAR: "Bekerwinnaar",
        ExtraQuestion.KAMPIOEN: "Kampioen",
    }

    print("TEAM NAMES FROM EXTRA QUESTIONS")
    print("===============================")

    for question, names_counts in teams_with_counts.items():
        if not names_counts:
            continue

        print(f"\n{question_labels[question]}:")
        print("-" * len(question_labels[question]))

        for name, count in names_counts:
            print(f"{name}: {count}")

    # Print a unique set of all team names across all categories
    all_teams = set()
    for names_counts in teams_with_counts.values():
        all_teams.update(name for name, _ in names_counts)

    print("\nAll Unique Team Names:")
    print("----------------------")
    for name in sorted(all_teams):
        print(name)


if __name__ == "__main__":
    print_player_names_summary()
    print("\n")
    print_team_names_summary()
