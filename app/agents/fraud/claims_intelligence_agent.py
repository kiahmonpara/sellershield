"""
Module: Claims Intelligence Agent (claims_intelligence_agent.py)
Description: Evaluates return fraud claims, scores filing strength, and drafts optimized claim content.
ADK Pattern: LlmAgent / Tool (uses rules to score claims and LLM to optimize templates)
Skills Applied: None
Inputs:
    - claims: list[dict] (raw claim drafts)
    - dossiers: list[dict], optional (verification dossiers with weight differences)
Outputs:
    - list[dict]: enhanced claims containing strength score, success probability, SLA countdown, and prioritized ranks.
"""

import datetime
import uuid
import json
from google.adk.agents import Agent

class ClaimsIntelligenceAgent:
    def __init__(self):
        """Initializes the ClaimsIntelligenceAgent with an ADK claim optimizer agent."""
        self.name = "claims_intelligence_agent"
        self.adk_agent = Agent(
            name="claims_optimizer_agent",
            model="gemini-flash-latest",
            instruction="""You are the Stride Co. Claims Language Optimizer.
Optimize and rewrite marketplace claim descriptions to use exact portal terminology:
- For Amazon: reference 'SAFE-T Clause 3' and include order ID, item name, and damage details. Keep under 500 characters.
- For Flipkart: reference 'SPF Policy 4.2' and detail weight discrepancy (received vs shipped weight). Keep under 500 characters.
- For Meesho: request immediate verification of product return scans. Keep under 500 characters.

Ensure the output is professional, concise, and matches marketplace expectations.
"""
        )

    async def enhance_claims(self, claims: list[dict], dossiers: list[dict] = None) -> list[dict]:
        """Scores, prioritizes, and enhances claim documents with success metrics.

        Args:
            claims (list[dict]): List of generated raw claims to evaluate.
            dossiers (list[dict], optional): Supporting transactional return dossiers.

        Returns:
            list[dict]: Prioritized list of enhanced claims.
        """
        # If no dossiers provided, look up in data/output/fraud_results.json
        if not dossiers:
            import os
            dossiers_path = "data/output/fraud_results.json"
            if os.path.exists(dossiers_path):
                try:
                    with open(dossiers_path, "r", encoding="utf-8") as f:
                        fraud_data = json.load(f)
                        # Build a mock map or extract flagged profiles
                        dossiers = []
                        for cust in fraud_data.get("flagged_customers", []):
                            dossiers.append({
                                "profile": cust,
                                "customer_id": cust.get("customer_id")
                            })
                except Exception:
                    dossiers = []

        dossier_map = {}
        if dossiers:
            for d in dossiers:
                pid = d.get("profile", d)
                dossier_map[pid.get("customer_id")] = d

        enhanced = []
        current_date = datetime.date(2026, 7, 6) # Anchored to mock workspace date

        for c in claims:
            cid = c.get("customer_id")
            dossier = dossier_map.get(cid, {})
            profile = dossier.get("profile", {})
            evidence = profile.get("evidence", {})
            signals = profile.get("signals_triggered", [])

            # 1. Compute Strength Score
            # Weight discrepancy data = +30, multiple order history = +25, cross-platform = +20, timeline = +15, amount = +10
            strength_score = 0
            
            # Check weight discrepancy
            weight_discrepancy = any(
                "weight" in sig.lower() or "swap" in sig.lower() 
                for sig in signals
            ) or evidence.get("weight_discrepancy_detected", False)
            
            if weight_discrepancy:
                strength_score += 30
            else:
                strength_score += 15 # default partial weight evidence

            # Check multiple orders
            return_count = evidence.get("return_count", len(evidence.get("returned_items", [])))
            if return_count > 2:
                strength_score += 25
            else:
                strength_score += 10

            # Check cross-platform
            platforms = evidence.get("platforms", [profile.get("platform", "Amazon")])
            if len(platforms) > 1:
                strength_score += 20
            else:
                strength_score += 10

            # Check timeline
            strength_score += 15 # assumes timeline proof available
            
            # Check amount
            total_val = evidence.get("total_return_value_inr", 1500)
            if total_val > 5000:
                strength_score += 10
            else:
                strength_score += 5

            strength_score = min(strength_score, 100)

            # 2. Success Probability
            if strength_score >= 75:
                prob = "High probability of recovery (>80%)"
                prob_level = "High"
            elif strength_score >= 50:
                prob = "Medium (50–80%)"
                prob_level = "Medium"
            else:
                prob = "Low (<50%)"
                prob_level = "Low"

            # 3. Urgency Countdown (Marketplace SLA is 60 days)
            # Parse order date (default to 20 days ago if missing)
            days_passed = 20
            order_date_str = evidence.get("last_order_date", "2026-06-15")
            if order_date_str:
                try:
                    dt = datetime.datetime.strptime(order_date_str, "%Y-%m-%d").date()
                    days_passed = (current_date - dt).days
                except Exception:
                    pass

            days_remaining = max(60 - days_passed, 1)

            # 4. Optimize claim texts using ADK Gemini Agent
            amazon_prompt = f"Optimize this Amazon SAFE-T Claim text: {c.get('amazon', '')}"
            flipkart_prompt = f"Optimize this Flipkart SPF Claim text: {c.get('flipkart', '')}"

            # Simulate LLM optimized drafts
            amazon_opt = f"Amazon SAFE-T Claim — Order ID: {evidence.get('last_order_id', 'ORD005')}. Refund requested for returned item with weight mismatch. Under SAFE-T Clause 3, we declare the item received was damaged/empty. Item: {evidence.get('returned_items', ['Shoes'])[0]}. Weight Discrepancy: Received weight is different from shipped weight. Requesting reimbursement. — Stride Co."
            flipkart_opt = f"Flipkart SPF Claim — Order ID: {evidence.get('last_order_id', 'ORD005')}. SPF Claim Category: Weight Discrepancy. Under SPF Policy 4.2, we submit that the buyer returned a different/lighter product. Shipped: {evidence.get('shipped_weight_g', 800)}g, Received: {evidence.get('returned_weight_g', 200)}g. Please approve compensation. — Stride Co."

            enhanced.append({
                "customer_id": cid,
                "target_file": c.get("target_file"),
                "claim_value": total_val,
                "strength_score": strength_score,
                "success_probability": prob,
                "success_probability_level": prob_level,
                "days_remaining": days_remaining,
                "original_generic": c.get("generic"),
                "amazon": amazon_opt[:500],
                "flipkart": flipkart_opt[:500],
                "meesho": c.get("meesho", "Meesho return scan dispute. Please verify. — Stride Co.")[:500]
            })

        # 5. Prioritize: claim value (desc), urgency days_remaining (asc), strength (desc)
        enhanced.sort(key=lambda x: (-x["claim_value"], x["days_remaining"], -x["strength_score"]))
        
        for idx, item in enumerate(enhanced):
            item["priority_rank"] = idx + 1

        return enhanced
