import os
import matplotlib.pyplot as plt
import sys
import os

# Add the project root directory to the Python path
sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)

# Now we can import the Pronostiek class correctly
from src.prono_2025.pronostiek import Pronostiek


def create_speeldag_distribution_chart(speeldag=4):
    """
    Create a visualization of prediction distributions for a specific speeldag.
    Shows team logos on left and right, with 3 separate charts for home wins, draws, and away wins.
    """
    # Initialize Pronostiek and calculate scores
    prono = Pronostiek()

    # Get games for the specified speeldag
    speeldag_games = [g for g in prono.games if g.speeldag == speeldag]

    if not speeldag_games:
        print(f"No games found for speeldag {speeldag}")
        return

    # Sort games by rank (order they were played)
    speeldag_games.sort(key=lambda g: g.rank)

    # Create a figure with a subplot for each game
    fig_width = 15
    fig_height = 5 * len(speeldag_games)
    fig = plt.figure(figsize=(fig_width, fig_height))

    # Find max count across all prediction types for consistent scaling
    max_count = 0
    game_data = []

    # First pass to collect data and find max count
    for game in speeldag_games:
        home_team = game.home_team
        away_team = game.away_team

        # Get all predictions for this match
        predictions = []
        for player in prono.players.values():
            pred = player.get_prediction(home_team, away_team)
            if pred and len(pred.strip()) == 3 and pred[1] == "-":
                try:
                    home_score, away_score = map(int, pred.split("-"))
                    predictions.append((home_score, away_score))
                except ValueError:
                    continue

        # Count exact score predictions
        score_counts = {}
        for score in predictions:
            if score in score_counts:
                score_counts[score] += 1
            else:
                score_counts[score] = 1

        # Get specific counts for each result type
        home_win_counts = {
            score: count for score, count in score_counts.items() if score[0] > score[1]
        }
        draw_counts = {
            score: count
            for score, count in score_counts.items()
            if score[0] == score[1]
        }
        away_win_counts = {
            score: count for score, count in score_counts.items() if score[0] < score[1]
        }

        # Calculate total counts and percentages
        total_predictions = len(predictions)
        home_win_total = sum(home_win_counts.values())
        draw_total = sum(draw_counts.values())
        away_win_total = sum(away_win_counts.values())

        home_win_pct = (
            home_win_total / total_predictions * 100 if total_predictions > 0 else 0
        )
        draw_pct = draw_total / total_predictions * 100 if total_predictions > 0 else 0
        away_win_pct = (
            away_win_total / total_predictions * 100 if total_predictions > 0 else 0
        )

        # Sort by count (highest to lowest)
        home_win_items = sorted(home_win_counts.items(), key=lambda x: (-x[1], x[0]))
        draw_items = sorted(draw_counts.items(), key=lambda x: (-x[1], x[0]))
        away_win_items = sorted(away_win_counts.items(), key=lambda x: (-x[1], x[0]))

        # Find max count for scaling
        if home_win_items:
            max_count = max(max_count, max(count for _, count in home_win_items))
        if draw_items:
            max_count = max(max_count, max(count for _, count in draw_items))
        if away_win_items:
            max_count = max(max_count, max(count for _, count in away_win_items))

        # Get actual result if available
        actual_result = ""
        if game.matrix_position:
            i_pos, j_pos = game.matrix_position
            actual_result = prono.correct_answers[i_pos][j_pos].strip()

        # Store data for this game
        game_data.append(
            {
                "home_team": home_team,
                "away_team": away_team,
                "home_win_items": home_win_items,
                "draw_items": draw_items,
                "away_win_items": away_win_items,
                "actual_result": actual_result,
                "home_win_pct": home_win_pct,
                "draw_pct": draw_pct,
                "away_win_pct": away_win_pct,
                "home_win_total": home_win_total,
                "draw_total": draw_total,
                "away_win_total": away_win_total,
                "total_predictions": total_predictions,
            }
        )

    # Add a little padding to max count for visualization
    max_count = max_count * 1.1

    # Second pass to create visualizations with consistent scaling
    for i, data in enumerate(game_data):
        home_team = data["home_team"]
        away_team = data["away_team"]
        home_win_items = data["home_win_items"]
        draw_items = data["draw_items"]
        away_win_items = data["away_win_items"]
        actual_result = data["actual_result"]
        home_win_pct = data["home_win_pct"]
        draw_pct = data["draw_pct"]
        away_win_pct = data["away_win_pct"]
        home_win_total = data["home_win_total"]
        draw_total = data["draw_total"]
        away_win_total = data["away_win_total"]
        total_predictions = data["total_predictions"]

        # Calculate row position
        grid_height = 5  # Height of each game's grid
        row_start = i * grid_height / fig_height
        row_height = grid_height / fig_height

        # Add title for this game
        ax_title = fig.add_axes(
            [0.3, row_start + 0.8 * row_height, 0.4, 0.1 * row_height]
        )
        ax_title.text(
            0.5,
            0.5,
            f"{home_team} vs {away_team}",
            ha="center",
            va="center",
            fontsize=16,
            fontweight="bold",
        )
        ax_title.axis("off")

        # Add actual result if available
        if actual_result:
            ax_title.text(
                0.5,
                0,
                f"Actual result: {actual_result}",
                ha="center",
                va="top",
                fontsize=12,
                fontweight="bold",
            )

        # Try to add team logos
        try:
            # Check if logos are available
            current_dir = os.path.dirname(os.path.abspath(__file__))
            home_logo_path = os.path.join(
                current_dir, "logos", f"{home_team.lower()}.png"
            )
            away_logo_path = os.path.join(
                current_dir, "logos", f"{away_team.lower()}.png"
            )

            # Add home team logo and name on the left
            if os.path.exists(home_logo_path):
                home_img = plt.imread(home_logo_path)
                home_ax = fig.add_axes(
                    [0.05, row_start + 0.35 * row_height, 0.1, 0.2 * row_height]
                )
                home_ax.imshow(home_img)
                home_ax.axis("off")

                # Add home team name
                home_name_ax = fig.add_axes(
                    [0.05, row_start + 0.25 * row_height, 0.1, 0.1 * row_height]
                )
                home_name_ax.text(
                    0.5, 0.5, home_team, ha="center", va="center", fontsize=12
                )
                home_name_ax.axis("off")

            # Add away team logo and name on the right
            if os.path.exists(away_logo_path):
                away_img = plt.imread(away_logo_path)
                away_ax = fig.add_axes(
                    [0.85, row_start + 0.35 * row_height, 0.1, 0.2 * row_height]
                )
                away_ax.imshow(away_img)
                away_ax.axis("off")

                # Add away team name
                away_name_ax = fig.add_axes(
                    [0.85, row_start + 0.25 * row_height, 0.1, 0.1 * row_height]
                )
                away_name_ax.text(
                    0.5, 0.5, away_team, ha="center", va="center", fontsize=12
                )
                away_name_ax.axis("off")
        except Exception as e:
            print(f"Error adding logos: {e}")

        # Create 3 side-by-side bar charts, all left-aligned
        # 1. Home Wins (green)
        ax_home = fig.add_axes(
            [0.2, row_start + 0.1 * row_height, 0.2, 0.6 * row_height]
        )
        if home_win_items:
            scores, counts = zip(*home_win_items) if home_win_items else ([], [])
            y_pos = range(len(counts))
            ax_home.barh(y_pos, counts, align="center", color="#4CAF50")  # Green
            ax_home.set_yticks(y_pos)
            score_labels = [f"{s[0]}-{s[1]}" for s in scores]
            ax_home.set_yticklabels(score_labels)

            # Add count annotations inside bars
            for j, count in enumerate(counts):
                ax_home.text(
                    count / 2,
                    j,
                    str(count),
                    va="center",
                    ha="center",
                    color="white",
                    fontweight="bold",
                )

            title_text = (
                f"Home Wins: {home_win_pct:.1f}% ({home_win_total}/{total_predictions})"
            )
            ax_home.set_title(title_text, fontsize=11)
            ax_home.spines["top"].set_visible(False)
            ax_home.spines["right"].set_visible(False)
            # Set consistent x-axis limit
            ax_home.set_xlim(0, max_count)
        else:
            ax_home.text(0.5, 0.5, "No home wins\npredicted", ha="center", va="center")
            ax_home.axis("off")

        # 2. Draws (yellow)
        ax_draw = fig.add_axes(
            [0.42, row_start + 0.1 * row_height, 0.2, 0.6 * row_height]
        )
        if draw_items:
            scores, counts = zip(*draw_items) if draw_items else ([], [])
            y_pos = range(len(counts))
            ax_draw.barh(y_pos, counts, align="center", color="#FFC107")  # Yellow
            ax_draw.set_yticks(y_pos)
            score_labels = [f"{s[0]}-{s[1]}" for s in scores]
            ax_draw.set_yticklabels(score_labels)

            # Add count annotations
            for j, count in enumerate(counts):
                ax_draw.text(
                    count / 2,
                    j,
                    str(count),
                    va="center",
                    ha="center",
                    color="black",  # Black text for better contrast on yellow
                    fontweight="bold",
                )

            title_text = f"Draws: {draw_pct:.1f}% ({draw_total}/{total_predictions})"
            ax_draw.set_title(title_text, fontsize=11)
            ax_draw.spines["top"].set_visible(False)
            ax_draw.spines["right"].set_visible(False)
            # Set consistent x-axis limit
            ax_draw.set_xlim(0, max_count)
        else:
            ax_draw.text(0.5, 0.5, "No draws\npredicted", ha="center", va="center")
            ax_draw.axis("off")

        # 3. Away Wins (red)
        ax_away = fig.add_axes(
            [0.64, row_start + 0.1 * row_height, 0.2, 0.6 * row_height]
        )
        if away_win_items:
            scores, counts = zip(*away_win_items) if away_win_items else ([], [])
            y_pos = range(len(counts))
            ax_away.barh(y_pos, counts, align="center", color="#F44336")  # Red
            ax_away.set_yticks(y_pos)
            score_labels = [f"{s[0]}-{s[1]}" for s in scores]
            ax_away.set_yticklabels(score_labels)

            # Add count annotations inside bars
            for j, count in enumerate(counts):
                ax_away.text(
                    count / 2,
                    j,
                    str(count),
                    va="center",
                    ha="center",
                    color="white",
                    fontweight="bold",
                )

            title_text = (
                f"Away Wins: {away_win_pct:.1f}% ({away_win_total}/{total_predictions})"
            )
            ax_away.set_title(title_text, fontsize=11)
            ax_away.spines["top"].set_visible(False)
            ax_away.spines["right"].set_visible(False)
            # Set consistent x-axis limit
            ax_away.set_xlim(0, max_count)
        else:
            ax_away.text(0.5, 0.5, "No away wins\npredicted", ha="center", va="center")
            ax_away.axis("off")

    plt.suptitle(
        f"Prediction Distribution for Speeldag {speeldag}", fontsize=18, y=0.98
    )

    # Create output directory structure
    output_dir = os.path.join(
        os.path.dirname(__file__), "..", "output", "visualizations"
    )
    os.makedirs(output_dir, exist_ok=True)

    # Save the figure
    output_path = os.path.join(output_dir, f"speeldag_{speeldag}_distribution.png")
    plt.savefig(
        output_path,
        dpi=300,
        bbox_inches="tight",
    )
    print(f"Saved visualization to {output_path}")
    plt.close()


if __name__ == "__main__":
    for i in range(1, 11):
        create_speeldag_distribution_chart(speeldag=i)
