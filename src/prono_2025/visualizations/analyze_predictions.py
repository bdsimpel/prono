import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter

# Name standardization mappings
NAME_MAPPINGS = {
    "Hans Vanaken": "Vanaken",
    "Hans": "Vanaken",
    "Promise David": "Promise",
    "Simon Mignolet": "Mignolet",
    "Mignolet ": "Mignolet",
    "Morris": "Moris",
}

# List of teams for categorization
TEAMS = ["Club Brugge", "Genk", "Union", "Anderlecht", "Gent", "Antwerp"]


def standardize_name(name):
    """Standardize player names according to the mapping."""
    name = name.strip()  # Remove trailing spaces
    return NAME_MAPPINGS.get(name, name)


def is_team_prediction(prediction):
    """Check if a prediction is a team name."""
    return any(team.lower() in prediction.lower() for team in TEAMS)


def load_player_predictions(file_path):
    """Load a player's predictions from CSV file."""
    df = pd.read_csv(file_path, sep=";", index_col=0)
    return df


def analyze_match_predictions(df):
    """Analyze the match predictions (first 6x6 matrix)."""
    predictions = []
    for i in range(6):
        for j in range(6):
            if i != j:  # Skip diagonal
                pred = df.iloc[i, j]
                if isinstance(pred, str) and "-" in pred:
                    predictions.append(pred)
    return predictions


def analyze_bonus_predictions(df):
    """Analyze the bonus predictions (last 8 rows)."""
    bonus_predictions = {}
    bonus_questions = [
        "Bekerwinnaar",
        "Beste ploeg van POI",
        "Topscorer POI",
        "Assistenkoning POI",
        "Meeste Clean Sheats POI",
        "Meeste gemaakte goals POI",
        "Minste goals tegen POI",
        "Kampioen",
    ]

    for question in bonus_questions:
        if question in df.index:
            pred = df.loc[question, "Genk"]
            if isinstance(pred, str):
                # Remove parentheses and standardize name
                pred = pred.strip("()")
                pred = standardize_name(pred)
                bonus_predictions[question] = pred

    return bonus_predictions


def plot_score_distribution(predictions, output_dir):
    """Plot the distribution of score predictions."""
    # Count occurrences of each score
    score_counts = Counter(predictions)

    # Create a DataFrame for plotting
    scores_df = pd.DataFrame.from_dict(score_counts, orient="index", columns=["count"])
    scores_df = scores_df.sort_values("count", ascending=False)

    # Plot
    plt.figure(figsize=(12, 6))
    sns.barplot(x=scores_df.index, y="count", data=scores_df)
    plt.title("Distribution of Score Predictions")
    plt.xlabel("Score")
    plt.ylabel("Count")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "score_distribution.png"))
    plt.close()


def plot_bonus_distribution(bonus_predictions, output_dir):
    """Plot the distribution of bonus predictions."""
    # Separate team and player predictions
    team_predictions = {}
    player_predictions = {}

    for question, predictions in bonus_predictions.items():
        team_preds = []
        player_preds = []

        for pred in predictions:
            if is_team_prediction(pred):
                team_preds.append(pred)
            else:
                player_preds.append(pred)

        if team_preds:
            team_predictions[question] = team_preds
        if player_preds:
            player_predictions[question] = player_preds

    # Plot team predictions as pie charts
    for question, predictions in team_predictions.items():
        plt.figure(figsize=(10, 10))
        counts = Counter(predictions)
        plt.pie(counts.values(), labels=counts.keys(), autopct="%1.1f%%")
        plt.title(f"Distribution of {question} (Teams)")
        plt.tight_layout()
        plt.savefig(
            os.path.join(
                output_dir, f'{question.lower().replace(" ", "_")}_teams_pie.png'
            )
        )
        plt.close()

    # Plot player predictions as bar charts
    for question, predictions in player_predictions.items():
        plt.figure(figsize=(12, 6))
        counts = Counter(predictions)
        counts_df = pd.DataFrame.from_dict(counts, orient="index", columns=["count"])
        counts_df = counts_df.sort_values("count", ascending=False)

        sns.barplot(x=counts_df.index, y="count", data=counts_df)
        plt.title(f"Distribution of {question} (Players)")
        plt.xlabel("Player")
        plt.ylabel("Count")
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(
            os.path.join(
                output_dir, f'{question.lower().replace(" ", "_")}_players_bar.png'
            )
        )
        plt.close()


def main():
    # Create output directory for plots
    output_dir = os.path.join(os.path.dirname(__file__), "..", "output", "analysis")
    os.makedirs(output_dir, exist_ok=True)

    # Directory containing player prediction files
    predictions_dir = os.path.join(os.path.dirname(__file__), "..", "input", "spelers")

    # Initialize lists to store all predictions
    all_match_predictions = []
    all_bonus_predictions = {
        question: []
        for question in [
            "Bekerwinnaar",
            "Beste ploeg van POI",
            "Topscorer POI",
            "Assistenkoning POI",
            "Meeste Clean Sheats POI",
            "Meeste gemaakte goals POI",
            "Minste goals tegen POI",
            "Kampioen",
        ]
    }

    # Process each player's predictions
    for filename in os.listdir(predictions_dir):
        if filename.endswith(".csv"):
            file_path = os.path.join(predictions_dir, filename)
            df = load_player_predictions(file_path)

            # Analyze match predictions
            match_predictions = analyze_match_predictions(df)
            all_match_predictions.extend(match_predictions)

            # Analyze bonus predictions
            bonus_predictions = analyze_bonus_predictions(df)
            for question, pred in bonus_predictions.items():
                all_bonus_predictions[question].append(pred)

    # Plot distributions
    plot_score_distribution(all_match_predictions, output_dir)
    plot_bonus_distribution(all_bonus_predictions, output_dir)

    # Print some statistics
    print("\nMatch Prediction Statistics:")
    print(f"Total number of match predictions: {len(all_match_predictions)}")
    print(f"Number of unique scores predicted: {len(set(all_match_predictions))}")

    print("\nMost common score predictions:")
    score_counts = Counter(all_match_predictions)
    for score, count in score_counts.most_common(5):
        print(f"{score}: {count} times")

    print("\nBonus Prediction Statistics:")
    for question, predictions in all_bonus_predictions.items():
        print(f"\n{question}:")
        pred_counts = Counter(predictions)
        for pred, count in pred_counts.most_common():
            print(f"  {pred}: {count} times")


if __name__ == "__main__":
    main()
