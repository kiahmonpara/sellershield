import os
from google.adk.agents import Agent
from google.adk.models import Gemini
from app.tools.csv_reader import read_returns_csv

class IngestionAgent:
    """Agent responsible for reading and validating transaction and return data."""
    
    def __init__(self):
        self.name = "ingestion_agent"
        
    def run(self, csv_path: str) -> list[dict]:
        """Loads data from the returns CSV.

        Args:
            csv_path: Path to the target CSV file.

        Returns:
            List of transaction dictionaries.
        """
        print(f"[{self.name}] Ingesting data from: {csv_path}")
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"File not found: {csv_path}")
        return read_returns_csv(csv_path)
