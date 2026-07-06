"""
Module: Review Pipeline Orchestrator (reviews_orchestrator.py)
Description: Manages the parallel execution of linguistic and network review scans and merges verdicts.
ADK Pattern: ParallelAgent / SequentialAgent (runs linguistic and network agents in parallel, then sequentially combines results in the verdict agent)
Skills Applied: None
Inputs:
    - product_id: str (unique product SKU)
    - platform: str (Amazon, Flipkart, etc.)
    - reviews: list[dict] (list of review inputs)
Outputs:
    - dict: merged verdict, adjusted ratings, and details logs.
"""

import uuid
from app.agents.reviews.linguistic_agent import LinguisticAgent
from app.agents.reviews.network_agent import NetworkAgent
from app.agents.reviews.verdict_agent import VerdictAgent
from app.tools.audit_logger import log_audit_event
from app.security.pii_masker import mask_dict_pii

class ReviewsOrchestrator:
    def __init__(self):
        """Initializes the reviews orchestrator with its sub-agents."""
        self.name = "reviews_orchestrator"
        self.linguistic_agent = LinguisticAgent()
        self.network_agent = NetworkAgent()
        self.verdict_agent = VerdictAgent()

    def run(self, product_id: str, platform: str, reviews: list[dict], product_title: str = "") -> dict:
        """Orchestrates parallel review checks, merges outputs, applies PII masking, and audit logs.

        Args:
            product_id: ID of the product.
            platform: E-commerce platform.
            reviews: List of review dictionaries.
            product_title: Optional product title.

        Returns:
            Dictionary containing the consolidated verdict and scored reviews.
        """
        run_id = f"run_{uuid.uuid4().hex[:12]}"

        # 1. Parallel execution (simulated or direct python threading)
        # linguistic_agent runs on reviews list
        linguistic_output = self.linguistic_agent.run(reviews, product_title=product_title)
        
        # network_agent runs on reviews list
        network_output = self.network_agent.run(reviews)

        # 2. Merge outputs & run verdict_agent (Sequential phase)
        verdict_output = self.verdict_agent.run(linguistic_output, network_output)

        # Build combined response
        raw_combined_output = {
            "run_id": run_id,
            "product_id": product_id,
            "platform": platform,
            "verdict": verdict_output["verdict"],
            "overall_authenticity_score": verdict_output["overall_authenticity_score"],
            "fake_review_count": verdict_output["fake_review_count"],
            "genuine_review_count": verdict_output["genuine_review_count"],
            "adjusted_rating": verdict_output["adjusted_rating"],
            "displayed_rating": verdict_output["displayed_rating"],
            "top_3_evidence": verdict_output["top_3_evidence"],
            "reviews": linguistic_output,
            "network_signals": network_output["network_signals"],
            "burst_windows": network_output["burst_windows"],
            "suspicious_reviewer_ids": network_output["suspicious_reviewer_ids"]
        }

        # 3. PII masking must happen AFTER both finish and results are merged
        # Mask reviewer_name explicitly
        masked_reviews = []
        for r in raw_combined_output["reviews"]:
            r_copy = dict(r)
            if "reviewer_name" in r_copy:
                r_copy["reviewer_name"] = r.get("reviewer_name", "[UNKNOWN]")
            masked_reviews.append(r_copy)
            
        raw_combined_output["reviews"] = masked_reviews
        
        # Also run dictionary recursive PII masking on the details payload
        masked_details_payload = mask_dict_pii(raw_combined_output)

        # 4. Log to audit trail
        log_audit_event(
            agent_name=self.name,
            action="analyse_reviews",
            input_payload={"product_id": product_id, "platform": platform, "review_count": len(reviews)},
            output_summary=f"Processed reviews for product {product_id} ({platform}). Verdict: {verdict_output['verdict']}. Authenticity: {verdict_output['overall_authenticity_score']}%",
            details=masked_details_payload,
            module="Review Authenticity"
        )

        return raw_combined_output
