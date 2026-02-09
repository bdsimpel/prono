import csv
import os
from datetime import datetime
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum, auto
import pandas as pd


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
    def from_string(cls, question: str) -> Optional["ExtraQuestion"]:
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


@dataclass
class Player:
    first_name: str
    last_name: str
    paid: bool
    predictions: Dict[str, Dict[str, str]]  # home_team -> away_team -> score
    cup_final_prediction: str  # Score prediction for the cup final
    extra_questions: Dict[ExtraQuestion, str]
    score: int = 0
    exact_matches: int = 0  # Number of matches predicted exactly right
    correct_goal_diff: int = 0  # Number of matches with correct goal difference
    correct_result: int = 0  # Number of matches with correct result only

    @classmethod
    def from_csv(
        cls, first_name: str, last_name: str, csv_path: str, paid: bool = True
    ) -> "Player":
        with open(csv_path, "r") as infile:
            reader = csv.reader(infile, delimiter=";")
            rows = list(reader)

        # Extract teams from header
        teams = [team.strip() for team in rows[0][1:] if team.strip()]

        # Parse match predictions
        predictions = {}
        for row in rows[1:7]:  # First 6 rows contain match predictions
            if not row or not row[0].strip():
                continue
            home_team = row[0].strip()
            predictions[home_team] = {
                away_team: score.strip()
                for away_team, score in zip(teams, row[1:7])
                if score.strip() and score.strip() != "/"
            }

        # Parse cup final (both teams and score)
        cup_final_prediction = rows[8][1].strip() if len(rows) > 8 else ""

        # Parse extra questions
        extra_questions = {}
        for row in rows[11:18]:  # Extra questions start at row 11
            if len(row) >= 2 and row[0].strip():
                question = ExtraQuestion.from_string(row[0].strip())
                if question:
                    answer = row[1].strip()
                    extra_questions[question] = answer

        return cls(
            first_name=first_name,
            last_name=last_name,
            paid=paid,
            predictions=predictions,
            cup_final_prediction=cup_final_prediction,
            extra_questions=extra_questions,
        )

    def get_prediction(self, home_team: str, away_team: str) -> Optional[str]:
        """Get the predicted score for a match between home_team and away_team."""
        return self.predictions.get(home_team, {}).get(away_team)

    def get_extra_question_answer(self, question: ExtraQuestion) -> Optional[str]:
        """Get the answer to an extra question."""
        return self.extra_questions.get(question)

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


@dataclass
class Game:
    datetime: datetime
    speeldag: int
    home_team: str
    away_team: str
    rank: int
    matrix_position: Optional[Tuple[int, int]] = None


