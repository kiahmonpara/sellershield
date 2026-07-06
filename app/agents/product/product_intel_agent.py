"""
Module: Product Intelligence Synthesizer Agent (product_intel_agent.py)
Description: Gathers metrics across all 3 modules for a single footwear SKU and runs LLM synthesis to calculate overall risk levels and categorize recommendations.
ADK Pattern: LlmAgent / Tool (aggregates metrics across JSON files, then runs LLM synthesis)
Skills Applied: None
Inputs:
    - product_id: str (product catalog or reviews ID)
Outputs:
    - dict: aggregated metrics, overall synthesized risk level, and recommended actions.
"""

import os
import json
import uuid
from google.adk.agents import Agent
from app.tools.csv_reader import read_returns_csv

ID_MAP = {
    "PROD-A": {"pid_reviews": "PROD-001", "pid_catalog": "PROD-A", "name": "Elite Runner Pro"},
    "PROD-B": {"pid_reviews": "PROD-002", "pid_catalog": "PROD-B", "name": "StrideClean Spray"},
    "PROD-C": {"pid_reviews": "PROD-003", "pid_catalog": "PROD-C", "name": "OrthoPro Insoles"},
    "PROD-D": {"pid_reviews": "PROD-004", "pid_catalog": "PROD-D", "name": "LaceUp Reflective Laces"},
    "PROD-E": {"pid_reviews": "PROD-005", "pid_catalog": "PROD-E", "name": "CloudWalk Sneakers"},
    "PROD-F": {"pid_reviews": "PROD-006", "pid_catalog": "PROD-F", "name": "TrailBlazer Hiking Shoes"},
    
    "PROD-001": {"pid_reviews": "PROD-001", "pid_catalog": "PROD-A", "name": "Elite Runner Pro"},
    "PROD-002": {"pid_reviews": "PROD-002", "pid_catalog": "PROD-B", "name": "StrideClean Spray"},
    "PROD-003": {"pid_reviews": "PROD-003", "pid_catalog": "PROD-C", "name": "OrthoPro Insoles"},
    "PROD-004": {"pid_reviews": "PROD-004", "pid_catalog": "PROD-D", "name": "LaceUp Reflective Laces"},
    "PROD-005": {"pid_reviews": "PROD-005", "pid_catalog": "PROD-E", "name": "CloudWalk Sneakers"},
    "PROD-006": {"pid_reviews": "PROD-006", "pid_catalog": "PROD-F", "name": "TrailBlazer Hiking Shoes"}
}

