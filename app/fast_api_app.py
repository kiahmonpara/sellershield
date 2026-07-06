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

import contextlib
import os
import shutil
import tempfile
import json
from collections.abc import AsyncIterator
from typing import List

import google.auth
from a2a.server.tasks import InMemoryTaskStore
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner
from google.cloud import logging as google_cloud_logging
from pydantic import BaseModel

from app.app_utils import services
from app.app_utils.a2a import attach_a2a_routes
from app.app_utils.telemetry import setup_telemetry
from app.app_utils.typing import Feedback

# Import ReturnSense agents and utilities
from app.ingestion_agent import IngestionAgent
from app.pattern_agent import PatternAgent
from app.investigation_agent import InvestigationAgent
from app.claim_agent import ClaimAgent
from app.tools.audit_logger import log_audit_event

# Import SellerShield new modules
from app.agents.reviews.reviews_orchestrator import ReviewsOrchestrator
from app.agents.pricing.pricing_orchestrator import PricingOrchestrator

load_dotenv()
setup_telemetry()

# Check GCP credentials, default to dummy if not found
try:
    _, project_id = google.auth.default()
    logging_client = google_cloud_logging.Client()
    logger = logging_client.logger(__name__)
except Exception:
    project_id = "dummy-project"
    logger = None

allow_origins = (
    os.getenv("ALLOW_ORIGINS", "").split(",") if os.getenv("ALLOW_ORIGINS") else ["*"]
)

AGENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    from app.agent import app as adk_app
    from app.agent import root_agent

    runner = Runner(
        app=adk_app,
        session_service=services.get_session_service(),
        artifact_service=services.get_artifact_service(),
        auto_create_session=True,
    )
    app.state.runner = runner
    app.state.agent_app_name = adk_app.name
    await attach_a2a_routes(
        app,
        agent=root_agent,
        runner=runner,
        task_store=InMemoryTaskStore(),
        rpc_path=f"/a2a/{adk_app.name}",
    )
    yield


app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    artifact_service_uri=services.ARTIFACT_SERVICE_URI,
    allow_origins=allow_origins,
    session_service_uri=services.SESSION_SERVICE_URI,
    otel_to_cloud=False,
    lifespan=lifespan,
)
app.title = "returnsense"
app.description = "API for interacting with the Agent returnsense"

# Enable CORS for Next.js frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/feedback")
def collect_feedback(feedback: Feedback) -> dict[str, str]:
    if logger:
        logger.log_struct(feedback.model_dump(), severity="INFO")
    return {"status": "success"}


# --- ReturnSense Custom API Endpoints ---

class ApprovalRequest(BaseModel):
    customer_ids: List[str]
    # We pass the full dossiers to ClaimAgent
    dossiers: List[dict]


