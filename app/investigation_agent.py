class InvestigationAgent:
    """Agent responsible for compiling transaction histories and evidence dossiers for flagged customers."""
    
    def __init__(self):
        self.name = "investigation_agent"

    def run(self, profiles: list[dict], raw_records: list[dict]) -> list[dict]:
        """Builds evidence dossiers for flagged customers.

        Args:
            profiles: List of customer risk profiles.
            raw_records: The raw records that were ingested.

        Returns:
            List of dictionaries containing profile and raw transaction history for flagged users.
        """
        print(f"[{self.name}] Building evidence dossiers for flagged customers...")
        
        # Filter for suspicious profiles (MEDIUM or HIGH risk)
        suspicious_profiles = [p for p in profiles if p.get("risk_level") in ["MEDIUM_RISK", "HIGH_RISK"]]
        
        dossiers = []
        for p in suspicious_profiles:
            cid = p.get("customer_id")
            
            # Extract customer's transaction and return history
            history = [r for r in raw_records if r.get("customer_id") == cid]
            
            # Sort history by date
            history.sort(key=lambda x: x.get("order_date", ""))
            
            dossiers.append({
                "profile": p,
                "history": history
            })
            
        print(f"[{self.name}] Compiled {len(dossiers)} evidence dossier(s).")
        return dossiers
