import os
import csv
from typing import Dict, List, Tuple
from collections import defaultdict


def extract_all_extra_question_answers():
    """
    Extract all player answers to extra questions and organize them by player and question.
    Returns a comprehensive view of all answers.
    """
    # Find the spelers directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    spelers_dir = os.path.join(current_dir, "input", "spelers")

    # Dictionary to store all answers: {player_name: {question: answer}}
    all_answers = defaultdict(dict)

    # Dictionary to store answers by question: {question: [(player, answer)]}
    answers_by_question = defaultdict(list)

    # Extra questions we're looking for
    extra_questions = [
        "Bekerwinnaar",
        "Beste ploeg van POI",
        "Topscorer POI",
        "Assistenkoning POI",
        "Meeste Clean Sheats POI",
        "Meeste gemaakte goals POI",
        "Minste goals tegen POI",
        "Kampioen",
    ]

    # Process each player's CSV file
    for filename in os.listdir(spelers_dir):
        if not filename.endswith(".csv"):
            continue

        # Extract player name from filename
        player_name = filename.replace(".csv", "").replace(".", " ")
        csv_path = os.path.join(spelers_dir, filename)

        try:
            with open(csv_path, "r", encoding="utf-8") as file:
                lines = file.readlines()

                # Process lines starting from line 11 (index 10) where extra questions begin
                for i, line in enumerate(lines):
                    if i < 10:  # Skip match predictions and headers
                        continue

                    parts = line.strip().split(";")
                    if len(parts) < 2 or not parts[0].strip():
                        continue

                    question = parts[0].strip()
                    answer = parts[1].strip() if len(parts) > 1 else ""

                    # Only process extra questions
                    if question in extra_questions and answer:
                        all_answers[player_name][question] = answer
                        answers_by_question[question].append((player_name, answer))

        except Exception as e:
            print(f"Error processing {filename}: {e}")

    return all_answers, answers_by_question


def print_all_answers():
    """Print all answers in a readable format."""
    all_answers, answers_by_question = extract_all_extra_question_answers()

    print("=" * 80)
    print("ALL EXTRA QUESTION ANSWERS BY PLAYER")
    print("=" * 80)

    # Sort players alphabetically
    for player_name in sorted(all_answers.keys()):
        print(f"\n{player_name}:")
        print("-" * len(player_name))

        player_answers = all_answers[player_name]
        for question in [
            "Bekerwinnaar",
            "Beste ploeg van POI",
            "Topscorer POI",
            "Assistenkoning POI",
            "Meeste Clean Sheats POI",
            "Meeste gemaakte goals POI",
            "Minste goals tegen POI",
            "Kampioen",
        ]:
            if question in player_answers:
                print(f"  {question}: {player_answers[question]}")

    print("\n" + "=" * 80)
    print("ALL ANSWERS BY QUESTION")
    print("=" * 80)

    # Print answers organized by question
    for question in [
        "Bekerwinnaar",
        "Beste ploeg van POI",
        "Topscorer POI",
        "Assistenkoning POI",
        "Meeste Clean Sheats POI",
        "Meeste gemaakte goals POI",
        "Minste goals tegen POI",
        "Kampioen",
    ]:
        if question in answers_by_question:
            print(f"\n{question}:")
            print("-" * len(question))

            # Count occurrences of each answer
            answer_counts = defaultdict(int)
            for player, answer in answers_by_question[question]:
                answer_counts[answer] += 1

            # Sort by count (descending) then by answer name
            sorted_answers = sorted(answer_counts.items(), key=lambda x: (-x[1], x[0]))

            print("Summary (Answer: Count):")
            for answer, count in sorted_answers:
                print(f"  {answer}: {count}")

            print("\nDetailed (Player: Answer):")
            # Sort players alphabetically
            sorted_player_answers = sorted(
                answers_by_question[question], key=lambda x: x[0]
            )
            for player, answer in sorted_player_answers:
                print(f"  {player}: {answer}")


def save_to_csv():
    """Save all answers to a CSV file for easy analysis."""
    all_answers, answers_by_question = extract_all_extra_question_answers()

    # Create output directory
    output_dir = os.path.join(os.path.dirname(__file__), "output", "stats")
    os.makedirs(output_dir, exist_ok=True)

    # Save detailed answers by player
    csv_path = os.path.join(output_dir, "all_extra_question_answers.csv")

    with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
        fieldnames = ["Player"] + [
            "Bekerwinnaar",
            "Beste ploeg van POI",
            "Topscorer POI",
            "Assistenkoning POI",
            "Meeste Clean Sheats POI",
            "Meeste gemaakte goals POI",
            "Minste goals tegen POI",
            "Kampioen",
        ]

        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        # Sort players alphabetically
        for player_name in sorted(all_answers.keys()):
            row = {"Player": player_name}
            player_answers = all_answers[player_name]

            for question in fieldnames[1:]:  # Skip "Player" field
                row[question] = player_answers.get(question, "")

            writer.writerow(row)

    print(f"\nDetailed answers saved to: {csv_path}")

    # Save summary by question
    summary_path = os.path.join(output_dir, "extra_question_summary.csv")

    with open(summary_path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Question", "Answer", "Count", "Players"])

        for question in [
            "Bekerwinnaar",
            "Beste ploeg van POI",
            "Topscorer POI",
            "Assistenkoning POI",
            "Meeste Clean Sheats POI",
            "Meeste gemaakte goals POI",
            "Minste goals tegen POI",
            "Kampioen",
        ]:
            if question in answers_by_question:
                # Count occurrences of each answer
                answer_counts = defaultdict(list)
                for player, answer in answers_by_question[question]:
                    answer_counts[answer].append(player)

                # Sort by count (descending) then by answer name
                sorted_answers = sorted(
                    answer_counts.items(), key=lambda x: (-len(x[1]), x[0])
                )

                for answer, players in sorted_answers:
                    writer.writerow(
                        [question, answer, len(players), "; ".join(sorted(players))]
                    )

    print(f"Summary saved to: {summary_path}")


if __name__ == "__main__":
    print_all_answers()
    save_to_csv()
