import pytest
import os
import json
from app.agents.reviews.linguistic_agent import LinguisticAgent
from app.agents.reviews.network_agent import NetworkAgent
from app.agents.reviews.verdict_agent import VerdictAgent
from app.agents.pricing.monitor_agent import MonitorAgent
from app.agents.pricing.analysis_agent import AnalysisAgent
from app.agents.pricing.strategy_agent import StrategyAgent

# --- Review Module Evals ---

def test_review_under_8_words_5_star():
    agent = LinguisticAgent()
    # Review under 8 words, 5-star, no specifics -> fake_score >= 60
    reviews = [{
        "review_id": "R-1",
        "rating": 5,
        "review_text": "great product nice item love awesome perfect",
        "verified_purchase": False,
        "reviewer_review_count": 1
    }]
    res = agent.run(reviews)
    assert res[0]["fake_score"] >= 60

def test_burst_of_6_reviews_in_12_hours():
    # 2. Burst of 6 reviews in 12 hours -> temporal_burst signal triggered
    agent = NetworkAgent()
    reviews = [
        {"review_id": f"R-{i}", "review_date": "2026-07-04", "rating": 5, "review_text": "great", "reviewer_review_count": 3}
        for i in range(6)
    ]
    res = agent.run(reviews)
    assert "temporal_burst" in res["network_signals"]

def test_detailed_review_genuine():
    # 3. Detailed review, verified purchase, 60-day spread -> fake_score <= 30
    agent = LinguisticAgent()
    # A detailed review (>= 30 words) with footwear keywords ("comfortable running fit sole mesh")
    # should trigger no spam signals, hence fake_score = 0 <= 30.
    reviews = [{
        "review_id": "R-1",
        "rating": 5,
        "review_text": "These athletic running shoes are extremely comfortable. The mesh upper is highly breathable and the rubber soles have a fantastic grip for trail runs. Fits true to size.",
        "verified_purchase": True,
        "reviewer_review_count": 10
    }]
    res = agent.run(reviews)
    assert res[0]["fake_score"] <= 30

def test_positive_text_1_star_rating():
    # 4. Positive text + 1-star rating -> sentiment_mismatch signal triggered
    agent = LinguisticAgent()
    reviews = [{
        "review_id": "R-1",
        "rating": 1,
        "review_text": "love this great excellent shoes",
        "verified_purchase": True
    }]
    res = agent.run(reviews)
    assert "sentiment_mismatch" in res[0]["signals_triggered"]


# --- Pricing Module Evals ---

def test_pricing_above_cheapest():
    # 1. Seller ₹50 above cheapest -> price_position = "expensive", urgency = "ACT_NOW"
    monitor = MonitorAgent()
    analysis = AnalysisAgent()
    strategy = StrategyAgent()
    
    # Seller = 599, cheapest competitor = 549 (InsolePro)
    products = [{
        "product_id": "PROD-C",
        "name": "Orthotic Gel Insoles",
        "category": "Shoe Accessories",
        "seller_price_inr": 599,
        "platform": "Flipkart",
        "competitors": [
            {"competitor_name": "InsolePro", "price_inr": 549, "last_updated": "2026-07-04"}
        ]
    }]
    monitored = monitor.run(products)
    analyzed = analysis.run(monitored)
    strategized = strategy.run(analyzed)
    
    assert strategized[0]["analysis"]["price_position"] == "expensive"
    assert strategized[0]["strategy"]["urgency"] == "ACT_NOW"

def test_pricing_cheapest_strategy():
    # 2. Seller is cheapest -> strategy in ["Premium", "Bundle"]
    monitor = MonitorAgent()
    analysis = AnalysisAgent()
    strategy = StrategyAgent()
    
    # Seller = 349, competitors = 379, 399
    products = [{
        "product_id": "PROD-B",
        "name": "Waterproof Sneaker Spray",
        "category": "Shoe Care",
        "seller_price_inr": 349,
        "platform": "Amazon",
        "competitors": [
            {"competitor_name": "CleanShine", "price_inr": 379, "last_updated": "2026-07-04"}
        ]
    }]
    monitored = monitor.run(products)
    analyzed = analysis.run(monitored)
    strategized = strategy.run(analyzed)
    
    assert strategized[0]["strategy"]["strategy"] in ["Premium", "Bundle"]

def test_competitor_always_below():
    # 3. Competitor always ₹2 below -> undercutting_detected = true
    monitor = MonitorAgent()
    analysis = AnalysisAgent()
    
    products = [{
        "product_id": "PROD-A",
        "name": "Elite Running Shoes",
        "category": "Running Shoes",
        "seller_price_inr": 899,
        "platform": "Amazon",
        "competitors": [
            {"competitor_name": "SportyFit", "price_inr": 897, "last_updated": "2026-07-04"}
        ]
    }]
    monitored = monitor.run(products)
    analyzed = analysis.run(monitored)
    
    assert analyzed[0]["analysis"]["undercutting_detected"] is True
