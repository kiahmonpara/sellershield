"""
Module: Pricing Monitor Agent (monitor_agent.py)
Description: Scans competitor prices, appends scans to historical logs, and flags undercutting and price wars.
ADK Pattern: Tool (pricing analysis agent within the Pricing Pipeline)
Skills Applied: None
Inputs:
    - products: list[dict] (raw catalog pricing data)
Outputs:
    - list[dict]: monitored products with flagged events (e.g. systematic_undercut, price_war).
"""

import os
import json
from datetime import datetime

class MonitorAgent:
    def __init__(self):
        """Initializes the pricing monitor agent with a path to price history store."""
        self.name = "monitor_agent"
        self.history_file = "data/price_history.json"

    def run(self, products: list[dict]) -> list[dict]:
        """Scans current competitor prices, flags events, and appends to price history.

        Args:
            products: List of current products with pricing info.

        Returns:
            List of products with flagged monitor events.
        """
        # Load historical scans
        history_scans = []
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    history_scans = json.load(f)
            except Exception as e:
                print(f"[monitor_agent] Warning: Could not read history file: {e}")

        # Get list of all known historical competitor names
        known_competitors = set()
        for scan in history_scans:
            for p in scan.get("products", []):
                for comp_name in p.get("competitors", {}).keys():
                    known_competitors.add(comp_name)

        # 1. Identify systematic undercutter candidates
        # Count how many times each competitor is ₹1 to ₹10 below the seller across the catalog
        undercut_counts = {}
        for p in products:
            seller_price = p.get("seller_price_inr", 0)
            for c in p.get("competitors", []):
                comp_name = c.get("competitor_name")
                comp_price = c.get("price_inr", 0)
                diff = seller_price - comp_price
                if 1 <= diff <= 10:
                    undercut_counts[comp_name] = undercut_counts.get(comp_name, 0) + 1

        systematic_undercutters = {name for name, count in undercut_counts.items() if count >= 1} # or count >= 2. Let's make it >= 1 since catalog is small

        monitored_products = []
        scan_entry_products = []

        for p in products:
            pid = p.get("product_id")
            name = p.get("name")
            category = p.get("category")
            seller_price = p.get("seller_price_inr", 0)
            competitors = p.get("competitors", [])

            # Collect events
            events = []

            # 1. Being undercut
            cheapest_comp_price = min([c.get("price_inr", 999999) for c in competitors]) if competitors else seller_price
            if cheapest_comp_price < seller_price:
                events.append("being_undercut")

            # 2. Systematic undercut
            for c in competitors:
                comp_name = c.get("competitor_name")
                if comp_name in systematic_undercutters and c.get("price_inr", 0) < seller_price:
                    events.append("systematic_undercut")
                    break

            # 3. Price war (>=3 competitors dropped price or active)
            # For simplicity, if we have >=3 competitors and the seller is being undercut by >=3 of them, or they are all pricing low
            undercutting_competitors = [c for c in competitors if c.get("price_inr", 0) < seller_price]
            if len(undercutting_competitors) >= 3:
                events.append("price_war")

            # 4. New entrant
            for c in competitors:
                comp_name = c.get("competitor_name")
                if comp_name not in known_competitors:
                    events.append("new_entrant")
                    break

            # 5. Seller is cheapest in category
            # Find all products in same category
            same_cat_products = [other for other in products if other.get("category") == category]
            # Get the cheapest competitor across all same category products
            cheapest_in_category = True
            for other in same_cat_products:
                other_seller_price = other.get("seller_price_inr", 0)
                other_comps = other.get("competitors", [])
                other_cheapest_comp = min([c.get("price_inr", 999999) for c in other_comps]) if other_comps else other_seller_price
                if other_cheapest_comp < seller_price:
                    cheapest_in_category = False
                    break
            
            if cheapest_in_category and cheapest_comp_price >= seller_price:
                events.append("cheapest_in_category")

            monitored_products.append({
                "product_id": pid,
                "name": name,
                "category": category,
                "seller_price_inr": seller_price,
                "platform": p.get("platform"),
                "competitors": competitors,
                "monitor_events": events
            })

            # Prepare for scan history append
            scan_entry_products.append({
                "product_id": pid,
                "seller_price": seller_price,
                "competitors": {c.get("competitor_name"): c.get("price_inr") for c in competitors}
            })

        # Append to price_history.json
        new_scan = {
            "scan_date": datetime.now().strftime("%Y-%m-%d"),
            "scan_id": f"scan_{len(history_scans) + 1:03d}",
            "products": scan_entry_products
        }
        
        history_scans.append(new_scan)
        
        try:
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(history_scans, f, indent=2)
        except Exception as e:
            print(f"[monitor_agent] Error writing scan entry: {e}")

        return monitored_products
