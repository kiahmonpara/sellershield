"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AlertsDrawer from "../../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface IntelPayload {
  product_id: string;
  product_name: string;
  fraud: {
    return_rate_pct: number;
    flagged_customers: string[];
    claim_value_inr: number;
  };
  reviews: {
    authenticity_score: number;
    verdict: string;
    displayed_rating: number;
    adjusted_rating: number;
    fake_count: number;
  };
  pricing: {
    price_position: string;
    undercut_by: string | null;
    strategy: string;
    urgency: string;
  };
  overall_risk: "HIGH" | "MEDIUM" | "LOW";
  recommended_actions: string[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [intel, setIntel] = useState<IntelPayload | null>(null);

  const fetchIntel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/product/${id}/intel`);
      if (res.ok) {
        const data = await res.json();
        setIntel(data);
      }
    } catch (err) {
      console.error("Failed to fetch product intelligence:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchIntel();
    }
  }, [id]);

  const mockTrendData = [
    { week: "Wk 1", return_rate: 4.2, authenticity: 98, competitor_gap: 2.1 },
    { week: "Wk 2", return_rate: 6.8, authenticity: 92, competitor_gap: -1.5 },
    { week: "Wk 3", return_rate: 11.2, authenticity: 88, competitor_gap: -3.8 },
    { week: "Wk 4", return_rate: 12.5, authenticity: 86, competitor_gap: -5.2 },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "var(--font-sans)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div className="spinner" style={{ width: "32px", height: "32px", border: "4px solid #ff5c1a", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
          <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Loading Product Intelligence...</span>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!intel || "error" in intel) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "var(--font-sans)" }}>
        <h2>Product Not Found</h2>
        <p style={{ color: "var(--text-secondary)" }}>The requested product ID or details could not be retrieved from the catalog.</p>
        <button onClick={() => window.location.href = "/"} style={{ background: "#ff5c1a", color: "#fff", padding: "10px 20px", border: "none", borderRadius: "8px", cursor: "pointer", marginTop: "16px", fontWeight: "bold" }}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return "#ef4444";
      case "MEDIUM":
        return "#f59e0b";
      default:
        return "#10b981";
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarExpanded ? "expanded" : ""}`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <div className="sidebar-nav-group">
          <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-display)", fontWeight: "800" }}>
            <span>👟</span> {sidebarExpanded ? "Stride Co." : ""}
          </div>
          
          <div style={{ padding: "0.25rem 0.5rem", fontSize: "10px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: "bold" }}>
            {sidebarExpanded ? "Return Fraud" : "Fraud"}
          </div>
          
          <div onClick={() => window.location.href = "/?tab=dashboard"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Overview Dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            <span className="nav-item-label">Overview Dashboard</span>
          </div>

          <div onClick={() => window.location.href = "/?tab=results"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Risk Profiles & Claims">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </button>
            <span className="nav-item-label">Risk Profiles & Claims</span>
          </div>

          <div onClick={() => window.location.href = "/?tab=audit"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Audit Trail">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <span className="nav-item-label">Audit Trail</span>
          </div>

          <div style={{ padding: "0.5rem 0.5rem 0.25rem 0.5rem", fontSize: "10px", textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: "bold", borderTop: "1px solid var(--border-color)", marginTop: "0.5rem" }}>
            {sidebarExpanded ? "Protections & Reports" : "Ops"}
          </div>

          <div onClick={() => window.location.href = "/reviews"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Review Authenticity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <span className="nav-item-label">Review Authenticity</span>
          </div>

          <div onClick={() => window.location.href = "/pricing"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Price Intelligence">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </button>
            <span className="nav-item-label">Price Intelligence</span>
          </div>

          <div onClick={() => window.location.href = "/assistant"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="AI Assistant">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <span className="nav-item-label">AI Assistant</span>
          </div>

          <div onClick={() => window.location.href = "/monitor"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Auto-Monitor">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                <path d="M2 12h20"></path>
              </svg>
            </button>
            <span className="nav-item-label">Auto-Monitor</span>
          </div>

          <div onClick={() => window.location.href = "/report"} className="nav-item-wrapper">
            <button className="nav-icon-btn" title="Executive Report">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </button>
            <span className="nav-item-label">Executive Report</span>
          </div>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">M</div>
          <div className="profile-details">
            <span className="profile-name">Merchant Admin</span>
            <span className="profile-role">admin@sellershield.in</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        
        {/* Header */}
        <header className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "bold", textTransform: "uppercase" }}>
              Catalog / Product Deep-Dive
            </span>
            <h1 style={{ marginTop: "4px" }}>{intel.product_name}</h1>
          </div>
          <div>
            <AlertsDrawer />
          </div>
        </header>

        {/* Product Hero Stats Bar */}
        <div
          className="card-standard"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px",
            background: "var(--bg-accent-light, #fafaf9)",
            marginBottom: "24px",
            gap: "24px"
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>PRODUCT ID</div>
            <strong style={{ fontSize: "16px", color: "var(--text-primary)" }}>{intel.product_id}</strong>
          </div>
          <div style={{ height: "40px", width: "1px", background: "var(--border-color)" }}></div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>OVERALL RISK BADGE</div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: "#fff",
                background: getRiskColor(intel.overall_risk),
                padding: "4px 10px",
                borderRadius: "12px",
                marginTop: "4px",
                display: "inline-block"
              }}
            >
              {intel.overall_risk} RISK
            </span>
          </div>
          <div style={{ height: "40px", width: "1px", background: "var(--border-color)" }}></div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>RATING DEVIATION</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <span style={{ textDecoration: "line-through", color: "var(--text-secondary)", fontSize: "12px" }}>
                {intel.reviews.displayed_rating.toFixed(1)}★
              </span>
              <strong style={{ color: "#ff5c1a", fontSize: "15px" }}>
                {intel.reviews.adjusted_rating.toFixed(1)}★
              </strong>
            </div>
          </div>
        </div>

        {/* Three Module Summary Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginBottom: "24px" }}>
          
          {/* 1. Return Fraud */}
          <div className="card-standard" style={{ padding: "20px" }}>
            <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px", fontWeight: "800", display: "flex", justifyContent: "space-between" }}>
              <span>🚨 Return Fraud</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>100% Protection</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Product Return Rate:</span>
                <strong>{intel.fraud.return_rate_pct}%</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Flagged Fraud Ring Customers:</span>
                <strong>{intel.fraud.flagged_customers.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Est. Revenue Claims Value:</span>
                <strong style={{ color: "#ef4444" }}>{formatCurrency(intel.fraud.claim_value_inr)}</strong>
              </div>
            </div>
          </div>

          {/* 2. Review Authenticity */}
          <div className="card-standard" style={{ padding: "20px" }}>
            <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px", fontWeight: "800", display: "flex", justifyContent: "space-between" }}>
              <span>✍️ Review Authenticity</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>Linguistic Scan</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Authenticity Score:</span>
                <strong style={{ color: intel.reviews.authenticity_score < 80 ? "#f59e0b" : "#10b981" }}>
                  {intel.reviews.authenticity_score}%
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Linguistic Verdict:</span>
                <strong style={{ textTransform: "uppercase" }}>{intel.reviews.verdict}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Flagged Fake Reviews:</span>
                <strong style={{ color: "#d97706" }}>{intel.reviews.fake_count} Flagged</strong>
              </div>
            </div>
          </div>

          {/* 3. Price Competitiveness */}
          <div className="card-standard" style={{ padding: "20px" }}>
            <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px", fontWeight: "800", display: "flex", justifyContent: "space-between" }}>
              <span>📊 Price Competitiveness</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>Buy-Box Watch</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Pricing Position:</span>
                <strong>{intel.pricing.price_position}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Undercutting Competitors:</span>
                <strong style={{ color: intel.pricing.undercut_by ? "#ff5c1a" : "inherit" }}>
                  {intel.pricing.undercut_by || "None Detected"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>Recommended Strategy:</span>
                <strong>{intel.pricing.strategy} ({intel.pricing.urgency})</strong>
              </div>
            </div>
          </div>

        </div>

        {/* Action Plan & Historical Trend */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "24px" }}>
          
          {/* Action Recommendations */}
          <div className="card-standard" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="card-title" style={{ marginBottom: "6px" }}>AI Actionable Recommendations</div>
            {intel.recommended_actions.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>✓ No recommendations needed. Stable status.</div>
            ) : (
              intel.recommended_actions.map((act, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    background: "var(--bg-accent-light, #fafaf9)",
                    borderLeft: "4px solid #ff5c1a",
                    fontSize: "12px",
                    lineHeight: "1.4"
                  }}
                >
                  {act}
                </div>
              ))
            )}
          </div>

          {/* Historical Trend LineChart */}
          <div className="card-standard" style={{ padding: "20px", display: "flex", flexDirection: "column" }}>
            <div className="card-title" style={{ marginBottom: "16px" }}>Performance Trend Matrix (Last 4 Weeks)</div>
            <div style={{ width: "100%", height: "200px" }}>
              <ResponsiveContainer>
                <LineChart data={mockTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" fontSize="10px" />
                  <YAxis fontSize="10px" />
                  <Tooltip />
                  <Line type="monotone" dataKey="return_rate" name="Return Rate %" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="authenticity" name="Authenticity Score" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="competitor_gap" name="Competitor Price Gap %" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
