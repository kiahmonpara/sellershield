"""
Module: Pricing Strategy Agent (strategy_agent.py)
Description: Evaluates competitor positions and recommends price changes or bundling actions.
ADK Pattern: Tool (pricing strategy agent within the Pricing Pipeline)
Skills Applied: None
Inputs:
    - analyzed_products: list[dict] (analyzed items from analysis_agent)
Outputs:
    - list[dict]: items with final strategies (e.g. Compete, Bundle) and target price recommendations.
"""

class StrategyAgent:
    def __init__(self):
        """Initializes the pricing strategy agent."""
        self.name = "strategy_agent"

    def run(self, analyzed_products: list[dict]) -> list[dict]:
        """Formulates pricing strategies, recommendations, and urgency.

        Args:
            analyzed_products: List of analyzed products from analysis_agent.

        Returns:
            List of products with recommended strategy metrics.
        """
        strategized_products = []

        for p in analyzed_products:
            pid = p.get("product_id")
            name = p.get("name")
            category = p.get("category")
            seller_price = p.get("seller_price_inr", 0)
            competitors = p.get("competitors", [])
            events = p.get("monitor_events", [])
            analysis = p.get("analysis", {})

            price_position = analysis.get("price_position", "mid_range")
            price_gap_inr = analysis.get("price_gap_inr", 0)
            price_gap_pct = analysis.get("price_gap_pct", 0.0)
            undercutting_detected = analysis.get("undercutting_detected", False)
            undercutting_competitor = analysis.get("undercutting_competitor")
            price_war_active = analysis.get("price_war_active", False)
            psychological_threshold = analysis.get("psychological_threshold", False)

            cheapest_comp_price = min([c.get("price_inr", 999999) for c in competitors]) if competitors else seller_price

            # Determine Strategy, Recommended Price, Urgency, Rationale, Margin Impact
            strategy = "Premium"
            recommended_price = seller_price
            urgency = "STABLE"
            rationale = "Current price is optimal and stable."
            margin_impact = 0.0

            if price_war_active:
                if price_gap_pct > 20.0:
                    strategy = "Bundle"
                    recommended_price = seller_price
                    urgency = "ACT_NOW"
                    rationale = f"Severe price war detected on {name} with a {price_gap_pct}% gap. Recommend bundling accessories instead of competing on price."
                    margin_impact = 0.0
                else:
                    strategy = "Compete"
                    recommended_price = cheapest_comp_price
                    urgency = "ACT_NOW"
                    rationale = f"Active price war detected. Lower price to INR {cheapest_comp_price} to maintain store visibility."
                    margin_impact = round(((cheapest_comp_price - seller_price) / seller_price) * 100, 1)
            elif undercutting_detected:
                if "systematic_undercut" in events:
                    strategy = "Compete"
                    recommended_price = cheapest_comp_price - 1
                    urgency = "MONITOR"
                    rationale = f"Systematic undercutting detected by {undercutting_competitor}. Match or price ₹1 below at INR {recommended_price}."
                    margin_impact = round(((recommended_price - seller_price) / seller_price) * 100, 1)
                else:
                    strategy = "Compete"
                    recommended_price = cheapest_comp_price
                    urgency = "ACT_NOW"
                    rationale = f"Competitor {undercutting_competitor} is undercutting. Match lowest price of INR {cheapest_comp_price} to restore click-through rate."
                    margin_impact = round(((cheapest_comp_price - seller_price) / seller_price) * 100, 1)
            elif psychological_threshold:
                # E.g. 510 -> round to 499
                last_two = seller_price % 100
                recommended_price = seller_price - last_two - 1
                strategy = "Compete"
                urgency = "ACT_NOW"
                rationale = f"Seller price is just above a psychological threshold (INR {seller_price}). Repriced to INR {recommended_price} to improve conversion rates."
                margin_impact = round(((recommended_price - seller_price) / seller_price) * 100, 1)
            elif price_position == "cheapest":
                strategy = "Premium"
                recommended_price = seller_price
                urgency = "STABLE"
                rationale = f"You are currently the cheapest seller in the {category} category. Maintain pricing to secure margins."
                margin_impact = 0.0
            else:
                strategy = "Premium"
                recommended_price = seller_price
                urgency = "MONITOR"
                rationale = "Price sits in the mid-range. Monitor competitor catalog changes."
                margin_impact = 0.0

            strategized_products.append({
                "product_id": pid,
                "name": name,
                "category": category,
                "seller_price_inr": seller_price,
                "platform": p.get("platform"),
                "competitors": competitors,
                "monitor_events": events,
                "analysis": analysis,
                "strategy": {
                    "recommended_price_inr": recommended_price,
                    "strategy": strategy,
                    "urgency": urgency,
                    "rationale": rationale,
                    "estimated_margin_impact": margin_impact
                }
            })

        return strategized_products
