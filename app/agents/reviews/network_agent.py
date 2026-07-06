"""
Module: Review Network Pattern Agent (network_agent.py)
Description: Analyzes reviewers and temporal patterns for network metadata signals (burst posting, low verified rates, helpful vote clusters).
ADK Pattern: Tool (network heuristics scorer agent within the Review Pipeline)
Skills Applied: None
Inputs:
    - reviews: list[dict] (raw review dataset)
Outputs:
    - dict: suspicious network signals, burst windows, and list of suspect reviewer IDs.
"""

from datetime import datetime, timedelta
from collections import Counter

class NetworkAgent:
    def __init__(self):
        """Initializes the network pattern agent."""
        self.name = "network_agent"

    def run(self, reviews: list[dict]) -> dict:
        """Analyzes group patterns across reviews for network manipulation signals.

        Args:
            reviews: List of raw review dictionaries.

        Returns:
            Dictionary containing network_signals, burst_windows, and suspicious_reviewer_ids.
        """
        network_signals = []
        burst_windows = []
        suspicious_reviewer_ids = []

        if not reviews:
            return {
                "network_signals": [],
                "burst_windows": [],
                "suspicious_reviewer_ids": []
            }

        # 1. Temporal burst: >=5 reviews posted within any 24-hour window
        # Convert dates to datetime objects
        date_records = []
        for r in reviews:
            dt_str = r.get("review_date", "")
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d")
                date_records.append((dt, dt_str))
            except ValueError:
                continue

        # Sort dates
        date_records.sort(key=lambda x: x[0])
        
        # Check sliding windows
        burst_dates_flagged = set()
        for i in range(len(date_records)):
            current_time, current_str = date_records[i]
            window_end = current_time + timedelta(days=1)
            # count reviews in this window
            count = 0
            for j in range(i, len(date_records)):
                if date_records[j][0] < window_end:
                    count += 1
                else:
                    break
            if count >= 5:
                # Flag dates in this window
                burst_dates_flagged.add(current_str)
                burst_windows.append({
                    "date": current_str,
                    "count": count
                })

        if burst_windows:
            network_signals.append("temporal_burst")

        # 2. Reviewer velocity: any reviewer_id who posted >=5 reviews in 7 days
        # Since this represents a single scan, we count reviewer occurrences in the payload
        # And check if their reviewer_review_count field is high.
        # If any reviewer_id appears >=2 times in this product list, or has reviewer_review_count >= 5
        reviewer_ids = [r.get("reviewer_id") for r in reviews if r.get("reviewer_id")]
        reviewer_counts = Counter(reviewer_ids)
        
        high_velocity_reviewers = set()
        for rid, count in reviewer_counts.items():
            if count >= 2: # duplicate reviews in same product
                high_velocity_reviewers.add(rid)
        
        for r in reviews:
            rid = r.get("reviewer_id")
            if rid and r.get("reviewer_review_count", 0) >= 5:
                high_velocity_reviewers.add(rid)

        if high_velocity_reviewers:
            network_signals.append("reviewer_velocity")
            suspicious_reviewer_ids.extend(list(high_velocity_reviewers))

        # 3. Single-product reviewer: reviewer_review_count == 1
        single_product_count = sum(1 for r in reviews if r.get("reviewer_review_count") == 1)
        if single_product_count > 0:
            network_signals.append("single_product_reviewers")
            # add their reviewer ids to suspicious list
            for r in reviews:
                if r.get("reviewer_review_count") == 1 and r.get("reviewer_id"):
                    suspicious_reviewer_ids.append(r["reviewer_id"])

        # 4. Verified purchase rate: <40% for 4-star+ reviews
        high_rating_reviews = [r for r in reviews if r.get("rating", 0) >= 4]
        if high_rating_reviews:
            verified_count = sum(1 for r in high_rating_reviews if r.get("verified_purchase") is True)
            verified_rate = verified_count / len(high_rating_reviews)
            if verified_rate < 0.40:
                network_signals.append("suspicious_verification")

        # 5. Zero helpful votes cluster: >=60% of reviews have helpful_votes == 0
        zero_helpful_count = sum(1 for r in reviews if r.get("helpful_votes", 0) == 0)
        zero_helpful_rate = zero_helpful_count / len(reviews)
        if zero_helpful_rate >= 0.60:
            network_signals.append("zero_helpful_votes_cluster")

        return {
            "network_signals": network_signals,
            "burst_windows": burst_windows,
            "suspicious_reviewer_ids": list(set(suspicious_reviewer_ids))
        }
