"""
Module: Pricing Pipeline Orchestrator (pricing_orchestrator.py)
Description: Coordinates the step-by-step pricing monitoring, analysis, and strategizing pipeline.
ADK Pattern: SequentialAgent (wires together monitor, analysis, and strategy agents sequentially)
Skills Applied: None
Inputs:
    - products: list[dict] (raw pricing items)
Outputs:
    - dict: strategized items containing recommendations and run telemetry details.
"""

import uuid
from app.agents.pricing.monitor_agent import MonitorAgent
from app.agents.pricing.analysis_agent import AnalysisAgent
from app.agents.pricing.strategy_agent import StrategyAgent
from app.tools.audit_logger import log_audit_event
from app.security.pii_masker import mask_dict_pii

class PricingOrchestrator:
    def __init__(self):
        """Initializes the pricing orchestrator with sub-agents."""
        self.name = "pricing_orchestrator"
        self.monitor_agent = MonitorAgent()
        self.analysis_agent = AnalysisAgent()
        self.strategy_agent = StrategyAgent()

    def run(self, products: list[dict]) -> dict:
        """Orchestrates the price intelligence scanning and strategy formulation pipeline.

        Args:
            products: List of products with seller and competitor prices.

        Returns:
            Dictionary with a run_id and a list of strategized products.
        """
        run_id = f"run_{uuid.uuid4().hex[:12]}"

        # 1. Run Monitor Agent
        monitored = self.monitor_agent.run(products)

        # 2. Run Analysis Agent
        analyzed = self.analysis_agent.run(monitored)

        # 3. Run Strategy Agent
        strategized = self.strategy_agent.run(analyzed)

        response = {
            "run_id": run_id,
            "products": strategized
        }

        # 4. Mask and Log
        masked_details_payload = mask_dict_pii(response)
        
        log_audit_event(
            agent_name=self.name,
            action="analyse_pricing",
            input_payload={"product_count": len(products)},
            output_summary=f"Run price intelligence engine on {len(products)} products. Formulated pricing recommendations.",
            details=masked_details_payload,
            module="Price Intelligence"
        )

        return response