class Pronostiek:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.correct_answers = self._lees_csv(
            os.path.join(current_dir, "input", "Juist.csv"), delimiter=","
        )
        self.players: Dict[str, Player] = {}
        self._load_players(os.path.join(current_dir, "input", "spelers"))
        self.games: List[Game] = []
        self._load_games(os.path.join(current_dir, "input", "games.xlsx"))

    def _lees_csv(self, pad: str, delimiter: str = ";") -> List[List[str]]:
        with open(pad, "r") as infile:
            return [rij for rij in csv.reader(infile, delimiter=delimiter)]

    def _load_players(self, spelers_dir: str) -> None:
        for filename in os.listdir(spelers_dir):
            if filename.endswith(".csv"):
                first_name, last_name = filename.split(".")[:2]
                path = os.path.join(spelers_dir, filename)
                player = Player.from_csv(first_name, last_name, path)
                self.players[player.full_name] = player

    def get_player(self, first_name: str, last_name: str) -> Optional[Player]:
        """Get a player by their full name."""
        full_name = f"{first_name} {last_name}"
        return self.players.get(full_name)

    def calculate_scores(self) -> None:
        """Calculate scores for all players based on correct answers."""
        for player in self.players.values():
            player.score = 0

            # Calculate match prediction scores
            for i in range(1, 7):
                for j in range(1, 7):
                    player.score += self._calculate_match_points(player, i, j)

            # Calculate cup final points
            player.score += self._calculate_match_points(player, 9, 1)

            # Calculate extra questions points
            for i in range(11, 18):
                question = ExtraQuestion.from_string(self.correct_answers[i][0])
                if question:
                    player_answer = player.get_extra_question_answer(question)
                    if player_answer and player_answer.replace(" ", "") in [
                        x.replace(" ", "")
                        for x in self.correct_answers[i][1].split(", ")
                    ]:
                        player.score += 10

            # Calculate final question points
            final_question = ExtraQuestion.from_string(self.correct_answers[18][0])
            if final_question:
                final_answer = player.get_extra_question_answer(final_question)
                if final_answer and final_answer.replace(
                    " ", ""
                ) == self.correct_answers[18][1].replace(" ", ""):
                    player.score += 20

    def _calculate_match_points(self, player: Player, i: int, j: int) -> int:
        """Calculate points for a specific match prediction."""
        score = 0
        correct = self.correct_answers[i][j].replace(" ", "")
        prediction = player.get_prediction(
            self.correct_answers[i][0].strip(), self.correct_answers[0][j].strip()
        )

        if not prediction:
            return 0

        to_check = prediction.replace(" ", "")

        if (
            len(to_check) == 3
            and to_check[0].isdigit()
            and to_check[2].isdigit()
            and to_check[1] == "-"
        ):
            if (
                len(correct) == 3
                and correct[0].isdigit()
                and correct[2].isdigit()
                and correct[1] == "-"
            ):
                HC, AC = int(correct[0]), int(correct[2])
                H, A = int(to_check[0]), int(to_check[2])
                WC, GC, VC = HC > AC, HC == AC, HC < AC
                W, G, V = H > A, H == A, H < A

                if WC == W and GC == G and VC == V:
                    player.correct_result += 1
                    score += 5
                    if H - A == HC - AC:
                        player.correct_goal_diff += 1
                        score += 2
                        if HC == H and AC == A:
                            player.exact_matches += 1
                            score += 3 + HC + AC
        elif i != j:
            print(
                f"WARN: Invalid prediction format for player {player.full_name} on row {i} column {j}"
            )

        return score

    def get_standings(self) -> str:
        """Generate the standings text."""
        sorted_players = sorted(
            self.players.values(), key=lambda p: (-p.score, p.last_name, p.first_name)
        )

        lines = []
        lines.append(datetime.now().strftime("Laatst geüpdatet op: %d-%m-%Y %H:%M:%S"))

        current_rank = 1
        previous_score = None

        for player in sorted_players:
            if player.score != previous_score:
                current_rank = sorted_players.index(player) + 1
            suffix = "" if player.paid else "*"
            lines.append(f"{current_rank}. {player.full_name} {player.score}{suffix}")
            previous_score = player.score

        return "\n".join(lines) + "\n"

    def write_standings(self) -> None:
        """Write the current standings to a file."""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(current_dir, "klassement.txt"), "w") as f:
            f.write(self.get_standings())

    def _load_games(self, games_path: str) -> None:
        """Load games from Excel file and map them to matrix positions."""
        df = pd.read_excel(games_path)

        # Create team to index mapping from correct_answers
        teams = [team.strip() for team in self.correct_answers[0][1:7]]
        team_to_index = {team: idx + 1 for idx, team in enumerate(teams)}

        # Create games list with matrix positions
        for _, row in df.iterrows():
            home_team = row["home_team"].strip()
            away_team = row["away_team"].strip()

            # Find matrix position
            i = team_to_index.get(home_team)
            j = team_to_index.get(away_team)
            matrix_pos = (i, j) if i and j else None

            game = Game(
                datetime=row["datetime"],
                speeldag=row["speeldag"],
                home_team=home_team,
                away_team=away_team,
                rank=row["rank"],
                matrix_position=matrix_pos,
            )
            self.games.append(game)

    def get_game_by_matrix_position(self, i: int, j: int) -> Optional[Game]:
        """Get game information for a specific matrix position (i,j)."""
        for game in self.games:
            if game.matrix_position == (i, j):
                return game
        return None

    def get_matrix_position_by_teams(
        self, home_team: str, away_team: str
    ) -> Optional[Tuple[int, int]]:
        """Get matrix position (i,j) for a game between home_team and away_team."""
        for game in self.games:
            if game.home_team == home_team and game.away_team == away_team:
                return game.matrix_position
        return None


__all__ = ["Pronostiek", "Player", "ExtraQuestion"]
