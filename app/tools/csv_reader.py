import csv
import os
from datetime import datetime

def read_returns_csv(file_path: str) -> list[dict]:
    """Reads and normalizes the returns data from a CSV file.

    Args:
        file_path: Absolute or relative path to the CSV file.

    Returns:
        A list of dictionaries representing normalized order and return data.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"CSV file not found at: {file_path}")

    records = []
    with open(file_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            normalized_row = {}
            for col in reader.fieldnames:
                val = row[col].strip()
                if col in ["order_value_inr", "return_weight_g", "original_weight_g"]:
                    try:
                        normalized_row[col] = float(val) if val else 0.0
                    except ValueError:
                        normalized_row[col] = 0.0
                elif col in ["order_date", "return_date"]:
                    if val:
                        try:
                            # Normalize date format to YYYY-MM-DD
                            dt = datetime.strptime(val, "%Y-%m-%d")
                            normalized_row[col] = dt.strftime("%Y-%m-%d")
                        except ValueError:
                            normalized_row[col] = val
                    else:
                        normalized_row[col] = ""
                else:
                    normalized_row[col] = val
            records.append(normalized_row)
            
    return records