class ProductIntelAgent:
    def __init__(self):
        """Initializes the product intelligence agent with an ADK risk synthesizer."""
        self.name = "product_intel_agent"
        self.adk_agent = Agent(
            name="product_risk_synthesizer",
            model="gemini-flash-latest",
            instruction="""You are the SellerShield product intelligence synthesizer for Stride Co.
Take the gathered product metrics across Return Fraud, Review Authenticity, and Price Intelligence, and output:
1. overall_risk: "HIGH", "MEDIUM", or "LOW" based on return fraud rate, fake reviews, or pricing threats.
2. recommended_actions: a list of specific, numbered action items. Prefix each item with its category: [FRAUD], [REVIEWS], or [PRICING].

Always format your response as valid JSON matching this schema:
{
  "overall_risk": "HIGH/MEDIUM/LOW",
  "recommended_actions": [
    "[FRAUD] Submit claims against customer Rajesh Kumar to recover ₹17,700.",
    "[PRICING] Reprice Elite Runner Pro to match SpeedStep at ₹2,497."
  ]
}
"""
        )

    async def get_product_intel(self, product_id: str) -> dict:
        """Gathers multi-module analytics and synthesizes an overall product risk profile.

        Args:
            product_id (str): Unique product catalog ID.

        Returns:
            dict: Aggregated product risk profiles and recommendation actions.
        """
        mapping = ID_MAP.get(product_id)
        if not mapping:
            return {"error": f"Product ID {product_id} not found in catalog."}
        
        product_name = mapping["name"]
        catalog_id = mapping["pid_catalog"]
        reviews_id = mapping["pid_reviews"]

        # 1. Fraud Metrics
        return_rate_pct = 0.0
        flagged_customers = []
        claim_value_inr = 0.0
        
        csv_path = "data/sample_returns.csv"
        if os.path.exists(csv_path):
            records = read_returns_csv(csv_path)
            prod_records = [r for r in records if r.get("item_name") == product_name]
            total_orders = len(prod_records)
            total_returns = len([r for r in prod_records if r.get("return_date")])
            if total_orders > 0:
                return_rate_pct = round((total_returns / total_orders) * 100, 1)
            
            # Check flagged customers
            fraud_path = "data/output/fraud_results.json"
            if os.path.exists(fraud_path):
                with open(fraud_path, "r", encoding="utf-8") as f:
                    fraud_data = json.load(f)
                    flagged = fraud_data.get("flagged_customers", [])
                    for fc in flagged:
                        # Did this customer return this product?
                        cust_returns = [r for r in prod_records if r.get("customer_id") == fc["customer_id"] and r.get("return_date")]
                        if cust_returns:
                            flagged_customers.append(fc["customer_id"])
                            claim_value_inr += sum(r["order_value_inr"] for r in cust_returns)

        # 2. Reviews Metrics
        authenticity_score = 100
        verdict = "TRUSTWORTHY"
        adjusted_rating = 5.0
        fake_count = 0
        
        review_path = "data/output/review_results.json"
        if os.path.exists(review_path):
            with open(review_path, "r", encoding="utf-8") as f:
                review_data = json.load(f)
                products = review_data.get("products", {})
                if reviews_id in products:
                    p_info = products[reviews_id]
                    authenticity_score = p_info.get("overall_authenticity_score", 100)
                    verdict = p_info.get("verdict", "TRUSTWORTHY")
                    adjusted_rating = p_info.get("adjusted_rating", 5.0)
                    fake_count = p_info.get("fake_review_count", 0)

        # 3. Pricing Metrics
        price_position = "cheapest"
        undercut_by = None
        strategy = "Premium"
        urgency = "STABLE"
        
        pricing_path = "data/output/pricing_results.json"
        if os.path.exists(pricing_path):
            with open(pricing_path, "r", encoding="utf-8") as f:
                pricing_data = json.load(f)
                prods = pricing_data.get("products", [])
                for p in prods:
                    if p.get("product_id") == catalog_id:
                        p_anal = p.get("analysis", {})
                        price_position = p_anal.get("price_position", "cheapest")
                        undercutting = p_anal.get("undercutting_detected", False)
                        undercut_competitor = p_anal.get("undercutting_competitor")
                        if undercutting and undercut_competitor:
                            undercut_by = undercut_competitor
                        strategy = p.get("strategy", {}).get("strategy", "Premium")
                        urgency = p.get("strategy", {}).get("urgency", "STABLE")
                        break

        # Pass to Gemini ADK Agent for synthesis
        payload = {
            "product_id": catalog_id,
            "product_name": product_name,
            "fraud": {
                "return_rate_pct": return_rate_pct,
                "flagged_customers": list(set(flagged_customers)),
                "claim_value_inr": claim_value_inr
            },
            "reviews": {
                "authenticity_score": authenticity_score,
                "verdict": verdict,
                "adjusted_rating": adjusted_rating,
                "fake_count": fake_count
            },
            "pricing": {
                "price_position": price_position,
                "undercut_by": undercut_by,
                "strategy": strategy,
                "urgency": urgency
            }
        }

        prompt = f"Synthesize product intelligence for {product_name}:\n{json.dumps(payload, indent=2)}"
        
        from google.adk.runners import Runner
        from google.adk.apps import App
        from google.adk.sessions import InMemorySessionService
        from google.adk.artifacts import InMemoryArtifactService
        
        chat_app = App(root_agent=self.adk_agent, name="product_synthesizer")
        runner = Runner(
            app=chat_app,
            session_service=InMemorySessionService(),
            artifact_service=InMemoryArtifactService(),
            auto_create_session=True,
        )
        
        from google.genai import types
        content = types.Content(parts=[types.Part.from_text(text=prompt)])
        
        response_text = ""
        async for event in runner.run_async(user_id="system", session_id=str(uuid.uuid4()), new_message=content):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        response_text += part.text

        # Clean JSON from response if any markdown ticks
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        response_text = response_text.strip()

        try:
            synth = json.loads(response_text)
        except Exception:
            synth = {
                "overall_risk": "LOW",
                "recommended_actions": ["[REVIEWS] Monitor recent ratings spreads."]
            }

        payload["overall_risk"] = synth.get("overall_risk", "LOW")
        payload["recommended_actions"] = synth.get("recommended_actions", [])
        
        return payload
