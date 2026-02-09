import os
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from src.prono_2025.stats import (
    ExtraQuestion,
    get_player_names_with_counts,
    get_team_names_with_counts,
    name_mapping,
)

# Create output directory if it doesn't exist
os.makedirs("src/prono_2025/output/stats", exist_ok=True)


def load_actual_data():
    """Load actual data from stats CSV files"""
    base_path = "src/prono_2025/input/stats"

    # Load topscorers data
    topscorers = pd.read_csv(os.path.join(base_path, "topscorers.csv"))

    # Load assists data
    assists = pd.read_csv(os.path.join(base_path, "assists.csv"))

    # Load goalkeeper clean sheets data
    clean_sheets = pd.read_csv(os.path.join(base_path, "goalkeeper_clean_sheets.csv"))

    # Load team stats
    most_goals = pd.read_csv(os.path.join(base_path, "most_goals_scored.csv"))
    best_defense = pd.read_csv(os.path.join(base_path, "best_defense.csv"))
    team_clean_sheets = pd.read_csv(os.path.join(base_path, "clean_sheets.csv"))

    # Load points won data if it exists
    points_won_path = os.path.join(base_path, "points_won.csv")
    if os.path.exists(points_won_path):
        points_won = pd.read_csv(points_won_path)
    else:
        # Create a placeholder with the same teams as in clean_sheets
        points_won = team_clean_sheets.copy()
        points_won.rename(columns={"Clean_Sheets": "Points_Won"}, inplace=True)
        # Assign some placeholder values based on rank
        points_won["Points_Won"] = range(15, 15 - len(points_won), -1)

    return {
        "topscorers": topscorers,
        "assists": assists,
        "goalkeeper_clean_sheets": clean_sheets,
        "most_goals": most_goals,
        "best_defense": best_defense,
        "team_clean_sheets": team_clean_sheets,
        "points_won": points_won,
    }


