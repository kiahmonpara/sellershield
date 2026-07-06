"""
Module: AI Chat Assistant Agent (chat_agent.py)
Description: A conversational interface that answers seller queries using Return Fraud, Review, and Pricing telemetry.
ADK Pattern: LlmAgent (wired with 5 tools that can programmatically run pipelines if JSON files are missing)
Skills Applied: chat-assistant (PII masking guidelines, citation constraints, number formatting rules)
Inputs:
    - user message: str (via REST API)
Outputs:
    - agent response: str (containing citations and masked customer names)
"""

import os
import json
from google.adk.agents import Agent

def get_fraud_summary() -> dict:
    """Reads Return Fraud analysis results. If no analysis has been run yet, runs it automatically.

    Returns:
        dict: Flagged customer risk records and total disputed claim value.
    """
    path = "data/output/fraud_results.json"
    # Triggering pipeline programmatically if data doesn't exist yet to achieve full chatbot autonomy
    if not os.path.exists(path):
        try:
            csv_path = "data/sample_returns.csv"
            if os.path.exists(csv_path):
                from app.ingestion_agent import IngestionAgent
                from app.pattern_agent import PatternAgent
                ing_rec = IngestionAgent().run(csv_path)
                fraud_profiles = PatternAgent().run(ing_rec)
                os.makedirs("data/output", exist_ok=True)
                flagged = [p for p in fraud_profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
                total_val = sum(p["evidence"]["total_return_value_inr"] for p in flagged)
                res_data = {
                    "flagged_customers": flagged,
                    "total_claim_value_inr": total_val
                }
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(res_data, f, indent=2)
                return res_data
        except Exception as e:
            return {"error": f"Failed to auto-run Return Fraud: {str(e)}"}
            
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

def get_review_summary() -> dict:
    """Reads Review Authenticity analysis results. If no analysis has been run yet, runs it automatically.

    Returns:
        dict: Review authenticity status, fake count, and ratings adjustments per product.
    """
    path = "data/output/review_results.json"
    # Programmatically runs reviews verification orchestrator over Stride Co. products on demand
    if not os.path.exists(path):
        try:
            reviews_path = "data/sample_reviews.json"
            if os.path.exists(reviews_path):
                with open(reviews_path, "r", encoding="utf-8") as f:
                    reviews_data = json.load(f)
                from app.agents.reviews.reviews_orchestrator import ReviewsOrchestrator
                rev_orch = ReviewsOrchestrator()
                review_summary_db = {}
                for p in reviews_data:
                    if p.get("brand") == "Stride Co." or "PROD-" in p.get("product_id", ""):
                        res = rev_orch.run(
                            product_id=p.get("product_id"),
                            platform=p.get("platform", "Amazon"),
                            reviews=p.get("reviews", []),
                            product_title=p.get("product_title", "")
                        )
                        review_summary_db[p.get("product_id")] = {
                            "product_title": p.get("product_title"),
                            "verdict": res.get("verdict"),
                            "overall_authenticity_score": res.get("overall_authenticity_score"),
                            "displayed_rating": res.get("displayed_rating"),
                            "adjusted_rating": res.get("adjusted_rating"),
                            "fake_review_count": res.get("fake_review_count"),
                            "genuine_review_count": res.get("genuine_review_count")
                        }
                res_data = {"products": review_summary_db}
                os.makedirs("data/output", exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(res_data, f, indent=2)
                return res_data
        except Exception as e:
            return {"error": f"Failed to auto-run reviews analysis: {str(e)}"}
            
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

def get_pricing_summary() -> dict:
    """Reads Price Intelligence analysis results. If no analysis has been run yet, runs it automatically.

    Returns:
        dict: Competitor price gaps, active price war metrics, and undercutting alerts.
    """
    path = "data/output/pricing_results.json"
    # Triggers pricing analysis pipeline immediately to answer undercut queries
    if not os.path.exists(path):
        try:
            products_path = "data/sample_products.json"
            if os.path.exists(products_path):
                with open(products_path, "r", encoding="utf-8") as f:
                    products_data = json.load(f)
                from app.agents.pricing.pricing_orchestrator import PricingOrchestrator
                pricing_res = PricingOrchestrator().run(products_data)
                res_data = {"products": pricing_res.get("products", [])}
                os.makedirs("data/output", exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(res_data, f, indent=2)
                return res_data
        except Exception as e:
            return {"error": f"Failed to auto-run pricing analysis: {str(e)}"}
            
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return {"error": str(e)}

def get_audit_trail(limit: int = 10) -> list:
    """Reads the last limit entries from the audit trail log.

    Args:
        limit (int): Maximum number of log lines to retrieve.

    Returns:
        list: Verifiable event log trails.
    """
    path = "data/audit_trail.jsonl"
    if not os.path.exists(path):
        return []
    try:
        logs = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
        return logs[-limit:][::-1]
    except Exception as e:
        return [{"error": str(e)}]

def get_brand_health() -> dict:
    """Calculates and returns the overall Stride Co. Brand Health Score and its components.
    Automatically triggers missing analyses if they haven't been run yet.

    Returns:
        dict: Brand health indexes (overall, reviews, returns, pricing).
    """
    try:
        # Defaults if analysis fails
        avg_authenticity = 88
        fraud_protection = 100
        price_competitiveness = 100
        
        fraud_data = get_fraud_summary()
        if "error" not in fraud_data:
            flagged = fraud_data.get("flagged_customers", [])
            if flagged:
                avg_risk = sum(p.get("risk_score", p.get("score", 0)) for p in flagged) / len(flagged)
                fraud_protection = 100 - avg_risk

        review_data = get_review_summary()
        if "error" not in review_data:
            products = review_data.get("products", {})
            if products:
                scores = [p.get("overall_authenticity_score", 100) for p in products.values()]
                avg_authenticity = int(sum(scores) / len(scores))

        pricing_data = get_pricing_summary()
        if "error" not in pricing_data:
            prods = pricing_data.get("products", [])
            if prods:
                being_undercut = sum(1 for p in prods if p.get("analysis", {}).get("undercutting_detected", False))
                price_competitiveness = 100 - (being_undercut / len(prods) * 100)

        brand_health_score = int((avg_authenticity * 0.35) + (fraud_protection * 0.35) + (price_competitiveness * 0.30))
        return {
            "brand_health_score": brand_health_score,
            "components": {
                "review_authenticity": avg_authenticity,
                "fraud_protection": fraud_protection,
                "price_competitiveness": price_competitiveness
            }
        }
    except Exception as e:
        return {"error": str(e)}

chat_agent = Agent(
    name="chat_agent",
    model="gemini-flash-latest",
    instruction="""You are the SellerShield AI assistant for Stride Co., a premium Indian D2C footwear brand. You have access to return fraud data, review authenticity scores, and competitor pricing intelligence. Answer questions concisely and always cite specific data (customer IDs, product names, ₹ amounts) from the analysis results. Never make up numbers — only use data from the last analysis run stored in data/output/.

Guidelines:
1. Always mask customer PII in responses (e.g. Rajesh Kumar -> R**** K****).
2. If the results are not yet calculated, your tools will automatically trigger and run the analysis pipelines, so you can always answer the user's questions immediately.
3. For ₹ amounts always use Indian number format (e.g. ₹1,23,456).
""",
    tools=[get_fraud_summary, get_review_summary, get_pricing_summary, get_audit_trail, get_brand_health]
)
