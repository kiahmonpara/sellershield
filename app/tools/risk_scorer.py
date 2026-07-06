from datetime import datetime, timedelta
import re

NORMALIZATION_MAP = {
    "flat": "fl", "fl": "fl", 
    "apartments": "apt", "apartment": "apt", "apts": "apt", "apt": "apt",
    "street": "st", "st": "st", 
    "road": "rd", "rd": "rd", 
    "floor": "flr", "flr": "flr", 
    "building": "bldg", "bldg": "bldg", 
    "house": "hse", "hse": "hse"
}

def is_fuzzy_address_match(addr1: str, addr2: str) -> bool:
    """Checks if two address strings represent the same physical location.
    Applies Jaccard token similarity (threshold: 80%) with mapped abbreviations and
    strict matching on numerical values (flat/house numbers).
    """
    if not addr1 or not addr2:
        return False

    a1 = addr1.lower().strip()
    a2 = addr2.lower().strip()

    # If exact match
    if a1 == a2:
        return True

    # Check numeric matching: any numbers found must be identical
    nums1 = set(re.findall(r'\d+', a1))
    nums2 = set(re.findall(r'\d+', a2))
    if nums1 != nums2:
        return False

    # Remove common punctuation
    a1_clean = re.sub(r'[^\w\s]', ' ', a1)
    a2_clean = re.sub(r'[^\w\s]', ' ', a2)

    # Tokenize
    tokens1 = set(a1_clean.split())
    tokens2 = set(a2_clean.split())

    # Filter filler words
    filler_words = {"of", "and", "the", "in", "to", "at", "near", "opposite", "opp"}
    tokens1 = tokens1 - filler_words
    tokens2 = tokens2 - filler_words

    if not tokens1 or not tokens2:
        return False

    # Normalize tokens with mapped abbreviations
    normalized_tokens1 = {NORMALIZATION_MAP.get(t, t) for t in tokens1}
    normalized_tokens2 = {NORMALIZATION_MAP.get(t, t) for t in tokens2}

    # Calculate Jaccard Similarity
    intersection = normalized_tokens1.intersection(normalized_tokens2)
    union = normalized_tokens1.union(normalized_tokens2)

    jaccard_ratio = len(intersection) / len(union)
    return jaccard_ratio >= 0.80


def mask_name(name: str) -> str:
    """Masks a customer's name."""
    return "[MASKED]"


