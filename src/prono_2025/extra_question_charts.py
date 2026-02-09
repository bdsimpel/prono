import os
import matplotlib.pyplot as plt
import numpy as np
from collections import Counter
import seaborn as sns
from src.prono_2025.stats import (
    ExtraQuestion,
    get_player_names_with_counts,
    get_team_names_with_counts,
)

# Create output directory if it doesn't exist
output_dir = os.path.join(
    os.path.dirname(__file__), "output", "stats", "extra_questions"
)
os.makedirs(output_dir, exist_ok=True)


def create_bar_chart(data, title, filename, color="blue"):
    """Create a bar chart for the given data."""
    # Sort by count in descending order
    sorted_data = sorted(data, key=lambda x: (-x[1], x[0]))

    # Get labels and values
    labels = [item[0] for item in sorted_data]
    values = [item[1] for item in sorted_data]

    # Create figure and axis
    plt.figure(figsize=(12, 8))

    # Create the bar chart
    bars = plt.bar(range(len(labels)), values, color=color)

    # Add value labels on top of bars
    for i, bar in enumerate(bars):
        height = bar.get_height()
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            height + 0.1,
            str(height),
            ha="center",
            va="bottom",
        )

    # Add labels and title
    plt.title(title, fontsize=16)
    plt.xlabel("Answer", fontsize=12)
    plt.ylabel("Number of Predictions", fontsize=12)

    # Set x-axis ticks
    plt.xticks(range(len(labels)), labels, rotation=45, ha="right")

    # Adjust layout to make room for labels
    plt.tight_layout()

    # Save the figure
    plt.savefig(os.path.join(output_dir, filename))
    plt.close()


def create_all_charts():
    """Create bar charts for all extra questions."""
    # Get data for player-related questions
    player_predictions = get_player_names_with_counts()

    # Get data for team-related questions
    team_predictions = get_team_names_with_counts()

    # Dictionary mapping questions to readable titles
    question_titles = {
        ExtraQuestion.BEKERWINNAAR: "Cup Winner Predictions",
        ExtraQuestion.BESTE_PLOEG_POI: "Best Team in POI Predictions",
        ExtraQuestion.TOPSCORER_POI: "Top Scorer POI Predictions",
        ExtraQuestion.ASSISTENKONING_POI: "Assist King POI Predictions",
        ExtraQuestion.MEESTE_CLEAN_SHEETS_POI: "Most Clean Sheets POI Predictions",
        ExtraQuestion.MEESTE_GEMAAKTE_GOALS_POI: "Most Goals Scored POI Predictions",
        ExtraQuestion.MINSTE_GOALS_TEGEN_POI: "Least Goals Conceded POI Predictions",
        ExtraQuestion.KAMPIOEN: "Champion Predictions",
    }

    # Create charts for player predictions
    for question, data in player_predictions.items():
        if data:  # Only create charts if there's data
            title = question_titles.get(question, str(question))
            filename = f"{question.name.lower()}_bar.png"
            create_bar_chart(data, title, filename, color="blue")

    # Create charts for team predictions
    for question, data in team_predictions.items():
        if data:  # Only create charts if there's data
            title = question_titles.get(question, str(question))
            filename = f"{question.name.lower()}_bar.png"
            create_bar_chart(data, title, filename, color="black")


if __name__ == "__main__":
    create_all_charts()
    print(f"Charts saved to {output_dir}")
