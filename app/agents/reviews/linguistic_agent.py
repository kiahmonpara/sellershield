"""
Module: Review Linguistic Analysis Agent (linguistic_agent.py)
Description: Analyzes review text syntax and structure for spam features (generic praise, keyword stuffing, mismatches).
ADK Pattern: Tool (linguistic heuristics scorer agent within the Review Pipeline)
Skills Applied: None
Inputs:
    - reviews: list[dict] (raw review texts)
    - product_title: str (product label for keyword stuffing check)
Outputs:
    - list[dict]: evaluated reviews containing fake scores and signals.
"""

import re

class LinguisticAgent:
    def __init__(self):
        """Initializes the linguistic agent."""
        self.name = "linguistic_agent"

    def run(self, reviews: list[dict], product_title: str = "") -> list[dict]:
        """Analyzes a list of reviews for linguistic spam signals.

        Args:
            reviews: List of review dictionaries.
            product_title: Title/name of the product to check for keyword stuffing.

        Returns:
            List of reviews with fake_score, authenticity_label, and signals_triggered.
        """
        analyzed_reviews = []
        
        # Stopwords for keyword stuffing
        stop_words = {"and", "the", "a", "of", "for", "with", "in", "to", "is", "it", "on", "this", "that", "at", "by", "an"}
        title_words = []
        if product_title:
            cleaned_title = re.sub(r'[^\w\s]', '', product_title.lower())
            title_words = [w for w in cleaned_title.split() if w not in stop_words and len(w) > 2]

        for r in reviews:
            review_id = r.get("review_id", "REV-UNKNOWN")
            text = r.get("review_text", "")
            rating = r.get("rating", 5)
            
            fake_score = 0
            signals_triggered = []
            
            cleaned_text = re.sub(r'[^\w\s]', ' ', text.lower())
            words = cleaned_text.split()
            word_count = len(words)
            
            # 1. Generic praise check
            # under 30 words, has generic words, no specific footwear words
            generic_indicators = {"great", "nice", "good", "best", "amazing", "perfect", "love", "awesome", "excellent", "wonderful"}
            footwear_keywords = {"sole", "lace", "leather", "fit", "size", "color", "run", "walk", "comfort", "pain", "heel", "toe", "cushion", "mesh", "stitch", "material", "tight", "loose", "warm", "breathable", "waterproof", "grip", "slip", "wear"}
            
            has_generic = any(w in generic_indicators for w in words)
            has_footwear = any(w in footwear_keywords for w in words)
            
            if word_count < 30 and has_generic and not has_footwear:
                fake_score += 25
                signals_triggered.append("generic_praise")
                
            # 2. Sentiment-rating mismatch
            positive_indicators = {"love", "great", "excellent", "perfect", "amazing", "awesome", "good", "satisfied", "wonderful"}
            negative_indicators = {"bad", "worst", "terrible", "broke", "useless", "waste", "poor", "hate", "damaged", "defective"}
            
            has_positive = any(w in positive_indicators for w in words)
            has_negative = any(w in negative_indicators for w in words)
            
            if (has_positive and rating <= 2) or (has_negative and rating >= 4):
                fake_score += 30
                signals_triggered.append("sentiment_mismatch")
                
            # 3. Keyword stuffing
            stuffed = False
            for tw in title_words:
                # Count occurrences of title word in cleaned review text
                count = len(re.findall(rf"\b{re.escape(tw)}\b", cleaned_text))
                if count > 2:
                    stuffed = True
                    break
            if stuffed:
                fake_score += 20
                signals_triggered.append("keyword_stuffing")
                
            # 4. Superlative overuse
            # words ending in "est" excluding common non-superlatives
            common_non_est = {"test", "chest", "nest", "rest", "west", "guest", "forest", "interest", "request", "best", "least", "estimate", "destined", "establish"}
            superlative_count = 0
            for w in words:
                if w.endswith("est") and w not in common_non_est:
                    superlative_count += 1
                elif w in {"best", "most", "worst"}:
                    superlative_count += 1
            
            if superlative_count > 3:
                fake_score += 15
                signals_triggered.append("superlative_overuse")
                
            # 5. Suspiciously short
            if word_count < 8 and rating == 5:
                short_penalty = 35 if not has_footwear else 10
                fake_score += short_penalty
                signals_triggered.append("suspiciously_short")
                
            # Cap fake score at 100
            fake_score = min(fake_score, 100)
            
            # Label
            if fake_score >= 60:
                label = "FAKE"
            elif fake_score >= 40:
                label = "SUSPICIOUS"
            else:
                label = "GENUINE"
                
            analyzed_reviews.append({
                "review_id": review_id,
                "fake_score": fake_score,
                "authenticity_label": label,
                "signals_triggered": signals_triggered,
                # Keep original fields
                "rating": rating,
                "review_text": text,
                "reviewer_id": r.get("reviewer_id", ""),
                "reviewer_name": r.get("reviewer_name", ""),
                "review_date": r.get("review_date", ""),
                "verified_purchase": r.get("verified_purchase", False),
                "helpful_votes": r.get("helpful_votes", 0),
                "reviewer_review_count": r.get("reviewer_review_count", 1)
            })
            
        return analyzed_reviews
