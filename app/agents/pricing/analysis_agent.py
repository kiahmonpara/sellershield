"""
Module: Pricing Analysis Agent (analysis_agent.py)
Description: Analyzes price gaps, determines price positioning, and flags psychological threshold violations.
ADK Pattern: Tool (utility analysis agent within the Pricing Pipeline)
Skills Applied: None
Inputs:
    - monitored_products: list[dict] (monitored items from monitor_agent)
Outputs:
    - list[dict]: analyzed items containing gap percentage, undercut flags, and pricing status.
"""

class AnalysisAgent:
    def __init__(self):
        """Initializes the pricing analysis agent."""
        self.name = "analysis_agent"

    def run(self, monitored_products: list[dict]) -> list[dict]:
        """Analyzes pricing gaps, positions, and psychological thresholds.

        Args:
            monitored_products: List of products returned by monitor_agent.

        Returns:
            List of products with detailed analysis metrics.
        """
        analyzed_products = []

        for p in monitored_products:
            pid = p.get("product_id")
            name = p.get("name")
            category = p.get("category")
            seller_price = p.get("seller_price_inr", 0)
            competitors = p.get("competitors", [])
            events = p.get("monitor_events", [])

            # 1. Cheapest competitor price
            comp_prices = [c.get("price_inr", 0) for c in competitors]
            cheapest_comp_price = min(comp_prices) if comp_prices else seller_price

            # 2. Price Gap
            price_gap_inr = seller_price - cheapest_comp_price
            price_gap_pct = round((price_gap_inr / cheapest_comp_price) * 100, 1) if cheapest_comp_price > 0 else 0.0

            # 3. Price Position ("cheapest" / "mid_range" / "expensive")
            all_prices = sorted(comp_prices + [seller_price])
            if not competitors:
                price_position = "cheapest"
            elif seller_price == all_prices[0]:
                price_position = "cheapest"
            elif seller_price == all_prices[-1]:
                price_position = "expensive"
            else:
                price_position = "mid_range"

            # 4. Undercutting detected + which competitor
            undercutting_detected = False
            undercutting_competitor = None
            for c in competitors:
                if c.get("price_inr", 0) < seller_price:
                    undercutting_detected = True
                    undercutting_competitor = c.get("competitor_name")
                    break

            # 5. Price war active
            price_war_active = "price_war" in events

            # 6. Psychological threshold
            # E.g. Check if price is between X00 and X15 (like 510) and could be rounded down to X99 (like 499)
            psychological_threshold = False
            price_str = str(seller_price)
            if len(price_str) >= 3:
                last_two = seller_price % 100
                # If price is slightly above a round hundred (e.g. 500-515), it could be priced at X99
                if 0 <= last_two <= 15:
                    psychological_threshold = True

            analyzed_products.append({
                "product_id": pid,
                "name": name,
                "category": category,
                "seller_price_inr": seller_price,
                "platform": p.get("platform"),
                "competitors": competitors,
                "monitor_events": events,
                "analysis": {
                    "price_position": price_position,
                    "price_gap_inr": price_gap_inr,
                    "price_gap_pct": price_gap_pct,
                    "undercutting_detected": undercutting_detected,
                    "undercutting_competitor": undercutting_competitor,
                    "price_war_active": price_war_active,
                    "psychological_threshold": psychological_threshold
                }
            })

        return analyzed_products
