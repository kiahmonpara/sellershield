"""
Module: Watchdog Scheduler Agent (scheduler_agent.py)
Description: Oversees periodic scans, calculates delta threats, and alerts on newly uncovered anomalies.
ADK Pattern: SequentialAgent / LlmAgent (runs sequentially through the Return, Review, and Pricing pipelines, then runs LLM comparison)
Skills Applied: delta-detector (rules for comparing historic states and identifying newly emerging risk vectors)
Inputs:
    - None (scans read raw input files in data/ directly)
Outputs:
    - dict: structured delta logs containing new threats, run history logs, and duration telemetry.
"""

import os
import json
import time
import datetime
import uuid
from google.adk.agents import Agent
from app.ingestion_agent import IngestionAgent
from app.pattern_agent import PatternAgent
from app.investigation_agent import InvestigationAgent
from app.agents.reviews.reviews_orchestrator import ReviewsOrchestrator
from app.agents.pricing.pricing_orchestrator import PricingOrchestrator
from app.tools.audit_logger import log_audit_event

class SchedulerAgent:
    def __init__(self):
        """Initializes the SchedulerAgent and its delta-detector ADK agent."""
        self.name = "scheduler_agent"
        # ADK Agent definition
        self.adk_agent = Agent(
            name="delta_detector_agent",
            model="gemini-flash-latest",
            instruction="""You are the SellerShield watchdog agent for Stride Co.
Your job is to compare a previous analysis run with the current analysis run and detect NEW threats.
You must output a structured JSON Delta Report containing:
- new_fraud_threats: list of customer IDs that are flagged in the current run but were not in the previous run.
- new_review_flags: list of product IDs where fake review count increased or verdict deteriorated.
- new_price_alerts: list of product IDs where competitor undercutting was newly detected.
- summary_text: A brief, friendly summary of the delta report.

Always return ONLY valid JSON output, matching the schema:
{
  "new_fraud_threats": [
    {"customer_id": "C...", "risk_level": "...", "score": 80}
  ],
  "new_review_flags": [
    {"product_id": "...", "fake_reviews_count": 3}
  ],
  "new_price_alerts": [
    {"product_id": "...", "price_gap_pct": 5.2}
  ],
  "summary_text": "text..."
}
"""
        )

    async def run_scan(self) -> dict:
        """Executes all 3 pipeline modules sequentially, computes current state, and runs LLM delta comparison.

        Returns:
            dict: Delta report of newly found threats, duration, and run metrics.
        """
        start_time = time.time()
        
        # 1. Run Fraud Pipeline
        csv_path = os.path.join("data", "sample_returns.csv")
        fraud_profiles = []
        if os.path.exists(csv_path):
            ing_rec = IngestionAgent().run(csv_path)
            fraud_profiles = PatternAgent().run(ing_rec)
            # Write to data/output/fraud_results.json
            os.makedirs("data/output", exist_ok=True)
            flagged = [p for p in fraud_profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
            total_val = sum(p["evidence"]["total_return_value_inr"] for p in flagged)
            with open("data/output/fraud_results.json", "w", encoding="utf-8") as f:
                json.dump({
                    "flagged_customers": flagged,
                    "total_claim_value_inr": total_val
                }, f, indent=2)

        # 2. Run Review Pipeline for Stride Co. products
        reviews_path = "data/sample_reviews.json"
        reviews_data = []
        review_summary_db = {}
        if os.path.exists(reviews_path):
            with open(reviews_path, "r", encoding="utf-8") as f:
                reviews_data = json.load(f)
            rev_orch = ReviewsOrchestrator()
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
            with open("data/output/review_results.json", "w", encoding="utf-8") as f:
                json.dump({"products": review_summary_db}, f, indent=2)

        # 3. Run Pricing Pipeline
        products_path = "data/sample_products.json"
        pricing_products = []
        if os.path.exists(products_path):
            with open(products_path, "r", encoding="utf-8") as f:
                products_data = json.load(f)
            pricing_res = PricingOrchestrator().run(products_data)
            pricing_products = pricing_res.get("products", [])
            with open("data/output/pricing_results.json", "w", encoding="utf-8") as f:
                json.dump({"products": pricing_products}, f, indent=2)

        # Build Current State
        current_state = {
            "fraud": [{"customer_id": p["customer_id"], "risk_level": p["risk_level"], "score": p["risk_score"]} for p in fraud_profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]],
            "reviews": [{"product_id": pid, "verdict": p["verdict"], "fake_count": p["fake_review_count"]} for pid, p in review_summary_db.items() if p["verdict"] != "TRUSTWORTHY"],
            "pricing": [{"product_id": p["product_id"], "undercut": p["analysis"]["undercutting_detected"], "price_gap_pct": p["analysis"]["price_gap_pct"]} for p in pricing_products if p["analysis"]["undercutting_detected"]]
        }

        # Load Previous State
        prev_path = "data/output/previous_run.json"
        previous_state = {"fraud": [], "reviews": [], "pricing": []}
        if os.path.exists(prev_path):
            try:
                with open(prev_path, "r", encoding="utf-8") as f:
                    previous_state = json.load(f)
            except Exception:
                pass

        # Use ADK Agent to compare states
        prompt = f"""
Previous Scan State:
{json.dumps(previous_state, indent=2)}

Current Scan State:
{json.dumps(current_state, indent=2)}

Compare the two states and output the Delta Report.
"""
        # Run ADK agent to get delta report
        try:
            from google.adk.runners import Runner
            from google.adk.apps import App
            from google.adk.sessions import InMemorySessionService
            from google.adk.artifacts import InMemoryArtifactService
            
            chat_app = App(root_agent=self.adk_agent, name="delta_detector")
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
            delta_report = json.loads(response_text)
        except Exception as e:
            print(f"Watchdog Delta Detector warning: {str(e)}. Using programmatic fallback.")
            delta_report = {
                "new_fraud_threats": [],
                "new_review_flags": [],
                "new_price_alerts": [],
                "summary_text": "Delta analysis completed with fallback due to temporary model unavailability."
            }
            # Programmatic delta calculation:
            curr_fraud = {f["customer_id"]: f for f in current_state["fraud"]}
            prev_fraud = {f["customer_id"]: f for f in previous_state["fraud"]}
            new_fraud_keys = set(curr_fraud.keys()) - set(prev_fraud.keys())
            delta_report["new_fraud_threats"] = [{"customer_id": cid, "risk_level": curr_fraud[cid]["risk_level"], "score": curr_fraud[cid]["score"]} for cid in new_fraud_keys]

            curr_reviews = {p["product_id"]: p for p in current_state["reviews"]}
            prev_reviews = {p["product_id"]: p for p in previous_state["reviews"]}
            new_reviews = []
            for pid, curr_p in curr_reviews.items():
                prev_p = prev_reviews.get(pid)
                if not prev_p or curr_p["fake_count"] > prev_p["fake_count"]:
                    new_reviews.append(curr_p)
            delta_report["new_review_flags"] = [{"product_id": p["product_id"], "fake_reviews_count": p["fake_count"]} for p in new_reviews]

            curr_pricing = {p["product_id"]: p for p in current_state["pricing"]}
            prev_pricing = {p["product_id"]: p for p in previous_state["pricing"]}
            new_pricing_keys = set(curr_pricing.keys()) - set(prev_pricing.keys())
            delta_report["new_price_alerts"] = [{"product_id": pid, "price_gap_pct": curr_pricing[pid]["price_gap_pct"]} for pid in new_pricing_keys]

        # Save Current State as the baseline for next scan
        with open(prev_path, "w", encoding="utf-8") as f:
            json.dump(current_state, f, indent=2)

        duration = round(time.time() - start_time, 2)
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        
        threat_count = (
            len(delta_report.get("new_fraud_threats", [])) +
            len(delta_report.get("new_review_flags", [])) +
            len(delta_report.get("new_price_alerts", []))
        )

        # Log run history
        history_path = "data/output/monitor_history.json"
        history = []
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except Exception:
                pass
        
        history.append({
            "run_id": run_id,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "threats_found": threat_count,
            "duration_seconds": duration
        })
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)

        # Log audit trail
        log_audit_event(
            agent_name=self.name,
            action="run_auto_monitor",
            input_payload={"previous_run_exists": os.path.exists(prev_path)},
            output_summary=f"Auto-Monitor completed scan. New threats detected: {threat_count} (Fraud: {len(delta_report.get('new_fraud_threats', []))}, Reviews: {len(delta_report.get('new_review_flags', []))}, Pricing: {len(delta_report.get('new_price_alerts', []))})",
            details={"delta_report": delta_report, "duration_seconds": duration},
            module="Auto-Monitor"
        )

        return {
            "run_id": run_id,
            "new_fraud_threats": len(delta_report.get("new_fraud_threats", [])),
            "new_review_flags": len(delta_report.get("new_review_flags", [])),
            "new_price_alerts": len(delta_report.get("new_price_alerts", [])),
            "delta_report": delta_report,
            "duration_seconds": duration
        }
