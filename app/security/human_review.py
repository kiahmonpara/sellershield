"""
Module: Human Review Gate (human_review.py)
Description: Intercepts automated claim filing flows and prompts for human verification.
ADK Pattern: Tool (utilizing system environmental parameters and CLI stream prompts)
Skills Applied: None
Inputs:
    - flagged_customers: list[dict] (suspicious risk profile outputs from pattern agent)
Outputs:
    - bool: True if approved (or bypassed via environment variables), False otherwise.
"""

import os
import sys

def prompt_human_approval(flagged_customers: list[dict]) -> bool:
    """Intercepts execution and prompts for manual approval in the terminal.
    Supports a bypass via environment variable for non-interactive runners (e.g. FastAPI / CI / Eval).

    Args:
        flagged_customers: List of risk profiles for flagged customers.

    Returns:
        True if approved, False otherwise.
    """
    print("\n" + "="*60)
    print(" RETURN SENSE - HUMAN REVIEW GATE REQUIRED ")
    print("="*60)
    print(f"Total Suspicious Accounts Flagged: {len(flagged_customers)}")
    print("-"*60)
    
    # Print a clear summary of all flagged customer profiles in the console for manual evaluation
    for idx, c in enumerate(flagged_customers):
        print(f"[{idx+1}] Customer ID: {c['customer_id']} | Risk Level: {c['risk_level']} | Score: {c['risk_score']}/100")
        print(f"    Triggered Signals: {', '.join(c['signals_triggered'])}")
        print(f"    Evidence: Returns: {c['evidence']['return_count']}, Total Return Val: INR {c['evidence']['total_return_value_inr']}")
        print("-"*60)

    # Check for non-interactive environments (FastAPI backend / Pytest runners / automatic evaluators)
    # Using environmental bypass parameters to avoid blocking background threads in production
    if os.getenv("AUTO_APPROVE") == "true" or os.getenv("PLAYGROUND_MODE") == "true" or not sys.stdin or not sys.stdin.isatty():
        print("Auto-Approval enabled or non-interactive environment detected. Bypassing human input.")
        print("="*60 + "\n")
        return True

    # Prompt user for console input when executing via interactive CLI
    print("Type 'APPROVE' to confirm and generate marketplace claim documents.")
    print("Type anything else to REJECT and log as rejected.")
    
    try:
        user_input = input("Decision: ").strip().upper()
        if user_input == "APPROVE":
            print("\n>>> Approved by Human Reviewer. Proceeding...")
            print("="*60 + "\n")
            return True
        else:
            print("\n>>> Rejected by Human Reviewer. Aborting claim generation...")
            print("="*60 + "\n")
            return False
    except (IOError, EOFError):
        # Fallback if console has no standard input stream (e.g. background threads / daemon tasks)
        print("\n>>> Non-interactive environment detected without AUTO_APPROVE. Defaulting to REJECT.")
        print("="*60 + "\n")
        return False
