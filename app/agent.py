# ruff: noqa
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import datetime
from zoneinfo import ZoneInfo
import os

from google.adk.agents import Agent
from google.adk.apps import App
from google.adk.models import Gemini
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

from app.ingestion_agent import IngestionAgent
from app.pattern_agent import PatternAgent
from app.investigation_agent import InvestigationAgent
from app.claim_agent import ClaimAgent
from app.security.human_review import prompt_human_approval
from app.tools.audit_logger import log_audit_event


def analyze_returns_for_fraud(csv_path: str) -> str:
    """Runs the ReturnSense multi-agent return fraud detection pipeline on a transaction/returns CSV file.
    It executes ingestion, pattern scoring, evidence compilation, human approval checkpoints,
    and formats claim files for marketplaces.

    Args:
        csv_path: Local path to the returns CSV file (e.g., 'data/sample_returns.csv').

    Returns:
        A detailed Markdown summary report summarizing the analysis results.
    """
    print(f"\n>>> Starting ReturnSense Pipeline on: {csv_path}")

    # Step 1: Ingestion
    ingestion = IngestionAgent()
    try:
        records = ingestion.run(csv_path)
    except Exception as e:
        error_msg = f"Failed to ingest CSV: {str(e)}"
        print(f"[orchestrator] Error: {error_msg}")
        return f"### ReturnSense Error\n{error_msg}"

    log_audit_event(
        agent_name=ingestion.name,
        action="ingest_csv",
        input_payload={"csv_path": csv_path},
        output_summary=f"Ingested {len(records)} transaction records.",
        details={"record_count": len(records)},
        module="Return Fraud"
    )

    # Step 2: Pattern Analysis
    pattern = PatternAgent()
    profiles = pattern.run(records)
    
    flagged_profiles = [p for p in profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
    log_audit_event(
        agent_name=pattern.name,
        action="score_risk",
        input_payload=records,
        output_summary=f"Scored {len(profiles)} customer profiles. Flagged {len(flagged_profiles)}.",
        details={"profiles": profiles},
        module="Return Fraud"
    )

    # Step 3: Investigation
    investigation = InvestigationAgent()
    dossiers = investigation.run(profiles, records)
    log_audit_event(
        agent_name=investigation.name,
        action="build_dossiers",
        input_payload=profiles,
        output_summary=f"Compiled {len(dossiers)} evidence dossiers.",
        details={"dossiers": dossiers},
        module="Return Fraud"
    )

    # Step 4: Human Review Gate (Only for HIGH_RISK detections)
    high_risk_dossiers = [d for d in dossiers if d["profile"]["risk_level"] == "HIGH_RISK"]
    approved_dossiers = []
    human_decision = "N/A (No HIGH_RISK flags)"

    if high_risk_dossiers:
        flagged_high_profiles = [d["profile"] for d in high_risk_dossiers]
        is_approved = prompt_human_approval(flagged_high_profiles)
        human_decision = "APPROVED" if is_approved else "REJECTED"
        
        log_audit_event(
            agent_name="orchestrator",
            action="human_review",
            input_payload=flagged_high_profiles,
            output_summary=f"Human reviewer decision: {human_decision}",
            details={"approved": is_approved, "profiles": flagged_high_profiles},
            module="Return Fraud"
        )
        
        if is_approved:
            approved_dossiers = high_risk_dossiers
    else:
        print("[orchestrator] No HIGH_RISK cases found. Skipping human review gate.")

    # Step 5: Claim Drafting
    drafted_claims = []
    if approved_dossiers:
        claim_agent = ClaimAgent()
        # Default claims folder inside the returnsense workspace
        claims_dir = os.path.join(os.getcwd(), "data", "claims")
        drafted_claims = claim_agent.run(approved_dossiers, claims_dir=claims_dir)
        
        log_audit_event(
            agent_name=claim_agent.name,
            action="draft_claims",
            input_payload=approved_dossiers,
            output_summary=f"Drafted {len(drafted_claims)} marketplace claims.",
            details={"claims": drafted_claims},
            module="Return Fraud"
        )

    # Formulate Markdown Report
    report = []
    report.append("# ReturnSense Fraud Analysis Report")
    report.append(f"**Date**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**Source CSV**: `{csv_path}`")
    report.append(f"**Total Records Processed**: {len(records)}")
    report.append("\n## Customer Risk Profiles Summary\n")
    report.append("| Customer ID | Masked Name | Risk Level | Score | Triggered Signals | Returns |")
    report.append("| --- | --- | --- | --- | --- | --- |")
    
    from app.tools.claim_formatter import format_underscore_text
    
    # Sort profiles for presentation (highest score first)
    profiles.sort(key=lambda x: x["risk_score"], reverse=True)
    for p in profiles:
        raw_signals = ", ".join(p["signals_triggered"]) if p["signals_triggered"] else "None"
        signals = format_underscore_text(raw_signals)
        formatted_risk_level = format_underscore_text(p['risk_level'])
        report.append(f"| {p['customer_id']} | {p['customer_name']} | {formatted_risk_level} | {p['risk_score']}/100 | {signals} | {p['evidence']['return_count']} |")

    report.append(f"\n**Human Review Gate Decision**: `{human_decision}`")

    if drafted_claims:
        report.append("\n## Generated Claim Files (Approved for Submission)\n")
        for c in drafted_claims:
            report.append(f"- **Customer {c['customer_id']}**: Claims generated in `data/claims/{c['target_file']}`")
            report.append("  - *Generic Draft*:")
            report.append(f"    ```\n    {c['generic'][:180]}...\n    ```")
            report.append("  - *Amazon SAFE-T Draft*:")
            report.append(f"    ```\n    {c['amazon'][:180]}...\n    ```")
            report.append("  - *Flipkart SPF Draft*:")
            report.append(f"    ```\n    {c['flipkart'][:180]}...\n    ```")
    elif high_risk_dossiers and human_decision == "REJECTED":
        report.append("\n> ⚠️ **Notice**: HIGH_RISK cases were flagged but rejected by the human reviewer. No claim files were generated.")
    else:
        report.append("\n> ℹ️ **Notice**: No suspicious customer profiles were approved/flagged for claims in this run.")

    report.append("\n## Audit Trail Log status")
    report.append("Integrity log updated in `data/audit_trail.jsonl` (PII masked).")
    
    return "\n".join(report)


def analyze_reviews_authenticity(product_id: str, platform: str, reviews_json_path: str) -> str:
    """Runs the SellerShield review authenticity scoring pipeline on a product's reviews.

    Args:
        product_id: ID of the product.
        platform: Marketplace platform.
        reviews_json_path: Local path to the reviews JSON file (e.g. 'data/sample_reviews.json').

    Returns:
        A Markdown report summarizing the review authenticity verdict, score, ratings, and evidence.
    """
    import json
    import os
    if not os.path.exists(reviews_json_path):
        return f"Error: reviews file not found at {reviews_json_path}"
    with open(reviews_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    product_reviews = []
    product_title = ""
    if isinstance(data, list):
        for p in data:
            if p.get("product_id") == product_id:
                product_reviews = p.get("reviews", [])
                product_title = p.get("product_title", "")
                break
        if not product_reviews and data and "review_id" in data[0]:
            product_reviews = data
            
    from app.agents.reviews.reviews_orchestrator import ReviewsOrchestrator
    orchestrator = ReviewsOrchestrator()
    res = orchestrator.run(product_id, platform, product_reviews, product_title=product_title)
    
    report = [
        f"# Review Authenticity Audit Report",
        f"**Product ID**: {res['product_id']}",
        f"**Verdict**: {res['verdict']}",
        f"**Authenticity Score**: {res['overall_authenticity_score']}/100",
        f"**Ratings**: Displayed: ⭐ {res['displayed_rating']} | Adjusted: ⭐ {res['adjusted_rating']}",
        f"**Fake Count**: {res['fake_review_count']} | Genuine Count: {res['genuine_review_count']}",
        "\n### Signals Detected",
        ", ".join(res["network_signals"]) if res["network_signals"] else "None",
        "\n### Key Evidence",
        "\n".join(f"- {ev}" for ev in res["top_3_evidence"]) if res["top_3_evidence"] else "No significant anomalies.",
        f"\nAudit Log run registered in `data/audit_trail.jsonl` under Review Authenticity."
    ]
    return "\n".join(report)


def audit_competitor_pricing(products_json_path: str) -> str:
    """Runs the SellerShield price intelligence audit on a catalog product list.

    Args:
        products_json_path: Local path to the products catalog JSON file (e.g. 'data/sample_products.json').

    Returns:
        A Markdown report summarizing pricing positions, competitor undercuts, and repricing actions.
    """
    import json
    import os
    if not os.path.exists(products_json_path):
        return f"Error: products file not found at {products_json_path}"
    with open(products_json_path, "r", encoding="utf-8") as f:
        products = json.load(f)
        
    from app.agents.pricing.pricing_orchestrator import PricingOrchestrator
    orchestrator = PricingOrchestrator()
    res = orchestrator.run(products)
    
    report = [
        f"# Price Intelligence Repricing Audit Report",
        f"**Total Products Audited**: {len(res['products'])}",
        "\n### Pricing Recommendations & Urgency",
        "| Product ID | Name | Current Price | Rec Price | Strategy | Urgency | Rationale |",
        "| --- | --- | --- | --- | --- | --- | --- |"
    ]
    for p in res["products"]:
        strat = p["strategy"]
        report.append(f"| {p['product_id']} | {p['name']} | INR {p['seller_price_inr']} | INR {strat['recommended_price_inr']} | {strat['strategy']} | {strat['urgency']} | {strat['rationale']} |")
        
    return "\n".join(report)


root_agent = Agent(
    name="root_agent",
    model=Gemini(
        model="gemini-flash-latest",
        retry_options=types.HttpRetryOptions(attempts=3),
    ),
    instruction="You are the SellerShield multi-agent orchestrator. You help sellers run the return fraud analysis pipeline on transaction files, verify review authenticity, and audit competitor pricing catalogs.",
    tools=[analyze_returns_for_fraud, analyze_reviews_authenticity, audit_competitor_pricing],
)

app = App(
    root_agent=root_agent,
    name="app",
)
