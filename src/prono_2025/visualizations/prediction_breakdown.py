import matplotlib.pyplot as plt
import numpy as np
import os
import sys

# Add the project root directory to the Python path
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)

# Import the Pronostiek class with the correct path
from src.prono_2025.pronostiek import Pronostiek


def create_prediction_breakdown_chart():
    # Initialize Pronostiek and calculate scores
    prono = Pronostiek()
    prono.calculate_scores()

    # Sort players by score in descending order
    sorted_players = sorted(prono.players.values(), key=lambda p: p.score, reverse=True)

    # Prepare data
    players = [p.full_name for p in sorted_players]
    exact_matches = [p.exact_matches for p in sorted_players]
    goal_diff = [p.correct_goal_diff - p.exact_matches for p in sorted_players]
    result_only = [p.correct_result - p.correct_goal_diff for p in sorted_players]
    scores = [p.score for p in sorted_players]

    # Calculate number of games that have been played (with scores recorded)
    games_played = 0
    for i in range(1, 7):
        for j in range(1, 7):
            if i != j and prono.correct_answers[i][j].strip():
                games_played += 1

    # Create figure and axis with square dimensions
    fig, ax = plt.subplots(figsize=(12, 12))

    # Create horizontal bars with smaller height
    y = np.arange(len(players))
    bar_height = 0.4  # Reduced bar height

    # Plot bars in reverse order to show overlapping with distinct colors
    ax.barh(
        y,
        result_only,
        bar_height,
        label="Correct Result Only",
        color="#FF6B6B",  # Bright red
    )
    ax.barh(
        y,
        goal_diff,
        bar_height,
        label="Correct Goal Difference",
        color="#FFD93D",  # Bright yellow
        left=result_only,
    )
    ax.barh(
        y,
        exact_matches,
        bar_height,
        label="Exact Match",
        color="#6BCB77",  # Bright green
        left=[r + g for r, g in zip(result_only, goal_diff)],
    )

    # Add vertical line for played games
    ax.axvline(x=games_played, color="red", linestyle="-", linewidth=2, alpha=0.8)
    ax.text(
        games_played + 0.2,
        len(players) - 1,
        f"Games Played: {games_played}",
        rotation=90,
        va="top",
        ha="left",
        color="red",
        fontweight="bold",
        alpha=0.8,
    )

    # Add score labels with consistent positioning
    max_total = max(
        [r + g + e for r, g, e in zip(result_only, goal_diff, exact_matches)]
    )
    for i, score in enumerate(scores):
        ax.text(max_total + 1, i, f"{score} pts", va="center", fontsize=10)

    # Customize the plot
    ax.set_yticks(y)
    ax.set_yticklabels(players)
    ax.set_xlabel("Number of Predictions")
    ax.set_title("Prediction Breakdown by Player (Ordered by Points)")
    ax.legend()

    # Add some padding to the right to ensure points are visible
    ax.set_xlim(0, max(max_total + 5, games_played + 5))

    # Adjust layout
    plt.tight_layout()

    # Create output directory
    output_dir = os.path.join(os.path.dirname(__file__), "..", "output")
    os.makedirs(output_dir, exist_ok=True)

    # Save the plot
    output_path = os.path.join(output_dir, "prediction_breakdown.png")
    plt.savefig(
        output_path,
        dpi=300,
        bbox_inches="tight",
    )
    print(f"Saved prediction breakdown chart to {output_path}")
    plt.close()


if __name__ == "__main__":
    create_prediction_breakdown_chart()