def create_player_comparison_graph(actual_data, predictions, question, output_file):
    """Create a bar chart comparing actual ranking with predictions"""
    # Get the top actual players
    if question == ExtraQuestion.TOPSCORER_POI:
        actual_df = actual_data["topscorers"]
        title = "Topscorer POI - Actual vs Predicted"
        column = "Player"
        value_column = "Goals"
        actual_label = "Number of Goals"
        # Filter out players with 1 or fewer goals
        actual_df = actual_df[actual_df[value_column] > 1]
    elif question == ExtraQuestion.ASSISTENKONING_POI:
        actual_df = actual_data["assists"]
        title = "Assistenkoning POI - Actual vs Predicted"
        column = "Player"
        value_column = "Assists"
        actual_label = "Number of Assists"
        # Filter out players with 1 or fewer assists
        actual_df = actual_df[actual_df[value_column] > 1]
    elif question == ExtraQuestion.MEESTE_CLEAN_SHEETS_POI:
        actual_df = actual_data["goalkeeper_clean_sheets"]
        title = "Meeste Clean Sheets POI - Actual vs Predicted"
        column = "Goalkeeper"
        value_column = "Clean_Sheets"
        actual_label = "Number of Clean Sheets"
    else:
        return

    # Create a mapping of normalized player names to their original names
    reverse_mapping = {v.lower(): k for k, v in name_mapping.items()}

    # Process predictions using mappings
    prediction_counts = {}
    for name, count in predictions:
        normalized_name = None
        # Check if the name exists directly in mappings
        if name in name_mapping:
            normalized_name = name_mapping[name].lower()
        else:
            # Try to find the name in the reverse mapping
            normalized_name = name.lower()

        # Add to counts
        if normalized_name:
            if normalized_name in prediction_counts:
                prediction_counts[normalized_name] += count
            else:
                prediction_counts[normalized_name] = count

    # Sort predictions by count (descending)
    sorted_predictions = sorted(prediction_counts.items(), key=lambda x: (-x[1], x[0]))

    # Take the top N predictions (or all if fewer)
    top_n = 10
    if len(sorted_predictions) > top_n:
        top_predictions = sorted_predictions[:top_n]
    else:
        top_predictions = sorted_predictions

    # Extract actual data if available
    actual_players = []
    actual_values = []

    if "Rank" in actual_df.columns:
        top_actual_df = actual_df.sort_values("Rank").head(5)
        if not top_actual_df.empty:
            actual_players = top_actual_df[column].tolist()
            actual_values = top_actual_df[value_column].tolist()
    else:
        # For goalkeeper clean sheets which might not have rank
        top_actual_df = actual_df.sort_values(value_column, ascending=False).head(5)
        if not top_actual_df.empty:
            actual_players = top_actual_df[column].tolist()
            actual_values = top_actual_df[value_column].tolist()

    # Determine the players to show
    players_to_show = []

    # If we have actual data, use those players
    if actual_players:
        players_to_show = actual_players

        # Prepare data for plotting
        player_data = []
        for player in players_to_show:
            normalized_player = player.lower()
            prediction_count = prediction_counts.get(normalized_player, 0)
            player_data.append((player, prediction_count))
    else:
        # If no actual data, use top predictions
        players_to_show = [p[0].title() for p in top_predictions]

        # Prepare data for plotting - just predictions
        player_data = [(player.title(), count) for player, count in top_predictions]

    # If there are no players to show (no actual data and no predictions), return
    if not players_to_show:
        print(f"No data available for {title}. Skipping graph.")
        return

    # Create the plot
    fig, ax = plt.subplots(figsize=(14, 8))

    # Plot data
    players = [p[0] for p in player_data]
    pred_counts = [p[1] for p in player_data]

    # Set up positions for side-by-side bars
    x = np.arange(len(players))
    width = 0.35

    # Create bars
    if actual_players and actual_values:
        # Create both actual and prediction bars if we have actual data
        actual_vals = []
        for player in players:
            # Find the actual value for this player
            if player in actual_players:
                idx = actual_players.index(player)
                actual_vals.append(actual_values[idx])
            else:
                actual_vals.append(0)

        actual_bars = ax.bar(
            x - width / 2, actual_vals, width, color="blue", label=actual_label
        )
        pred_bars = ax.bar(
            x + width / 2,
            pred_counts,
            width,
            color="black",
            label="Number of Predictions",
        )

        # Add value labels on top of bars
        for bars in [actual_bars, pred_bars]:
            for bar in bars:
                height = bar.get_height()
                if height > 0:  # Only add label if bar has height
                    ax.annotate(
                        f"{height}",
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha="center",
                        va="bottom",
                    )
    else:
        # Only create prediction bars if we don't have actual data
        pred_bars = ax.bar(
            x, pred_counts, width, color="black", label="Number of Predictions"
        )

        # Add value labels on top of bars
        for bar in pred_bars:
            height = bar.get_height()
            ax.annotate(
                f"{height}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                va="bottom",
            )

    # Add labels and title
    ax.set_xlabel("Players")
    ax.set_ylabel("Values")
    ax.set_title(title)
    ax.set_xticks(x)
    ax.set_xticklabels(players, rotation=45, ha="right")
    ax.legend()

    plt.tight_layout()
    plt.savefig(output_file)
    plt.close()


