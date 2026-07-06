"""
Module: Alert Agent (alert_agent.py)
Description: Generates, monitors, and manages persistent seller health alerts and notifications for the dashboard.
ADK Pattern: LlmAgent / Tool (acts as a listener for pipeline run outputs and calculates severity-based alerts)
Skills Applied: None
Inputs:
    - data: dict (raw JSON results from Return, Review, or Pricing pipelines)
Outputs:
    - list or dict: list of active alerts or created alert objects.
"""

import os
import json
import uuid
import datetime
from google.adk.agents import Agent

ALERTS_PATH = "data/output/alerts.json"

class AlertAgent:
    def __init__(self):
        """Initializes the AlertAgent with an ADK LLM Agent for anomaly summarization."""
        self.name = "alert_agent"
        # ADK Agent definition for summarizing alerts using LLM reasoning
        self.adk_agent = Agent(
            name="alert_summarizer_agent",
            model="gemini-flash-latest",
            instruction="""You are the SellerShield Alert Generator for Stride Co.
Take the analysis anomaly details and generate a concise alert title (max 60 chars) and description (max 120 chars).
Return valid JSON only matching the schema:
{
  "title": "Concise alert title",
  "description": "Short explanation of the anomaly."
}
"""
        )

    def get_alerts(self, include_dismissed: bool = False) -> list:
        """Reads active or all alerts from the local data store.

        Args:
            include_dismissed (bool): Whether to include dismissed notifications.

        Returns:
            list: List of alerts (dictionaries).
        """
        if not os.path.exists(ALERTS_PATH):
            return []
        try:
            with open(ALERTS_PATH, "r", encoding="utf-8") as f:
                alerts = json.load(f)
            # Filter based on read status if requested
            if not include_dismissed:
                return [a for a in alerts if not a.get("dismissed", False)]
            return alerts
        except Exception:
            return []

    def dismiss_alert(self, alert_id: str) -> bool:
        """Marks a specific alert as dismissed.

        Args:
            alert_id (str): Unique identifier of the target alert.

        Returns:
            bool: True if the alert was found and marked dismissed, False otherwise.
        """
        if not os.path.exists(ALERTS_PATH):
            return False
        try:
            with open(ALERTS_PATH, "r", encoding="utf-8") as f:
                alerts = json.load(f)
            # Find and toggle dismissed flag to persist user action
            for a in alerts:
                if a.get("id") == alert_id:
                    a["dismissed"] = True
                    break
            with open(ALERTS_PATH, "w", encoding="utf-8") as f:
                json.dump(alerts, f, indent=2)
            return True
        except Exception:
            return False

    def dismiss_all_alerts(self) -> bool:
        """Marks all alerts in the database as dismissed.

        Returns:
            bool: True if operation succeeded, False otherwise.
        """
        if not os.path.exists(ALERTS_PATH):
            return False
        try:
            with open(ALERTS_PATH, "r", encoding="utf-8") as f:
                alerts = json.load(f)
            # Redact/dismiss all existing warnings simultaneously
            for a in alerts:
                a["dismissed"] = True
            with open(ALERTS_PATH, "w", encoding="utf-8") as f:
                json.dump(alerts, f, indent=2)
            return True
        except Exception:
            return False

    def add_alert(self, severity: str, module: str, title: str, description: str, action_link: str = None) -> dict:
        """Adds a new alert to the datastore. Avoids duplicate active notifications.

        Args:
            severity (str): Threat severity (INFO, WARNING, CRITICAL).
            module (str): Module originating the alert (e.g. Return Fraud).
            title (str): Concise subject of the warning.
            description (str): Longer context details.
            action_link (str, optional): Redirection path for the frontend drawer.

        Returns:
            dict: The created or matched active alert dictionary.
        """
        os.makedirs(os.path.dirname(ALERTS_PATH), exist_ok=True)
        alerts = self.get_alerts(include_dismissed=True)
        
        # Check duplicates: don't add if duplicate title and module to avoid notification fatigue
        for a in alerts:
            if a.get("title") == title and a.get("module") == module and not a.get("dismissed", False):
                return a
                
        new_alert = {
            "id": f"alert_{uuid.uuid4().hex[:12]}",
            "severity": severity.upper(), # CRITICAL, WARNING, INFO
            "module": module,
            "title": title[:60],
            "description": description[:120],
            "action_link": action_link,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "dismissed": False
        }
        alerts.insert(0, new_alert)
        with open(ALERTS_PATH, "w", encoding="utf-8") as f:
            json.dump(alerts, f, indent=2)
        return new_alert

    async def generate_alerts_from_analysis(self, module: str, data: dict):
        """Generates plain-English alerts dynamically from pipeline runs.

        Args:
            module (str): Name of the source pipeline module (e.g. "Return Fraud").
            data (dict): The output payload of the analysis pipeline.
        """
        # Parse return fraud anomalies
        if module == "Return Fraud":
            flagged = data.get("flagged_customers", [])
            for fc in flagged:
                if fc.get("risk_level") == "HIGH_RISK":
                    self.add_alert(
                        severity="CRITICAL",
                        module=module,
                        title=f"High-Risk Fraud Customer: {fc.get('customer_id')}",
                        description=f"Customer flagged for return abuse ring. Risk score: {fc.get('risk_score', fc.get('score', 0))}/100.",
                        action_link="/?tab=results"
                    )
                elif fc.get("risk_level") == "MEDIUM_RISK":
                    self.add_alert(
                        severity="WARNING",
                        module=module,
                        title=f"Suspicious Account Flagged: {fc.get('customer_id')}",
                        description=f"Medium risk return pattern detected. Claim draft is prepared.",
                        action_link="/?tab=results"
                    )
        # Parse review rating authenticity anomalies
        elif module == "Review Authenticity":
            products = data.get("products", {})
            for pid, p in products.items():
                if p.get("verdict") == "MANIPULATED" or p.get("verdict") == "DECEPTIVE":
                    self.add_alert(
                        severity="CRITICAL",
                        module=module,
                        title=f"Manipulated Ratings on {p.get('product_title')}",
                        description=f"Authenticity score fell to {p.get('overall_authenticity_score')}% with suspicious review velocity.",
                        action_link="/reviews"
                    )
                elif p.get("verdict") == "SUSPICIOUS":
                    self.add_alert(
                        severity="WARNING",
                        module=module,
                        title=f"Suspicious Reviews Detected",
                        description=f"Footwear product {p.get('product_title')} flagged for spam patterns.",
                        action_link="/reviews"
                    )
        # Parse competitor pricing and undercut threats
        elif module == "Price Intelligence":
            prods = data.get("products", [])
            being_undercut = sum(1 for p in prods if p.get("analysis", {}).get("undercutting_detected", False))
            price_wars = sum(1 for p in prods if p.get("analysis", {}).get("price_war_active", False))
            if price_wars > 0:
                self.add_alert(
                    severity="CRITICAL",
                    module=module,
                    title="Active Price War Detected",
                    description=f"Competitors are aggressively undercutting Stride Co. prices on {price_wars} items.",
                    action_link="/pricing"
                )
            elif being_undercut > 0:
                self.add_alert(
                    severity="WARNING",
                    module=module,
                    title="Stride Co. Undercut by Competitors",
                    description=f"Competitors are pricing lower on {being_undercut} products. Buy-Box at risk.",
                    action_link="/pricing"
                )
