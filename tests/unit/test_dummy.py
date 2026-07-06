import pytest
from app.tools.csv_reader import read_returns_csv
from app.tools.risk_scorer import is_fuzzy_address_match, calculate_customer_risk
from app.tools.claim_formatter import generate_claim_document
from app.security.pii_masker import mask_text_pii, mask_dict_pii

def test_is_fuzzy_address_match():
    # 1. Exact match
    assert is_fuzzy_address_match("Flat 402, Shiv Shakti, Bandra, Mumbai", "Flat 402, Shiv Shakti, Bandra, Mumbai") is True

    # 2. Case and spacing abbreviations match (Flat -> Fl, Apartments -> Apts)
    assert is_fuzzy_address_match(
        "Flat 402, Shiv Shakti, Bandra, Mumbai",
        "Fl 402, Shiv Shakti Apts, Bandra, Mumbai"
    ) is True

    # 3. Missing punctuation / slightly rearranged words matching >= 80%
    assert is_fuzzy_address_match(
        "402 Shiv Shakti Bandra Mumbai",
        "Flat 402, Shiv Shakti Bandra Mumbai"
    ) is True

    # 4. Strict flat/house number check (should fail if numbers do not match)
    assert is_fuzzy_address_match(
        "Flat 202, Shiv Shakti, Bandra, Mumbai",
        "Flat 402, Shiv Shakti, Bandra, Mumbai"
    ) is False

    # 5. Completely different addresses should fail
    assert is_fuzzy_address_match(
        "12/A Saket New Delhi",
        "Sector 15 Rohini Delhi"
    ) is False


def test_pii_masker():
    # Test phone number masking
    text_with_phone = "Contact Rajesh at +91 9876543210 or 9876543210."
    masked_phone = mask_text_pii(text_with_phone)
    assert "+91" not in masked_phone
    assert "9876543210" not in masked_phone
    assert "[PHONE_MASKED]" in masked_phone

    # Test email masking
    text_with_email = "Email us at support@returnsense.in today."
    masked_email = mask_text_pii(text_with_email)
    assert "support@returnsense.in" not in masked_email
    assert "[EMAIL_MASKED]" in masked_email

    # Test PAN Card masking
    text_with_pan = "PAN number is ABCDE1234F."
    masked_pan = mask_text_pii(text_with_pan)
    assert "ABCDE1234F" not in masked_pan
    assert "[PAN_MASKED]" in masked_pan

    # Test recursive dictionary masking
    data = {
        "customer_name": "Rajesh Kumar",
        "contact_info": {
            "email": "rajesh@gmail.com",
            "phone": "+919876543210"
        },
        "order_id": "ORD005"
    }
    masked_data = mask_dict_pii(data)
    assert masked_data["customer_name"] == "[MASKED]"
    assert masked_data["contact_info"]["email"] == "[EMAIL_MASKED]"
    assert masked_data["contact_info"]["phone"] == "[PHONE_MASKED]"
    assert masked_data["order_id"] == "ORD005"


def test_csv_reader_parsing():
    records = read_returns_csv("data/sample_returns.csv")
    assert len(records) > 0
    # Ensure item columns are loaded
    assert "item_id" in records[0]
    assert "item_name" in records[0]
    # Ensure date fields are formatted
    assert records[0]["order_date"] == "2026-06-01"


def test_risk_scorer_calculations():
    records = read_returns_csv("data/sample_returns.csv")
    profiles = calculate_customer_risk(records)
    
    profiles_dict = {p["customer_id"]: p for p in profiles}

    # C001 (Clean customer): Total returns = 1, should be LOW_RISK
    c001 = profiles_dict["C001"]
    assert c001["risk_level"] == "LOW_RISK"
    assert c001["risk_score"] < 40

    # C007 (Swap Fraud): returned 180g vs original 920g for premium shoes
    c007 = profiles_dict["C007"]
    assert "swap_fraud" in c007["signals_triggered"]

    # C004 (Serial Returner): 6 returns within 15 days, multiple platforms
    c004 = profiles_dict["C004"]
    assert c004["risk_level"] == "HIGH_RISK"
    assert "serial_returner" in c004["signals_triggered"]
    assert "policy_exploit" in c004["signals_triggered"]

    # C012a, C012b, C012c (Fuzzy Address Ring): same city, order value, different names, fuzzy address
    c12a = profiles_dict["C012a"]
    c12b = profiles_dict["C012b"]
    c12c = profiles_dict["C012c"]
    assert "identity_ring" in c12a["signals_triggered"]
    assert "identity_ring" in c12b["signals_triggered"]
    assert "identity_ring" in c12c["signals_triggered"]


def test_claim_formatter():
    profile = {
        "customer_id": "C007",
        "customer_name": "[MASKED]",
        "risk_score": 35,
        "signals_triggered": ["swap_fraud"],
        "evidence": {
            "return_count": 1,
            "return_window_days": 2,
            "total_return_value_inr": 8700.0,
            "platforms_abused": ["Amazon"]
        }
    }
    matching_returns = [
        {
            "order_id": "ORD011",
            "customer_id": "C007",
            "customer_name": "Vikram Singh",
            "order_date": "2026-06-11",
            "order_value_inr": 8700.0,
            "return_date": "2026-06-13",
            "return_reason": "wrong_item",
            "return_weight_g": 180.0,
            "original_weight_g": 920.0,
            "platform": "Amazon",
            "city": "Delhi",
            "address": "Sector 15 Rohini Delhi",
            "payment_mode": "prepaid",
            "item_id": "ITM101",
            "item_name": "Premium Leather Shoes"
        },
        {
            "order_id": "ORD011",
            "customer_id": "C007",
            "customer_name": "Vikram Singh",
            "order_date": "2026-06-11",
            "order_value_inr": 8700.0,
            "return_date": "",
            "return_reason": "",
            "return_weight_g": 0.0,
            "original_weight_g": 0.0,
            "platform": "Amazon",
            "city": "Delhi",
            "address": "Sector 15 Rohini Delhi",
            "payment_mode": "prepaid",
            "item_id": "ITM102",
            "item_name": "Shoe Care Kit"
        }
    ]

    claims = generate_claim_document(profile, matching_returns, "2026-07-04")
    
    assert claims["customer_id"] == "C007"
    assert "ITM101" in claims["generic"]
    assert "ITM102" in claims["generic"]
    assert "ORD011" in claims["generic"]
    assert "Amazon SAFE-T Claim Filing" in claims["amazon"]
    assert "Flipkart SPF Claim Submission" in claims["flipkart"]