@app.post("/api/analyse")
async def analyze_csv(file: UploadFile = File(...)):
    """Uploads returns CSV and returns risk profiles and evidence dossiers."""
    # Write to a temporary file
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, file.filename)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 1. Ingest
        ingestion = IngestionAgent()
        records = ingestion.run(temp_path)
        log_audit_event(
            agent_name=ingestion.name,
            action="ingest_csv",
            input_payload={"filename": file.filename},
            output_summary=f"Ingested {len(records)} transaction records via API.",
            details={"record_count": len(records)},
            module="Return Fraud"
        )

        # 2. Risk Scorer
        pattern = PatternAgent()
        profiles = pattern.run(records)
        flagged_profiles = [p for p in profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
        log_audit_event(
            agent_name=pattern.name,
            action="score_risk",
            input_payload=records,
            output_summary=f"Scored {len(profiles)} customer profiles. Flagged {len(flagged_profiles)} via API.",
            details={"profiles": profiles},
            module="Return Fraud"
        )

        # 3. Investigate
        investigation = InvestigationAgent()
        dossiers = investigation.run(profiles, records)
        log_audit_event(
            agent_name=investigation.name,
            action="build_dossiers",
            input_payload=profiles,
            output_summary=f"Compiled {len(dossiers)} evidence dossiers via API.",
            details={"dossiers": dossiers},
            module="Return Fraud"
        )

        # Dump results to data/output/fraud_results.json
        os.makedirs("data/output", exist_ok=True)
        flagged_profiles = [p for p in profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
        total_val = sum(p["evidence"]["total_return_value_inr"] for p in flagged_profiles)
        with open("data/output/fraud_results.json", "w", encoding="utf-8") as f:
            json.dump({
                "flagged_customers": flagged_profiles,
                "total_claim_value_inr": total_val
            }, f, indent=2)

        # Trigger alerts
        from app.agents.alerts.alert_agent import AlertAgent
        await AlertAgent().generate_alerts_from_analysis("Return Fraud", {
            "flagged_customers": flagged_profiles
        })

        return {
            "success": True,
            "profiles": profiles,
            "dossiers": dossiers
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/approve-claims")
async def approve_claims(request: ApprovalRequest):
    """Processes manual claim approvals for selected customer dossiers."""
    try:
        approved_dossiers = [d for d in request.dossiers if d["profile"]["customer_id"] in request.customer_ids]
        
        # Log approval decision
        log_audit_event(
            agent_name="orchestrator",
            action="human_review",
            input_payload={"approved_customer_ids": request.customer_ids},
            output_summary=f"Human approved claims for {len(approved_dossiers)} customers via Web UI.",
            details={"approved_customer_ids": request.customer_ids},
            module="Return Fraud"
        )

        claims = []
        if approved_dossiers:
            claim_agent = ClaimAgent()
            claims_dir = os.path.join(os.getcwd(), "data", "claims")
            claims = claim_agent.run(approved_dossiers, claims_dir=claims_dir)

            log_audit_event(
                agent_name=claim_agent.name,
                action="draft_claims",
                input_payload=approved_dossiers,
                output_summary=f"Drafted {len(claims)} claims via Web UI.",
                details={"claims": claims},
                module="Return Fraud"
            )

        return {
            "success": True,
            "claims": claims
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/returns/live")
async def get_live_returns():
    """Reads data/sample_returns.csv and returns risk profiles and evidence dossiers directly, simulating live incoming data."""
    csv_path = os.path.join("data", "sample_returns.csv")
    if not os.path.exists(csv_path):
        raise HTTPException(status_code=404, detail="sample_returns.csv not found")
    
    try:
        # 1. Ingest
        ingestion = IngestionAgent()
        records = ingestion.run(csv_path)
        log_audit_event(
            agent_name=ingestion.name,
            action="ingest_csv",
            input_payload={"filename": "sample_returns.csv"},
            output_summary=f"Ingested {len(records)} transaction records automatically for live feed.",
            details={"record_count": len(records)},
            module="Return Fraud"
        )

        # 2. Risk Scorer
        pattern = PatternAgent()
        profiles = pattern.run(records)
        flagged_profiles = [p for p in profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
        log_audit_event(
            agent_name=pattern.name,
            action="score_risk",
            input_payload=records,
            output_summary=f"Scored {len(profiles)} customer profiles automatically. Flagged {len(flagged_profiles)}.",
            details={"profiles": profiles},
            module="Return Fraud"
        )

        # 3. Investigate
        investigation = InvestigationAgent()
        dossiers = investigation.run(profiles, records)
        log_audit_event(
            agent_name=investigation.name,
            action="build_dossiers",
            input_payload=profiles,
            output_summary=f"Compiled {len(dossiers)} evidence dossiers automatically.",
            details={"dossiers": dossiers},
            module="Return Fraud"
        )

        return {
            "success": True,
            "records": records,
            "profiles": profiles,
            "dossiers": dossiers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audit")
async def get_audit_trail():
    """Retrieves masked logs from audit_trail.jsonl."""
    log_path = "data/audit_trail.jsonl"
    if not os.path.exists(log_path):
        return {"logs": []}

    logs = []
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    logs.append(json.loads(line))
        return {"logs": logs[::-1]} # Return newest logs first
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- SellerShield Review & Pricing APIs ---

class ReviewsAnalysisRequest(BaseModel):
    product_id: str
    platform: str
    reviews: List[dict]


@app.post("/api/reviews/analyse")
async def analyze_reviews(request: ReviewsAnalysisRequest):
    """Runs linguistic, network, and verdict agents on product reviews."""
    try:
        # Find product title if possible in reviews or default
        product_title = ""
        if request.reviews:
            product_title = request.reviews[0].get("product_title", "")
            
        orchestrator = ReviewsOrchestrator()
        result = orchestrator.run(
            product_id=request.product_id,
            platform=request.platform,
            reviews=request.reviews,
            product_title=product_title
        )

        # Dump results to review_results.json
        os.makedirs("data/output", exist_ok=True)
        review_db = {"products": {}}
        if os.path.exists("data/output/review_results.json"):
            try:
                with open("data/output/review_results.json", "r", encoding="utf-8") as f:
                    review_db = json.load(f)
            except Exception:
                pass
        if "products" not in review_db:
            review_db["products"] = {}
        
        review_db["products"][request.product_id] = {
            "product_title": product_title or request.product_id,
            "verdict": result.get("verdict"),
            "overall_authenticity_score": result.get("overall_authenticity_score"),
            "displayed_rating": result.get("displayed_rating"),
            "adjusted_rating": result.get("adjusted_rating"),
            "fake_review_count": result.get("fake_review_count"),
            "genuine_review_count": result.get("genuine_review_count")
        }
        with open("data/output/review_results.json", "w", encoding="utf-8") as f:
            json.dump(review_db, f, indent=2)

        # Trigger alerts
        from app.agents.alerts.alert_agent import AlertAgent
        await AlertAgent().generate_alerts_from_analysis("Review Authenticity", review_db)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reviews/sample")
async def get_sample_reviews():
    """Returns contents of data/sample_reviews.json."""
    sample_path = "data/sample_reviews.json"
    if not os.path.exists(sample_path):
        return []
    try:
        with open(sample_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PricingAnalysisRequest(BaseModel):
    products: List[dict]


@app.post("/api/pricing/analyse")
async def analyze_pricing(request: PricingAnalysisRequest):
    """Runs price intelligence monitor, analysis, and strategy agents."""
    try:
        orchestrator = PricingOrchestrator()
        result = orchestrator.run(request.products)

        # Dump results to pricing_results.json
        os.makedirs("data/output", exist_ok=True)
        with open("data/output/pricing_results.json", "w", encoding="utf-8") as f:
            json.dump({"products": result.get("products", [])}, f, indent=2)

        # Trigger alerts
        from app.agents.alerts.alert_agent import AlertAgent
        await AlertAgent().generate_alerts_from_analysis("Price Intelligence", result)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pricing/sample")
async def get_sample_products():
    """Returns contents of data/sample_products.json."""
    sample_path = "data/sample_products.json"
    if not os.path.exists(sample_path):
        return []
    try:
        with open(sample_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pricing/history")
async def get_price_history():
    """Returns contents of data/price_history.json."""
    history_path = "data/price_history.json"
    if not os.path.exists(history_path):
        return []
    try:
        with open(history_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SubmitClaimRequest(BaseModel):
    customer_id: str
    platform: str
    claim_amount: float
    order_id: str


@app.post("/api/submit-claim")
async def submit_claim(request: SubmitClaimRequest):
    """Simulates submitting a claim directly to marketplace API endpoints."""
    import random
    import string
    try:
        ticket_id = "TIC-" + "".join(random.choices(string.digits, k=8))
        
        log_audit_event(
            agent_name="orchestrator",
            action="api_submit_claim",
            input_payload=request.model_dump(),
            output_summary=f"Claim {ticket_id} filed for {request.customer_id} ({request.platform}) via API. Value: INR {request.claim_amount}.",
            details={"ticket_id": ticket_id},
            module="Return Fraud"
        )
        
        return {
            "success": True,
            "ticket_id": ticket_id,
            "message": f"Claim successfully filed with {request.platform} API.",
            "status": "SUBMITTED"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import uuid

class PricingSimulateRequest(BaseModel):
    product_id: str
    hypothetical_price: float

@app.post("/api/pricing/simulate")
async def simulate_pricing(request: PricingSimulateRequest):
    """Simulates pricing scenario outcomes for a Stride Co. product."""
    try:
        # Load sample products to find details
        products = []
        sample_path = "data/sample_products.json"
        if os.path.exists(sample_path):
            with open(sample_path, "r", encoding="utf-8") as f:
                products = json.load(f)
        
        product = None
        for p in products:
            if p.get("product_id") == request.product_id:
                product = p
                break
                
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {request.product_id} not found")
            
        original_price = product.get("seller_price_inr", 0)
        competitors = product.get("competitors", [])
        
        comp_prices = [c.get("price_inr") for c in competitors]
        cheapest_price = min(comp_prices) if comp_prices else original_price
        
        # Rank calculation
        all_prices = sorted(comp_prices + [request.hypothetical_price])
        new_rank = all_prices.index(request.hypothetical_price) + 1
        total_competitors = len(all_prices)
        
        margin_impact_pct = round(((request.hypothetical_price - original_price) / original_price) * 100, 1) if original_price > 0 else 0.0
        undercuts_competitors = request.hypothetical_price < cheapest_price
        
        if undercuts_competitors:
            strategy = "Compete"
            rationale = f"Simulated price of INR {request.hypothetical_price} undercuts the cheapest competitor (INR {cheapest_price}), capturing maximum buy-box visibility."
        elif request.hypothetical_price == cheapest_price:
            strategy = "Compete"
            rationale = f"Simulated price matches the cheapest competitor at INR {request.hypothetical_price}."
        else:
            strategy = "Premium"
            rationale = f"Simulated price of INR {request.hypothetical_price} positions Stride Co. as a premium option above competitors."
            
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        
        log_audit_event(
            agent_name="strategy_agent",
            action="simulate_pricing",
            input_payload=request.model_dump(),
            output_summary=f"Simulated price change for {request.product_id} to INR {request.hypothetical_price}. Rank: {new_rank}.",
            details={"product_id": request.product_id, "hypothetical_price": request.hypothetical_price, "new_rank": new_rank},
            module="Price Intelligence"
        )
        
        return {
            "run_id": run_id,
            "new_rank": new_rank,
            "total_competitors": total_competitors,
            "margin_impact_pct": margin_impact_pct,
            "undercuts_competitors": undercuts_competitors,
            "strategy": strategy,
            "rationale": rationale
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/report/generate")
async def generate_report():
    """Generates an executive intelligence report by aggregating returns, reviews, and pricing data."""
    try:
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        
        # 1. Return Fraud summary
        csv_path = os.path.join("data", "sample_returns.csv")
        records = []
        profiles = []
        dossiers = []
        if os.path.exists(csv_path):
            ingestion = IngestionAgent()
            records = ingestion.run(csv_path)
            pattern = PatternAgent()
            profiles = pattern.run(records)
            investigation = InvestigationAgent()
            dossiers = investigation.run(profiles, records)
            
        flagged_profiles = [p for p in profiles if p["risk_level"] in ["MEDIUM_RISK", "HIGH_RISK"]]
        fraud_at_risk = sum(p["evidence"]["total_return_value_inr"] for p in flagged_profiles)
        
        fraud_summary = {
            "total_returns": len(records),
            "flagged_customers": len(flagged_profiles),
            "claims_ready": len(dossiers)
        }
        
        # 2. Review Authenticity summary
        sample_path = "data/sample_reviews.json"
        reviews_data = []
        if os.path.exists(sample_path):
            with open(sample_path, "r", encoding="utf-8") as f:
                reviews_data = json.load(f)
                
        total_reviews_count = 0
        fake_reviews_flagged = 0
        authenticity_scores = []
        
        orchestrator = ReviewsOrchestrator()
        for p in reviews_data:
            # Only run for Stride Co. products to calculate brand average
            if p.get("brand") == "Stride Co." or "PROD-" in p.get("product_id", ""):
                res = orchestrator.run(
                    product_id=p.get("product_id"),
                    platform=p.get("platform", "Amazon"),
                    reviews=p.get("reviews", []),
                    product_title=p.get("product_title", "")
                )
                total_reviews_count += len(p.get("reviews", []))
                fake_reviews_flagged += res.get("fake_review_count", 0)
                authenticity_scores.append(res.get("overall_authenticity_score", 100))
                
        avg_authenticity = int(sum(authenticity_scores) / len(authenticity_scores)) if authenticity_scores else 88
        
        review_summary = {
            "total_reviews_analysed": total_reviews_count,
            "fake_reviews_flagged": fake_reviews_flagged,
            "average_authenticity": avg_authenticity
        }
        
        # 3. Price Intelligence summary
        products_path = "data/sample_products.json"
        products_data = []
        if os.path.exists(products_path):
            with open(products_path, "r", encoding="utf-8") as f:
                products_data = json.load(f)
                
        pricing_orchestrator = PricingOrchestrator()
        pricing_res = pricing_orchestrator.run(products_data)
        strategized_products = pricing_res.get("products", [])
        
        being_undercut = sum(1 for p in strategized_products if p["analysis"]["undercutting_detected"])
        price_wars = sum(1 for p in strategized_products if p["analysis"]["price_war_active"])
        
        pricing_summary = {
            "total_products": len(products_data),
            "being_undercut": being_undercut,
            "active_price_wars": price_wars
        }
        
        # Calculate Brand Health Score
        # BHS = (reviews authenticity * 0.35) + (fraud protection score * 0.35) + (price competitiveness * 0.30)
        # fraud protection score: 100 - average risk score of flagged profiles
        if flagged_profiles:
            avg_risk = sum(p["risk_score"] for p in flagged_profiles) / len(flagged_profiles)
            fraud_protection = 100 - avg_risk
        else:
            fraud_protection = 100
            
        # price competitiveness score: 100 - (undercut count / total products * 100)
        if len(products_data) > 0:
            price_competitiveness = 100 - (being_undercut / len(products_data) * 100)
        else:
            price_competitiveness = 100
            
        brand_health_score = int((avg_authenticity * 0.35) + (fraud_protection * 0.35) + (price_competitiveness * 0.30))
        
        # Calculate total revenue at risk
        revenue_at_risk = int(fraud_at_risk + (being_undercut * 5000)) # mock dynamic estimate for undercut revenue
        
        # Action Items
        action_items = []
        if flagged_profiles:
            action_items.append({
                "module": "Return Fraud",
                "severity": "HIGH",
                "description": f"Submit SPF/SAFE-T claims for {len(flagged_profiles)} flagged accounts to reclaim ₹{int(fraud_at_risk)}."
            })
        if being_undercut > 0:
            action_items.append({
                "module": "Price Intelligence",
                "severity": "MEDIUM",
                "description": f"Reprice {being_undercut} products being undercut by competitors to restore click-through rate."
            })
        if fake_reviews_flagged > 0:
            action_items.append({
                "module": "Review Authenticity",
                "severity": "LOW",
                "description": f"Report {fake_reviews_flagged} suspicious fake reviews on Amazon to restore organic search health."
            })
            
        log_audit_event(
            agent_name="orchestrator",
            action="generate_executive_report",
            input_payload={},
            output_summary=f"Generated executive intelligence report. Brand Health Score: {brand_health_score}.",
            details={"brand_health_score": brand_health_score},
            module="Executive Intelligence"
        )
        
        return {
            "run_id": run_id,
            "brand_health_score": brand_health_score,
            "revenue_at_risk": revenue_at_risk,
            "fraud_summary": fraud_summary,
            "review_summary": review_summary,
            "pricing_summary": pricing_summary,
            "action_items": action_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NEW SellerShield Capstone API Endpoints ---

class ChatRequest(BaseModel):
    message: str
    session_id: str

@app.post("/api/assistant/chat")
async def assistant_chat(request: ChatRequest):
    from app.agents.assistant.chat_agent import chat_agent
    from google.adk.runners import Runner
    from google.adk.apps import App
    from google.adk.sessions import InMemorySessionService
    from google.adk.artifacts import InMemoryArtifactService
    from google.genai import types
    import uuid

    if not hasattr(app.state, "chat_sessions"):
        app.state.chat_sessions = {}
    
    runner = app.state.chat_sessions.get(request.session_id)
    if not runner:
        chat_app = App(root_agent=chat_agent, name="chat_assistant")
        runner = Runner(
            app=chat_app,
            session_service=InMemorySessionService(),
            artifact_service=InMemoryArtifactService(),
            auto_create_session=True,
        )
        app.state.chat_sessions[request.session_id] = runner

    content = types.Content(parts=[types.Part.from_text(text=request.message)])
    response_text = ""
    sources_used = []
    
    async for event in runner.run_async(
        user_id="user",
        session_id=request.session_id,
        new_message=content
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text
        if hasattr(event, "get_function_calls") and event.get_function_calls():
            for fc in event.get_function_calls():
                sources_used.append(fc.name)
                
    return {
        "response": response_text.strip(),
        "sources_used": list(set(sources_used)),
        "run_id": f"run_{uuid.uuid4().hex[:12]}"
    }

@app.post("/api/monitor/run")
async def trigger_monitor():
    from app.agents.monitor.scheduler_agent import SchedulerAgent
    agent = SchedulerAgent()
    res = await agent.run_scan()
    return res

@app.get("/api/monitor/history")
async def get_monitor_history():
    history_path = "data/output/monitor_history.json"
    if not os.path.exists(history_path):
        return []
    try:
        with open(history_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

@app.get("/api/product/{product_id}/intel")
async def get_product_intelligence(product_id: str):
    from app.agents.product.product_intel_agent import ProductIntelAgent
    agent = ProductIntelAgent()
    res = await agent.get_product_intel(product_id)
    return res

from typing import Optional

class EnhanceClaimsRequest(BaseModel):
    claims: List[dict]
    dossiers: Optional[List[dict]] = None

@app.post("/api/fraud/claims/enhance")
async def enhance_fraud_claims(request: EnhanceClaimsRequest):
    from app.agents.fraud.claims_intelligence_agent import ClaimsIntelligenceAgent
    agent = ClaimsIntelligenceAgent()
    res = await agent.enhance_claims(request.claims, request.dossiers)
    return res

class ReviewRespondRequest(BaseModel):
    review_id: str
    review_text: str
    rating: int
    authenticity_label: str

@app.post("/api/reviews/respond")
async def reviews_respond(request: ReviewRespondRequest):
    from app.agents.reviews.response_agent import ResponseAgent
    agent = ResponseAgent()
    res = await agent.generate_response(request.review_text, request.rating, request.authenticity_label)
    return res

@app.get("/api/alerts")
async def get_active_alerts():
    from app.agents.alerts.alert_agent import AlertAgent
    agent = AlertAgent()
    return agent.get_alerts()

@app.post("/api/alerts/dismiss/{alert_id}")
async def dismiss_single_alert(alert_id: str):
    from app.agents.alerts.alert_agent import AlertAgent
    agent = AlertAgent()
    success = agent.dismiss_alert(alert_id)
    return {"success": success}

@app.post("/api/alerts/dismiss-all")
async def dismiss_all_alerts():
    from app.agents.alerts.alert_agent import AlertAgent
    agent = AlertAgent()
    success = agent.dismiss_all_alerts()
    return {"success": success}


# Main execution
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