def create_team_comparison_graph(
    actual_data, question_type, output_file, title, predictions=None, question=None
):
    """Create a bar chart for team statistics with predictions"""
    if question_type == "most_goals":
        df = actual_data["most_goals"]
        y_label = "Goals Scored / Predictions"
        value_col = "Goals_Scored"
        actual_label = "Goals Scored"
    elif question_type == "best_defense":
        df = actual_data["best_defense"]
        y_label = "Goals Conceded / Predictions"
        value_col = "Goals_Conceded"
        actual_label = "Goals Conceded"
    elif question_type == "clean_sheets":
        df = actual_data["team_clean_sheets"]
        y_label = "Clean Sheets / Predictions"
        value_col = "Clean_Sheets"
        actual_label = "Number of Clean Sheets"
    elif question_type == "points_won":
        df = actual_data["points_won"]
        y_label = "Points Won / Predictions"
        value_col = "Points_Won"
        actual_label = "Points Won"
    else:
        return

    # Process team predictions if available
    team_predictions = {}
    if predictions and question:
        # Process team predictions
        for team_name, count in predictions.get(question, []):
            normalized_team = team_name.lower()
            if normalized_team in team_predictions:
                team_predictions[normalized_team] += count
            else:
                team_predictions[normalized_team] = count

    # Sort predictions by count (descending)
    sorted_predictions = sorted(team_predictions.items(), key=lambda x: (-x[1], x[0]))

    # Take the top N predictions (or all if fewer)
    top_n = 10
    if len(sorted_predictions) > top_n:
        top_predictions = sorted_predictions[:top_n]
    else:
        top_predictions = sorted_predictions

    # Determine the teams to show
    teams_to_show = []

    # If we have actual data, use those teams
    if not df.empty:
        # Sort by rank if available
        if "Rank" in df.columns:
            df = df.sort_values("Rank")

        teams_to_show = df["Team"].tolist()
        actual_values = df[value_col].tolist()

        # Create prediction counts aligned with teams_to_show
        prediction_counts = []
        for team in teams_to_show:
            team_lower = team.lower()
            prediction_counts.append(team_predictions.get(team_lower, 0))
    else:
        # If no actual data, use top predictions
        teams_to_show = [team.title() for team, _ in top_predictions]
        prediction_counts = [count for _, count in top_predictions]
        actual_values = [0] * len(teams_to_show)  # Empty placeholders

    # If there are no teams to show (no actual data and no predictions), return
    if not teams_to_show:
        print(f"No data available for {title}. Skipping graph.")
        return

    # Create the plot
    fig, ax = plt.subplots(figsize=(14, 8))

    # Set up positions for side-by-side bars
    x = np.arange(len(teams_to_show))
    width = 0.35

    # Only create actual value bars if we have real data
    if not df.empty:
        actual_bars = ax.bar(
            x - width / 2, actual_values, width, color="blue", label=actual_label
        )
        pred_bars = ax.bar(
            x + width / 2,
            prediction_counts,
            width,
            color="black",
            label="Number of Predictions",
        )

        # Add value labels on top of bars
        for bars in [actual_bars, pred_bars]:
            for bar in bars:
                height = bar.get_height()
                if height > 0:  # Only add label if bar has height
                    ax.annotate(
                        f"{height}",
                        xy=(bar.get_x() + bar.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha="center",
                        va="bottom",
                    )
    else:
        # Only create prediction bars if we don't have actual data
        pred_bars = ax.bar(
            x, prediction_counts, width, color="black", label="Number of Predictions"
        )

        # Add value labels on top of bars
        for bar in pred_bars:
            height = bar.get_height()
            ax.annotate(
                f"{height}",
                xy=(bar.get_x() + bar.get_width() / 2, height),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                va="bottom",
            )

    # Add labels and title
    ax.set_xlabel("Teams")
    ax.set_ylabel(y_label)
    ax.set_title(title)
    ax.set_xticks(x)
    ax.set_xticklabels(teams_to_show, rotation=45, ha="right")
    ax.legend()

    plt.tight_layout()
    plt.savefig(output_file)
    plt.close()


def get_team_predictions():
    """Extract team predictions from the stats data"""
    # Use the new function from stats.py to get team predictions
    return get_team_names_with_counts()


def main():
    # Load actual data
    actual_data = load_actual_data()

    # Get prediction data
    predictions = get_player_names_with_counts()
    team_predictions = get_team_predictions()

    # Create player comparison graphs
    create_player_comparison_graph(
        actual_data,
        predictions[ExtraQuestion.TOPSCORER_POI],
        ExtraQuestion.TOPSCORER_POI,
        "src/prono_2025/output/stats/topscorer_poi.png",
    )

    create_player_comparison_graph(
        actual_data,
        predictions[ExtraQuestion.ASSISTENKONING_POI],
        ExtraQuestion.ASSISTENKONING_POI,
        "src/prono_2025/output/stats/assistenkoning_poi.png",
    )

    create_player_comparison_graph(
        actual_data,
        predictions[ExtraQuestion.MEESTE_CLEAN_SHEETS_POI],
        ExtraQuestion.MEESTE_CLEAN_SHEETS_POI,
        "src/prono_2025/output/stats/clean_sheets_poi.png",
    )

    # Create team comparison graphs
    create_team_comparison_graph(
        actual_data,
        "most_goals",
        "src/prono_2025/output/stats/most_goals_poi.png",
        "Meeste gemaakte goals POI",
        team_predictions,
        ExtraQuestion.MEESTE_GEMAAKTE_GOALS_POI,
    )

    create_team_comparison_graph(
        actual_data,
        "best_defense",
        "src/prono_2025/output/stats/best_defense_poi.png",
        "Minste goals tegen POI",
        team_predictions,
        ExtraQuestion.MINSTE_GOALS_TEGEN_POI,
    )

    create_team_comparison_graph(
        actual_data,
        "points_won",
        "src/prono_2025/output/stats/team_beste_ploeg_poi.png",
        "Beste ploeg van POI (Most Points Won)",
        team_predictions,
        ExtraQuestion.BESTE_PLOEG_POI,
    )


if __name__ == "__main__":
    main()
