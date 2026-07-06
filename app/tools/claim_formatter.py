import os

GENERIC_TEMPLATE = """### RETURN DISCREPANCY & LOSS CLAIM
**Date**: {current_date}
**Claim Reference**: {order_id}
**Platform**: {platform}
**Customer Identifier**: {masked_name} ({customer_id})

#### Summary of Issue:
We are claiming compensation for a return shipment discrepancy. The returned package does not match the original goods dispatched.

#### Detailed Evidence:
- **Discrepancy Type**: {discrepancy_reason}
- **Returned Items Log**:
{items_list}
- **Total original weight shipped**: {original_weight}g
- **Total weight returned**: {return_weight}g
- **Total Weight Loss/Delta**: {weight_delta}g ({weight_delta_percent}%)

#### Risk Analysis Metrics:
- **Return fraud score**: {risk_score}/100
- **Identified Risk Vectors**: {risk_vectors}
- **Total return frequency (past 30d)**: {return_count}

Please review the attached evidence dossier and process the reimbursement.
"""

AMAZON_TEMPLATE = """Amazon SAFE-T Claim Filing
--------------------------------------
Order ID: {order_id}
Reason: Item returned was damaged / wrong item / empty package.

Description of Issue:
The buyer returned an order containing the following items:
{items_list}
This order has a significant weight discrepancy. The outbound shipment weight was {original_weight}g. The returned package weight was measured at {return_weight}g, representing a {weight_delta_percent}% reduction. The return reasons stated include: '{return_reasons_str}'. This customer exhibits serial return characteristics with a ReturnSense Risk Score of {risk_score}/100. Please issue a refund.
"""

FLIPKART_TEMPLATE = """Flipkart SPF Claim Submission
-----------------------------
Order ID: {order_id}
Return ID: RET-{order_id}
SPF Claim Category: Wrong Product Received / Weight Discrepancy

Detailed Description:
We received a return for Order ID {order_id}. The product returned is incorrect. 
Returned Items Log:
{items_list}
- Total Original Dispatch Weight: {original_weight}g
- Total Return Received Weight: {return_weight}g
- Total Discrepancy Margin: {weight_delta}g

We request the SPF committee to reimburse the order value of INR {order_value} due to customer return policy abuse.
"""

def format_underscore_text(text: str) -> str:
    if not text:
        return ""
    # Handle comma separated items
    items = text.split(",")
    formatted_items = []
    for item in items:
        words = item.strip().split("_")
        formatted_items.append(" ".join(word.capitalize() for word in words if word))
    return ", ".join(formatted_items)


def generate_claim_document(profile: dict, matching_returns: list[dict], current_date: str) -> dict:
    """Generates generic and platform-specific claim drafts for a flagged customer profile.
    Correctly aggregates and itemizes multi-item rows inside the order.

    Args:
        profile: The customer risk profile.
        matching_returns: The list of raw transaction/return rows associated with the customer.
        current_date: Today's date string.

    Returns:
        Dictionary containing claim text for different templates.
    """
    cid = profile.get("customer_id")
    masked_name = profile.get("customer_name")
    risk_score = profile.get("risk_score")
    raw_vectors = ", ".join(profile.get("signals_triggered", []))
    risk_vectors = format_underscore_text(raw_vectors)
    evidence = profile.get("evidence", {})
    return_count = evidence.get("return_count", 0)

    # 1. Group matching rows by order_id
    orders = {}
    for r in matching_returns:
        oid = r.get("order_id")
        if not oid:
            continue
        if oid not in orders:
            orders[oid] = []
        orders[oid].append(r)

    # Find the order with the largest weight discrepancy to claim against
    selected_order_id = None
    max_delta = -1.0
    for oid, rows in orders.items():
        orig_w = sum(float(r.get("original_weight_g", 0.0)) for r in rows)
        ret_w = sum(float(r.get("return_weight_g", 0.0)) for r in rows if r.get("return_date"))
        delta = abs(orig_w - ret_w)
        if delta > max_delta:
            max_delta = delta
            selected_order_id = oid

    # Default to first order if none has a discrepancy
    if not selected_order_id and orders:
        selected_order_id = list(orders.keys())[0]

    # Aggregate selected order rows
    selected_rows = orders.get(selected_order_id, [])
    platform = selected_rows[0].get("platform", "N/A") if selected_rows else "N/A"
    order_value = selected_rows[0].get("order_value_inr", 0.0) if selected_rows else 0.0

    original_weight = 0.0
    return_weight = 0.0
    item_lines = []
    reasons = set()

    for r in selected_rows:
        item_id = r.get("item_id", "N/A")
        item_name = r.get("item_name", "N/A")
        orig_w = float(r.get("original_weight_g", 0.0))
        ret_w = float(r.get("return_weight_g", 0.0)) if r.get("return_date") else 0.0
        raw_reason = r.get("return_reason", "N/A")
        reason = format_underscore_text(raw_reason)
        is_returned = bool(r.get("return_date"))

        original_weight += orig_w
        if is_returned:
            return_weight += ret_w
            reasons.add(reason)
            item_lines.append(f"  - Item {item_id} ({item_name}): Outbound weight {orig_w}g, Returned weight {ret_w}g. Reason: {reason}")
        else:
            item_lines.append(f"  - Item {item_id} ({item_name}): Outbound weight {orig_w}g (Not returned)")

    items_list = "\n".join(item_lines) if item_lines else "  - No item returns registered."
    return_reasons_str = ", ".join(reasons) if reasons else "Wrong Item"

    weight_delta = abs(original_weight - return_weight)
    weight_delta_percent = round((weight_delta / original_weight * 100), 2) if original_weight > 0 else 0.0

    discrepancy_reason = "Weight discrepancy / swap fraud" if original_weight > 0 and return_weight < 0.5 * original_weight else "Serial returns and COD policy abuse"

    formats = {
        "current_date": current_date,
        "order_id": selected_order_id,
        "platform": platform,
        "masked_name": masked_name,
        "customer_id": cid,
        "discrepancy_reason": discrepancy_reason,
        "original_weight": original_weight,
        "return_weight": return_weight,
        "weight_delta": weight_delta,
        "weight_delta_percent": weight_delta_percent,
        "risk_score": risk_score,
        "risk_vectors": risk_vectors,
        "return_count": return_count,
        "order_value": order_value,
        "items_list": items_list,
        "return_reasons_str": return_reasons_str
    }

    claim_drafts = {
        "customer_id": cid,
        "generic": GENERIC_TEMPLATE.format(**formats),
        "amazon": AMAZON_TEMPLATE.format(**formats),
        "flipkart": FLIPKART_TEMPLATE.format(**formats),
        "target_file": f"claim_{cid}.txt"
    }

    return claim_drafts