def calculate_customer_risk(records: list[dict]) -> list[dict]:
    """Evaluates fraud risk across all customers. It aggregates multi-item rows at the
    order level and clusters similar addresses to identify syndicates.
    """
    if not records:
        return []

    # 1. Fuzzy Address Clustering
    unique_addresses = list({r.get("address", "").strip() for r in records if r.get("address")})
    address_clusters = []
    
    for addr in unique_addresses:
        added = False
        for cluster in address_clusters:
            # Check similarity with representative
            if is_fuzzy_address_match(addr, cluster[0]):
                cluster.append(addr)
                added = True
                break
        if not added:
            address_clusters.append([addr])

    # Map address string to representative cluster key
    addr_to_rep = {}
    for cluster in address_clusters:
        rep = cluster[0]
        for addr in cluster:
            addr_to_rep[addr.strip()] = rep.strip()

    # Normalize address field in all records to their representative cluster address
    for r in records:
        addr = r.get("address", "").strip()
        if addr in addr_to_rep:
            r["normalized_address"] = addr_to_rep[addr]
        else:
            r["normalized_address"] = addr

    # 2. Group and Aggregate Multi-Item rows into Order ID groupings
    orders_by_id = {}
    for r in records:
        oid = r.get("order_id")
        if not oid:
            continue
        if oid not in orders_by_id:
            orders_by_id[oid] = {
                "order_id": oid,
                "customer_id": r.get("customer_id"),
                "customer_name": r.get("customer_name"),
                "order_date": r.get("order_date"),
                "order_value_inr": r.get("order_value_inr", 0.0),
                "platform": r.get("platform"),
                "city": r.get("city"),
                "normalized_address": r.get("normalized_address"),
                "payment_mode": r.get("payment_mode"),
                "return_date": r.get("return_date"),
                # Lists to aggregate multi-item rows
                "items": [],
                "total_original_weight": 0.0,
                "total_returned_weight": 0.0,
                "return_reasons": set()
            }

            # Take return_date if present
            if r.get("return_date"):
                orders_by_id[oid]["return_date"] = r.get("return_date")

        order = orders_by_id[oid]
        # Append item details
        item_id = r.get("item_id", "N/A")
        item_name = r.get("item_name", "N/A")
        orig_w = r.get("original_weight_g", 0.0)
        ret_w = r.get("return_weight_g", 0.0)
        is_returned = bool(r.get("return_date"))

        order["items"].append({
            "item_id": item_id,
            "item_name": item_name,
            "original_weight_g": orig_w,
            "return_weight_g": ret_w,
            "is_returned": is_returned,
            "return_reason": r.get("return_reason", "")
        })

        order["total_original_weight"] += orig_w
        if is_returned:
            order["total_returned_weight"] += ret_w
            if r.get("return_reason"):
                order["return_reasons"].add(r.get("return_reason").strip().lower())

    # Convert back to flat list of aggregated orders
    aggregated_orders = list(orders_by_id.values())

    # Group aggregated orders by customer_id
    customer_orders = {}
    for o in aggregated_orders:
        cid = o.get("customer_id")
        if not cid:
            continue
        if cid not in customer_orders:
            customer_orders[cid] = []
        customer_orders[cid].append(o)

    # Pre-calculate Address/Identity Ring metrics across all aggregated orders
    # - Same city + same order_value_inr + different customer names
    city_value_names = {}
    for o in aggregated_orders:
        city = o.get("city", "").strip().lower()
        val = o.get("order_value_inr", 0.0)
        name = o.get("customer_name", "").strip()
        if not city or val <= 0:
            continue
        key = (city, val)
        if key not in city_value_names:
            city_value_names[key] = set()
        city_value_names[key].add(name)

    ring_customers_by_city_val = set()
    for key, names in city_value_names.items():
        if len(names) > 1:
            for o in aggregated_orders:
                city = o.get("city", "").strip().lower()
                val = o.get("order_value_inr", 0.0)
                if city == key[0] and val == key[1]:
                    ring_customers_by_city_val.add(o.get("customer_id"))

    # - Same address cluster with >3 orders returned
    address_returned_count = {}
    for o in aggregated_orders:
        addr = o.get("normalized_address")
        if addr and o.get("return_date"):
            address_returned_count[addr] = address_returned_count.get(addr, 0) + 1

    ring_addresses = {addr for addr, count in address_returned_count.items() if count > 3}

    results = []

    for cid, o_list in customer_orders.items():
        raw_name = o_list[0].get("customer_name", "Unknown")
        masked_name = mask_name(raw_name)

        return_orders = [o for o in o_list if o.get("return_date")]
        total_returns = len(return_orders)
        total_orders = len(o_list)

        signals_triggered = []
        weight_sum = 0

        if total_returns > 0:
            # Parse dates
            parsed_returns = []
            for o in return_orders:
                r_date_str = o.get("return_date")
                o_date_str = o.get("order_date")
                try:
                    r_dt = datetime.strptime(r_date_str, "%Y-%m-%d")
                except ValueError:
                    r_dt = None
                try:
                    o_dt = datetime.strptime(o_date_str, "%Y-%m-%d")
                except ValueError:
                    o_dt = None
                parsed_returns.append((o, r_dt, o_dt))

            parsed_returns = [pr for pr in parsed_returns if pr[1] is not None]
            parsed_returns.sort(key=lambda x: x[1])

            # Signal 1: Serial Returner (weight: 30)
            serial_trigger = False
            for i, (_, dt_i, _) in enumerate(parsed_returns):
                window_end = dt_i + timedelta(days=30)
                count_in_window = sum(1 for _, dt_j, _ in parsed_returns[i:] if dt_j <= window_end)
                if count_in_window > 3:
                    serial_trigger = True
                    break
            
            platforms = {o.get("platform") for o in return_orders if o.get("platform")}
            if len(platforms) > 1:
                serial_trigger = True

            if serial_trigger:
                signals_triggered.append("serial_returner")
                weight_sum += 30

            # Signal 2: Swap Fraud (weight: 35)
            # - return_weight_g < 50% of original_weight_g (aggregated at order level)
            # - Return reason = "wrong_item" AND weight discrepancy > 200g
            swap_trigger = False
            for o in return_orders:
                ret_w = o.get("total_returned_weight", 0.0)
                orig_w = o.get("total_original_weight", 0.0)
                
                # Check order level weight ratio
                if orig_w > 0 and ret_w < 0.5 * orig_w:
                    swap_trigger = True
                
                # Check itemized wrong_item delta
                for item in o["items"]:
                    if item["is_returned"]:
                        reason = item["return_reason"].lower().strip()
                        iw_delta = item["original_weight_g"] - item["return_weight_g"]
                        if reason in ["wrong_item", "sole_defect"] and iw_delta > 200.0:
                            swap_trigger = True

            if swap_trigger:
                signals_triggered.append("swap_fraud")
                weight_sum += 35

            # Signal 3: COD Abuse (weight: 20)
            cod_trigger = False
            cod_returns = [o for o in return_orders if o.get("payment_mode", "").upper() == "COD"]
            if len(cod_returns) > 2:
                cod_trigger = True
            
            cod_policy_reasons = 0
            for o in cod_returns:
                for item in o["items"]:
                    if item["is_returned"]:
                        reason = item["return_reason"].lower().strip()
                        if reason in ["not_as_described", "wrong_color", "not_as_pictured", "color_mismatch"]:
                            cod_policy_reasons += 1
            if cod_policy_reasons >= 2:
                cod_trigger = True

            if cod_trigger:
                signals_triggered.append("cod_abuse")
                weight_sum += 20

            # Signal 4: Address/Identity Ring (weight: 25)
            ring_trigger = False
            if cid in ring_customers_by_city_val:
                ring_trigger = True
            for o in return_orders:
                addr = o.get("normalized_address")
                if addr in ring_addresses:
                    ring_trigger = True

            if ring_trigger:
                signals_triggered.append("identity_ring")
                weight_sum += 25

            # Signal 5: Policy Exploit (weight: 15)
            policy_trigger = False
            reasons = set()
            for o in return_orders:
                reasons.update(o["return_reasons"])
            if ("not_as_described" in reasons or "not_as_pictured" in reasons) and ("wrong_color" in reasons or "color_mismatch" in reasons):
                policy_trigger = True
            
            fast_returns = 0
            for _, r_dt, o_dt in parsed_returns:
                if r_dt and o_dt:
                    if (r_dt - o_dt).days <= 2:
                        fast_returns += 1
            if fast_returns >= 2:
                policy_trigger = True

            if policy_trigger:
                signals_triggered.append("policy_exploit")
                weight_sum += 15

        risk_score = min(100, weight_sum)

        if risk_score >= 70:
            risk_level = "HIGH_RISK"
        elif risk_score >= 40:
            risk_level = "MEDIUM_RISK"
        else:
            risk_level = "LOW_RISK"

        # Safety Overrides
        if total_returns <= 1 and risk_level == "HIGH_RISK":
            risk_level = "MEDIUM_RISK"
            risk_score = 69

        platforms_abused = list({o.get("platform") for o in return_orders if o.get("platform")})
        total_return_value_inr = sum(o.get("order_value_inr", 0.0) for o in return_orders)

        return_window_days = 0
        if total_returns > 1:
            try:
                r_dates = [datetime.strptime(o.get("return_date"), "%Y-%m-%d") for o in return_orders if o.get("return_date")]
                if r_dates:
                    return_window_days = (max(r_dates) - min(r_dates)).days
            except ValueError:
                pass
        elif total_returns == 1:
            try:
                o_date = datetime.strptime(return_orders[0].get("order_date"), "%Y-%m-%d")
                r_date = datetime.strptime(return_orders[0].get("return_date"), "%Y-%m-%d")
                return_window_days = (r_date - o_date).days
            except ValueError:
                pass

        evidence = {
            "return_count": total_returns,
            "return_window_days": return_window_days,
            "total_return_value_inr": total_return_value_inr,
            "platforms_abused": platforms_abused
        }

        results.append({
            "customer_id": cid,
            "customer_name": masked_name,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "signals_triggered": signals_triggered,
            "evidence": evidence
        })

    return results
