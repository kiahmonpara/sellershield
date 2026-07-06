from google.adk.agents import Agent
from app.tools.risk_scorer import calculate_customer_risk

class PatternAgent:
    """Agent responsible for running fraud signals analysis and risk scoring."""
    
    def __init__(self):
        self.name = "pattern_agent"

    def run(self, records: list[dict]) -> list[dict]:
        """Calculates risk levels and scores across all customers.

        Args:
            records: List of parsed transaction dictionaries.

        Returns:
            List of customer risk profiles.
        """
        print(f"[{self.name}] Analyzing return patterns for fraud signals...")
        return calculate_customer_risk(records)
