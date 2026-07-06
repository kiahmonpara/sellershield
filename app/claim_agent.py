import os
from datetime import datetime
from app.tools.claim_formatter import generate_claim_document

class ClaimAgent:
    """Agent responsible for writing copy-pasteable marketplace claims for approved fraud cases."""
    
    def __init__(self):
        self.name = "claim_agent"

    def run(self, approved_dossiers: list[dict], claims_dir: str = "data/claims") -> list[dict]:
        """Drafts and saves claims for all approved dossiers.

        Args:
            approved_dossiers: List of evidence dossiers approved by the human reviewer.
            claims_dir: Directory where claim files should be written.

        Returns:
            List of generated claim dictionaries.
        """
        print(f"[{self.name}] Generating marketplace claims for approved accounts...")
        
        # Ensure target claims directory exists
        if not os.path.exists(claims_dir):
            os.makedirs(claims_dir, exist_ok=True)
            
        generated_claims = []
        current_date_str = datetime.now().strftime("%Y-%m-%d")

        for d in approved_dossiers:
            profile = d.get("profile")
            history = d.get("history")
            
            # Formulate the drafts
            claim_drafts = generate_claim_document(profile, history, current_date_str)
            
            # Write generic claim file to the local directory
            target_path = os.path.join(claims_dir, claim_drafts["target_file"])
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(claim_drafts["generic"])
                
            claim_drafts["file_path"] = target_path
            generated_claims.append(claim_drafts)
            print(f"[{self.name}] Wrote claim file for {profile['customer_id']} to: {target_path}")
            
        return generated_claims
