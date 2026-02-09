import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
from typing import Dict, List, Tuple
import os
import base64
from io import BytesIO
from PIL import Image
import sys
import numpy as np
from datetime import datetime

# Add the project root directory to the Python path
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)

# Now we can import the Pronostiek class correctly
from src.prono_2025.pronostiek import Pronostiek


class PronostiekVisualizer:
    def __init__(self, pronostiek: Pronostiek):
        self.pronostiek = pronostiek
        self.team_logos = self._load_team_logos()

        # Pre-process data for better performance
        print("Processing game data...")
        self.games_df = self._create_games_dataframe()

        print("Processing player data...")
        self.players_df = self._create_players_dataframe()

        # Additional processing for better performance
        self._preprocess_data()

    def _load_team_logos(self) -> Dict[str, str]:
        """Load team logos and convert them to base64 strings."""
        logos = {}
        current_dir = os.path.dirname(os.path.abspath(__file__))
        logos_dir = os.path.join(current_dir, "logos")

        for team in self.pronostiek.correct_answers[0][1:7]:
            team = team.strip()
            logo_path = os.path.join(logos_dir, f"{team.lower()}.png")
            if os.path.exists(logo_path):
                try:
                    with open(logo_path, "rb") as f:
                        img = Image.open(f)
                        buffered = BytesIO()
                        img.save(buffered, format="PNG")
                        logos[team] = base64.b64encode(buffered.getvalue()).decode()
                except Exception as e:
                    print(f"Error loading logo for {team}: {e}")

        return logos

    def _create_games_dataframe(self) -> pd.DataFrame:
        """Create a DataFrame with all games and their details."""
        games_data = []
        for game in self.pronostiek.games:
            if game.matrix_position:
                i, j = game.matrix_position
                correct_score = self.pronostiek.correct_answers[i][j].strip()
                games_data.append(
                    {
                        "datetime": game.datetime,
                        "speeldag": game.speeldag,
                        "home_team": game.home_team,
                        "away_team": game.away_team,
                        "matrix_position": game.matrix_position,
                        "rank": game.rank,
                        "correct_score": correct_score,
                        "is_played": correct_score != "",
                    }
                )

        return pd.DataFrame(games_data).sort_values("datetime")

    def _create_players_dataframe(self) -> pd.DataFrame:
        """Create a DataFrame with all players and their predictions."""
        players_data = []

        # Create a game lookup dictionary for faster access
        game_lookup = {
            game.matrix_position: game.rank
            for game in self.pronostiek.games
            if game.matrix_position
        }

        for player_name, player in self.pronostiek.players.items():
            player_scores = []
            for game in self.games_df.itertuples():
                if game.matrix_position:
                    i, j = game.matrix_position
                    prediction = player.get_prediction(game.home_team, game.away_team)
                    if prediction:
                        score = self.pronostiek._calculate_match_points(player, i, j)
                        player_scores.append(
                            {
                                "game_rank": game.rank,
                                "prediction": prediction,
                                "score": score,
                                "matrix_position": game.matrix_position,
                                "datetime": game.datetime,
                                "home_team": game.home_team,
                                "away_team": game.away_team,
                                "correct_score": game.correct_score,
                                "is_played": game.is_played,
                            }
                        )

            players_data.append(
                {
                    "full_name": player.full_name,
                    "total_score": player.score,
                    "scores": sorted(player_scores, key=lambda x: x["game_rank"]),
                }
            )

        return pd.DataFrame(players_data).sort_values("total_score", ascending=False)

    def _preprocess_data(self) -> None:
        """Pre-process data for visualization to improve performance."""
        # Get list of played games
        self.played_games = self.games_df[self.games_df["is_played"]].sort_values(
            "datetime"
        )

        # Calculate average scores per game
        game_avg_scores = {}
        played_game_count = len(self.played_games)

        for game in self.played_games.itertuples():
            if game.matrix_position:
                i, j = game.matrix_position
                scores = []

                for player in self.players_df.itertuples():
                    score_entry = next(
                        (s for s in player.scores if s["game_rank"] == game.rank), None
                    )
                    if score_entry:
                        scores.append(score_entry["score"])
                    else:
                        scores.append(0)

                avg_score = sum(scores) / len(scores) if scores else 0
                game_avg_scores[game.rank] = {
                    "avg_score": avg_score,
                    "matrix_position": (i, j),
                    "home_team": game.home_team,
                    "away_team": game.away_team,
                    "correct_score": game.correct_score,
                    "datetime": game.datetime,
                }

        # Store processed data
        self.game_avg_scores = game_avg_scores
        self.played_game_count = played_game_count

        # Calculate cumulative average scores
        cum_avg_scores = []
        running_total = 0

        for rank in sorted(game_avg_scores.keys()):
            running_total += game_avg_scores[rank]["avg_score"]
            cum_avg_scores.append(
                {
                    "rank": rank,
                    "avg_score": game_avg_scores[rank]["avg_score"],
                    "cum_avg_score": running_total,
                    "datetime": game_avg_scores[rank]["datetime"],
                }
            )

        self.cum_avg_scores = cum_avg_scores

    def create_visualization(self, output_path: str) -> None:
        """Create and save the interactive visualization."""
        print("Creating visualization...")
        # Get team order from correct_answers (same as Excel)
        teams = [team.strip() for team in self.pronostiek.correct_answers[0][1:7]]

        # Create figure with subplots
        fig = make_subplots(
            rows=2,
            cols=1,
            row_heights=[0.5, 0.5],
            subplot_titles=("Cumulative Score", "Match Predictions Matrix"),
            vertical_spacing=0.1,
        )

        # Create game ranks for x-axis
        game_ranks = list(range(1, self.played_game_count + 1))

        # Add average score line trace
        if self.cum_avg_scores:
            avg_score_trace = go.Scatter(
                x=game_ranks,
                y=[entry["cum_avg_score"] for entry in self.cum_avg_scores],
                name="Average",
                line=dict(color="gray", width=3, dash="dash"),
                text=[
                    f"Game {entry['rank']}<br>Average Score: {entry['avg_score']:.2f}<br>Total: {entry['cum_avg_score']:.2f}"
                    for entry in self.cum_avg_scores
                ],
                hoverinfo="text",
                visible=True,
            )
            fig.add_trace(avg_score_trace, row=1, col=1)
            avg_score_trace_idx = len(fig.data) - 1
        else:
            avg_score_trace_idx = None

        # Prepare matrix data for average view
        avg_matrix_data = []
        avg_zero_score_data = []
        avg_unplayed_data = []

        # Process average matrix data
        print("Processing average matrix data...")
        for game in self.games_df.itertuples():
            if game.matrix_position:
                i, j = game.matrix_position
                if game.is_played:
                    avg_score = self.game_avg_scores.get(game.rank, {}).get(
                        "avg_score", 0
                    )
                    if avg_score > 0:
                        avg_matrix_data.append(
                            {
                                "i": i,
                                "j": j,
                                "score": avg_score,
                                "home_team": game.home_team,
                                "away_team": game.away_team,
                                "correct_score": game.correct_score,
                            }
                        )
                    else:
                        avg_zero_score_data.append(
                            {
                                "i": i,
                                "j": j,
                                "home_team": game.home_team,
                                "away_team": game.away_team,
                                "correct_score": game.correct_score,
                            }
                        )
                else:
                    avg_unplayed_data.append(
                        {
                            "i": i,
                            "j": j,
                            "home_team": game.home_team,
                            "away_team": game.away_team,
                        }
                    )

        # Add average points markers
        if avg_matrix_data:
            avg_matrix_trace = go.Scatter(
                x=[d["j"] for d in avg_matrix_data],
                y=[d["i"] for d in avg_matrix_data],
                mode="markers",
                marker=dict(
                    size=[d["score"] * 5 for d in avg_matrix_data],
                    color="blue",
                    opacity=0.6,
                    line=dict(color="white", width=1),
                ),
                text=[
                    f"{d['home_team']} vs {d['away_team']}<br>"
                    f"Actual: {d['correct_score']}<br>"
                    f"Average Score: {d['score']:.2f}"
                    for d in avg_matrix_data
                ],
                hoverinfo="text",
                hoverlabel=dict(namelength=-1),
                visible=True,
                showlegend=False,
            )
            fig.add_trace(avg_matrix_trace, row=2, col=1)
            avg_matrix_trace_idx = len(fig.data) - 1
        else:
            avg_matrix_trace_idx = None

        # Add zero score markers
        if avg_zero_score_data:
            avg_zero_score_trace = go.Scatter(
                x=[d["j"] for d in avg_zero_score_data],
                y=[d["i"] for d in avg_zero_score_data],
                mode="markers",
                marker=dict(
                    symbol="x",
                    size=10,
                    color="red",
                    opacity=0.8,
                    line=dict(color="white", width=1),
                ),
                text=[
                    f"{d['home_team']} vs {d['away_team']}<br>"
                    f"Actual: {d['correct_score']}<br>"
                    f"Average Score: 0"
                    for d in avg_zero_score_data
                ],
                hoverinfo="text",
                hoverlabel=dict(namelength=-1),
                visible=True,
                showlegend=False,
            )
            fig.add_trace(avg_zero_score_trace, row=2, col=1)
            avg_zero_score_trace_idx = len(fig.data) - 1
        else:
            avg_zero_score_trace_idx = None

        # Add unplayed markers
        if avg_unplayed_data:
            avg_unplayed_trace = go.Scatter(
                x=[d["j"] for d in avg_unplayed_data],
                y=[d["i"] for d in avg_unplayed_data],
                mode="markers",
                marker=dict(
                    symbol="circle",
                    size=6,
                    color="black",
                    opacity=0.5,
                    line=dict(color="white", width=1),
                ),
                text=[
                    f"{d['home_team']} vs {d['away_team']}<br>Not yet played"
                    for d in avg_unplayed_data
                ],
                hoverinfo="text",
                hoverlabel=dict(namelength=-1),
                visible=True,
                showlegend=False,
            )
            fig.add_trace(avg_unplayed_trace, row=2, col=1)
            avg_unplayed_trace_idx = len(fig.data) - 1
        else:
            avg_unplayed_trace_idx = None

        # Add player traces
        player_traces = {}
        print(f"Processing {len(self.players_df)} player traces...")

        for i, player in enumerate(self.players_df.itertuples()):
            print(
                f"  Processing player {i+1}/{len(self.players_df)}: {player.full_name}"
            )

            # Get scores for played games only
            played_scores = [s for s in player.scores if s["is_played"]]

            # Sort by game rank
            played_scores.sort(key=lambda x: x["game_rank"])

            # Extract scores and calculate cumulative totals
            scores = [s["score"] for s in played_scores]
            cum_scores = np.cumsum(scores).tolist()
            game_ranks = list(range(1, len(scores) + 1))

            # Add cumulative line
            if scores:
                score_trace = go.Scatter(
                    x=game_ranks,
                    y=cum_scores,
                    name=player.full_name,
                    line=dict(width=2),
                    text=[
                        f"Game {rank}<br>Score: {score}<br>Total: {cum_score}<br>Player: {player.full_name}"
                        for rank, score, cum_score in zip(
                            game_ranks, scores, cum_scores
                        )
                    ],
                    hoverinfo="text",
                    visible=False,
                )
                fig.add_trace(score_trace, row=1, col=1)
                score_trace_idx = len(fig.data) - 1

                # Add individual bars
                bars_trace = go.Bar(
                    x=game_ranks,
                    y=scores,
                    name=f"{player.full_name} (Points)",
                    text=[
                        f"Game {rank}<br>Points: {score}<br>Player: {player.full_name}"
                        for rank, score in zip(game_ranks, scores)
                    ],
                    hoverinfo="text",
                    visible=False,
                    marker=dict(
                        line=dict(width=1, color="white"),
                    ),
                )
                fig.add_trace(bars_trace, row=1, col=1)
                bars_trace_idx = len(fig.data) - 1
            else:
                score_trace_idx = None
                bars_trace_idx = None

            # Prepare matrix data
            matrix_data = []
            zero_score_data = []
            unplayed_data = []

            for s in player.scores:
                if s["is_played"]:
                    i, j = s["matrix_position"]
                    if s["score"] > 0:
                        matrix_data.append(
                            {
                                "i": i,
                                "j": j,
                                "score": s["score"],
                                "home_team": s["home_team"],
                                "away_team": s["away_team"],
                                "prediction": s["prediction"],
                                "correct_score": s["correct_score"],
                            }
                        )
                    else:
                        zero_score_data.append(
                            {
                                "i": i,
                                "j": j,
                                "home_team": s["home_team"],
                                "away_team": s["away_team"],
                                "prediction": s["prediction"],
                                "correct_score": s["correct_score"],
                            }
                        )
                else:
                    i, j = s["matrix_position"]
                    unplayed_data.append(
                        {
                            "i": i,
                            "j": j,
                            "home_team": s["home_team"],
                            "away_team": s["away_team"],
                        }
                    )

            # Add player's matrix points
            matrix_trace_idx = None
            zero_score_trace_idx = None
            unplayed_trace_idx = None

            if matrix_data:
                matrix_trace = go.Scatter(
                    x=[d["j"] for d in matrix_data],
                    y=[d["i"] for d in matrix_data],
                    mode="markers",
                    marker=dict(
                        size=[d["score"] * 5 for d in matrix_data],
                        color="blue",
                        opacity=0.6,
                        line=dict(color="white", width=1),
                    ),
                    text=[
                        f"{d['home_team']} vs {d['away_team']}<br>"
                        f"Prediction: {d['prediction']}<br>"
                        f"Actual: {d['correct_score']}<br>"
                        f"Score: {d['score']}"
                        for d in matrix_data
                    ],
                    hoverinfo="text",
                    hoverlabel=dict(namelength=-1),
                    visible=False,
                    showlegend=False,
                )
                fig.add_trace(matrix_trace, row=2, col=1)
                matrix_trace_idx = len(fig.data) - 1

            # Add zero score markers
            if zero_score_data:
                zero_score_trace = go.Scatter(
                    x=[d["j"] for d in zero_score_data],
                    y=[d["i"] for d in zero_score_data],
                    mode="markers",
                    marker=dict(
                        symbol="x",
                        size=10,
                        color="red",
                        opacity=0.8,
                        line=dict(color="white", width=1),
                    ),
                    text=[
                        f"{d['home_team']} vs {d['away_team']}<br>"
                        f"Prediction: {d['prediction']}<br>"
                        f"Actual: {d['correct_score']}<br>"
                        f"Score: 0"
                        for d in zero_score_data
                    ],
                    hoverinfo="text",
                    hoverlabel=dict(namelength=-1),
                    visible=False,
                    showlegend=False,
                )
                fig.add_trace(zero_score_trace, row=2, col=1)
                zero_score_trace_idx = len(fig.data) - 1

            # Add unplayed markers
            if unplayed_data:
                unplayed_trace = go.Scatter(
                    x=[d["j"] for d in unplayed_data],
                    y=[d["i"] for d in unplayed_data],
                    mode="markers",
                    marker=dict(
                        symbol="circle",
                        size=6,
                        color="black",
                        opacity=0.5,
                        line=dict(color="white", width=1),
                    ),
                    text=[
                        f"{d['home_team']} vs {d['away_team']}<br>Not yet played"
                        for d in unplayed_data
                    ],
                    hoverinfo="text",
                    hoverlabel=dict(namelength=-1),
                    visible=False,
                    showlegend=False,
                )
                fig.add_trace(unplayed_trace, row=2, col=1)
                unplayed_trace_idx = len(fig.data) - 1

            # Store trace indices
            player_traces[player.full_name] = {
                "score_trace": score_trace_idx,
                "bars_trace": bars_trace_idx,
                "matrix_trace": matrix_trace_idx,
                "zero_score_trace": zero_score_trace_idx,
                "unplayed_trace": unplayed_trace_idx,
            }

        # Create dropdown options
        dropdown_options = []

        # Add Average button
        print("Creating dropdown options...")
        avg_visible = [False] * len(fig.data)
        if avg_score_trace_idx is not None:
            avg_visible[avg_score_trace_idx] = True
        if avg_matrix_trace_idx is not None:
            avg_visible[avg_matrix_trace_idx] = True
        if avg_zero_score_trace_idx is not None:
            avg_visible[avg_zero_score_trace_idx] = True
        if avg_unplayed_trace_idx is not None:
            avg_visible[avg_unplayed_trace_idx] = True

        dropdown_options.append(
            dict(
                label="Average",
                method="update",
                args=[{"visible": avg_visible}],
            )
        )

        # Add player options
        for player_name, indices in player_traces.items():
            visible = [False] * len(fig.data)

            if indices["score_trace"] is not None:
                visible[indices["score_trace"]] = True
            if indices["bars_trace"] is not None:
                visible[indices["bars_trace"]] = True
            if indices["matrix_trace"] is not None:
                visible[indices["matrix_trace"]] = True
            if indices["zero_score_trace"] is not None:
                visible[indices["zero_score_trace"]] = True
            if indices["unplayed_trace"] is not None:
                visible[indices["unplayed_trace"]] = True

            dropdown_options.append(
                dict(
                    label=player_name,
                    method="update",
                    args=[{"visible": visible}],
                )
            )

        # Set initial visibility to show only average
        for i, trace in enumerate(fig.data):
            if (
                i == avg_score_trace_idx
                or i == avg_matrix_trace_idx
                or i == avg_zero_score_trace_idx
                or i == avg_unplayed_trace_idx
            ):
                trace.visible = True
            else:
                trace.visible = False

        # Update layout
        print("Updating layout...")
        fig.update_layout(
            title="Pronostiek 2025 - Player Performance",
            showlegend=True,
            legend=dict(
                title="Players",
                itemsizing="constant",
                itemwidth=30,
                groupclick="toggleitem",  # Enable individual item toggling
            ),
            hovermode="closest",
            hoverdistance=100,
            spikedistance=1000,
            height=1200,
            template="plotly_white",
            updatemenus=[
                dict(
                    buttons=dropdown_options,
                    direction="down",
                    pad={"r": 10, "t": 10},
                    showactive=True,
                    x=0.1,
                    xanchor="left",
                    y=1.1,
                    yanchor="top",
                    name="Select Player",
                    active=0,
                ),
            ],
            annotations=[
                dict(
                    text="Select a player from the dropdown menu",
                    x=0.5,
                    y=1.05,
                    xref="paper",
                    yref="paper",
                    showarrow=False,
                    font=dict(size=12),
                )
            ],
        )

        # Update axes
        fig.update_xaxes(
            title_text="Game Number",
            row=1,
            col=1,
            tickmode="linear",
            tick0=1,
            dtick=1,
        )
        fig.update_yaxes(title_text="Cumulative Score", row=1, col=1)

        # Update matrix axes
        fig.update_xaxes(
            title_text="Away Team",
            ticktext=teams,
            tickvals=list(range(1, len(teams) + 1)),
            range=[0.5, len(teams) + 0.5],
            row=2,
            col=1,
        )
        fig.update_yaxes(
            title_text="Home Team",
            ticktext=teams,
            tickvals=list(range(1, len(teams) + 1)),
            range=[len(teams) + 0.5, 0.5],
            row=2,
            col=1,
        )

        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Save to HTML
        print(f"Saving to {output_path}...")
        fig.write_html(output_path)
        print("Visualization completed!")


def main():
    print("Initializing Pronostiek...")
    pronostiek = Pronostiek()

    print("Calculating scores...")
    pronostiek.calculate_scores()

    print("Creating visualizer...")
    visualizer = PronostiekVisualizer(pronostiek)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(current_dir, "..", "output")
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "pronostiek_visualization.html")
    visualizer.create_visualization(output_path)
    print(f"Visualization saved to {output_path}")


if __name__ == "__main__":
    main()
