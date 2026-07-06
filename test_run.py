import os
import sys

# Set auto-approve environment variable to bypass CLI prompt during test run
os.environ["AUTO_APPROVE"] = "true"

# Ensure returnsense is on python path
sys.path.insert(0, os.getcwd())

from app.agent import analyze_returns_for_fraud

if __name__ == "__main__":
    report = analyze_returns_for_fraud("data/sample_returns.csv")
    print("\n" + "#"*40)
    print(" PIPELINE REPORT ")
    print("#"*40)
    print(report)
    print("#"*40)
