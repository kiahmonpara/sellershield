"""
Module: Review Authenticity Verdict Agent (verdict_agent.py)
Description: Merges linguistic scoring with network-level anomalies to determine overall rating health.
ADK Pattern: Tool (decision merging agent within the Review Pipeline)
Skills Applied: None
Inputs:
    - linguistic_results: list[dict] (heuristics metrics per review)
    - network_results: dict (anomalous network indicators)
Outputs:
    - dict: merged product verdict (TRUSTWORTHY, SUSPICIOUS, MANIPULATED), adjusted score/rating, and top evidences.
"""

class VerdictAgent:
    def __init__(self):
        """Initializes the verdict agent."""
        self.name = "verdict_agent"

    def run(self, linguistic_results: list[dict], network_results: dict) -> dict:
        """Combines linguistic and network-level outputs to determine the overall product verdict.

        Args:
            linguistic_results: List of review dicts containing 'fake_score' and 'signals_triggered'.
            network_results: Dictionary containing 'network_signals', 'burst_windows', etc.

        Returns:
            Dictionary with overall_authenticity_score, verdict, adjusted_rating, etc.
        """
        if not linguistic_results:
            return {
                "overall_authenticity_score": 100,
                "verdict": "TRUSTWORTHY",
                "fake_review_count": 0,
                "genuine_review_count": 0,
                "adjusted_rating": 0.0,
                "displayed_rating": 0.0,
                "top_3_evidence": []
            }

        # 1. Linguistic authenticity calculation
        linguistic_fake_avg = sum(r.get("fake_score", 0) for r in linguistic_results) / len(linguistic_results)
        linguistic_authenticity = 100 - linguistic_fake_avg

        # 2. Network authenticity calculation
        network_signals = network_results.get("network_signals", [])
        network_spam_score = 0
        if "temporal_burst" in network_signals:
            network_spam_score += 30
        if "reviewer_velocity" in network_signals:
            network_spam_score += 25
        if "suspicious_verification" in network_signals:
            network_spam_score += 20
        if "zero_helpful_votes_cluster" in network_signals:
            network_spam_score += 15
        if "single_product_reviewers" in network_signals:
            network_spam_score += 10
            
        network_spam_score = min(network_spam_score, 100)
        network_authenticity = 100 - network_spam_score

        # 3. Weighted Authenticity Score (Linguistic 60%, Network 40%)
        overall_score = (linguistic_authenticity * 0.6) + (network_authenticity * 0.4)
        overall_score = max(0, min(100, int(overall_score)))

        # 4. Verdict Thresholds
        if overall_score >= 70:
            verdict = "TRUSTWORTHY"
        elif overall_score >= 40:
            verdict = "SUSPICIOUS"
        else:
            verdict = "MANIPULATED"

        # 5. Counts
        fake_count = sum(1 for r in linguistic_results if r.get("fake_score", 0) >= 60)
        genuine_count = sum(1 for r in linguistic_results if r.get("fake_score", 0) < 40)

        # 6. Ratings
        total_ratings = [r.get("rating", 0) for r in linguistic_results]
        displayed_rating = round(sum(total_ratings) / len(total_ratings), 1) if total_ratings else 0.0

        genuine_ratings = [r.get("rating", 0) for r in linguistic_results if r.get("fake_score", 0) < 40]
        adjusted_rating = round(sum(genuine_ratings) / len(genuine_ratings), 1) if genuine_ratings else displayed_rating

        # 7. Evidences
        # Compile all triggered signals with their weights to find the highest-impact ones
        evidence_weights = {
            "sentiment_mismatch": (30, "Rating-sentiment mismatch detected"),
            "temporal_burst": (30, "Temporal burst (multiple reviews in 24h)"),
            "generic_praise": (25, "Generic praise with no footwear details"),
            "reviewer_velocity": (25, "High reviewer submission velocity"),
            "keyword_stuffing": (20, "Keyword stuffing of product title"),
            "suspicious_verification": (20, "Low verified purchase rate (<40%)"),
            "superlative_overuse": (15, "Overuse of superlatives"),
            "zero_helpful_votes_cluster": (15, "Abnormal cluster of zero helpful votes"),
            "single_product_reviewers": (10, "High concentration of single-review accounts"),
            "suspiciously_short": (10, "Suspiciously short 5-star reviews")
        }

        triggered_signals_with_weights = []
        for r in linguistic_results:
            for sig in r.get("signals_triggered", []):
                if sig in evidence_weights:
                    triggered_signals_with_weights.append(sig)
                    
        for sig in network_signals:
            if sig in evidence_weights:
                triggered_signals_with_weights.append(sig)

        # Remove duplicates while keeping order of highest weight
        unique_signals = list(set(triggered_signals_with_weights))
        unique_signals.sort(key=lambda s: evidence_weights[s][0], reverse=True)

        top_3_evidence = [evidence_weights[s][1] for s in unique_signals[:3]]

        return {
            "overall_authenticity_score": overall_score,
            "verdict": verdict,
            "fake_review_count": fake_count,
            "genuine_review_count": genuine_count,
            "adjusted_rating": adjusted_rating,
            "displayed_rating": displayed_rating,
            "top_3_evidence": top_3_evidence
        }
