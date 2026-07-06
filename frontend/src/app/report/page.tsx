"use client";

import React, { useState, useEffect } from "react";
import AlertsDrawer from "../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ActionItem {
  module: string;
  severity: string;
  description: string;
}

interface ReportData {
  run_id: string;
  brand_health_score: number;
  revenue_at_risk: number;
  fraud_summary: {
    total_returns: number;
    flagged_customers: number;
    claims_ready: number;
  };
  review_summary: {
    total_reviews_analysed: number;
    fake_reviews_flagged: number;
    average_authenticity: number;
  };
  pricing_summary: {
    total_products: number;
    being_undercut: number;
    active_price_wars: number;
  };
  action_items: ActionItem[];
}

export default function ReportPage() {
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setLoadingMessage("Compiling data across protection modules...");
    try {
      const res = await fetch(`${API_BASE_URL}/api/report/generate`);
      if (!res.ok) {
        throw new Error("Failed to compile executive report.");
      }
      const data = await res.json();
      setReport(data);
      showToast("Executive Report compiled successfully.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
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
          
          <div
            onClick={() => window.location.href = "/?tab=dashboard"}
            className="nav-item-wrapper"
          >
            <button className="nav-icon-btn" title="Overview Dashboard">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            <span className="nav-item-label">Overview Dashboard</span>
          </div>

          <div
            onClick={() => window.location.href = "/?tab=results"}
            className="nav-item-wrapper"
          >
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

          <div
            onClick={() => window.location.href = "/?tab=audit"}
            className="nav-item-wrapper"
          >
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

          <div
            onClick={() => window.location.href = "/reviews"}
            className="nav-item-wrapper"
          >
            <button className="nav-icon-btn" title="Review Authenticity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <span className="nav-item-label">Review Authenticity</span>
          </div>

          <div
            onClick={() => window.location.href = "/pricing"}
            className="nav-item-wrapper"
          >
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

          <div
            onClick={() => window.location.href = "/report"}
            className="nav-item-wrapper active"
          >
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

      {/* Main Panel */}
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>📑</span> Executive Intelligence Report
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
              Stride Co. Unified Protection Audit Summary & Strategic Action Items
            </p>
          </div>
          
          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <AlertsDrawer />
            <button onClick={handleGenerateReport} className="btn-upgrade">
              Compile Report
            </button>
            {report && (
              <button onClick={handlePrint} className="btn-upgrade" style={{ background: "var(--color-primary)", color: "#ffffff" }}>
                Print / Export PDF
              </button>
            )}
          </div>
        </header>

        {loading && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ maxWidth: "320px", textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Generating Executive Report</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{loadingMessage}</div>
            </div>
          </div>
        )}

        {!report ? (
          <div className="card-standard" style={{ textAlign: "center", padding: "80px 24px" }}>
            <span style={{ fontSize: "48px" }}>📊</span>
            <h3 className="card-title" style={{ marginTop: "16px" }}>No Compiled Report Available</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", maxWidth: "480px", margin: "10px auto 24px auto", lineHeight: "1.5" }}>
              Analyze performance across Return Fraud, Review Authenticity, and Price Intelligence models, compiling a unified executive action sheet.
            </p>
            <button onClick={handleGenerateReport} className="btn-action-primary" style={{ width: "fit-content", padding: "10px 24px" }}>
              Compile & Audit Now
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Top Stats Overview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.75rem", width: "100%" }}>
              
              {/* Brand Health score Gauge */}
              <div className="card-warm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.5rem" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Brand Health Index</span>
                  <div style={{ fontSize: "36px", fontWeight: "800", color: "var(--text-primary)", marginTop: "8px" }}>
                    {report.brand_health_score}%
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 8px", background: "#dcfce7", color: "#10b981", borderRadius: "12px", fontWeight: "bold" }}>HEALTHY</span>
                  </div>
                </div>
                <div className="gauge-container" style={{ width: "110px", height: "110px", flexShrink: 0, marginTop: 0 }}>
                  <svg className="gauge-svg">
                    <circle className="gauge-bg" cx="55" cy="55" r="44" />
                    <circle 
                      className="gauge-fill" 
                      cx="55" 
                      cy="55" 
                      r="44" 
                      style={{ 
                        strokeDasharray: "276.4",
                        strokeDashoffset: 276.4 - (276.4 * report.brand_health_score) / 100,
                        stroke: "#10b981"
                      }} 
                    />
                  </svg>
                  <span className="gauge-center-text" style={{ fontSize: "16px", fontWeight: "800", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>{report.brand_health_score}%</span>
                </div>
              </div>

              {/* Total Revenue at Risk */}
              <div className="card-standard" style={{ borderLeft: "4px solid var(--color-accent-coral)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1.5rem" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Revenue at Risk</span>
                  <div style={{ fontSize: "36px", fontWeight: "800", color: "var(--color-accent-coral)", marginTop: "8px" }}>
                    ₹{report.revenue_at_risk.toLocaleString()}
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.4" }}>
                    Total estimated merchant exposure to marketplace return swap fraud and lost buy-box conversions.
                  </p>
                </div>
              </div>

            </div>

            {/* Component Summary Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", width: "100%" }}>
              
              {/* Return Fraud widget */}
              <div className="card-standard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "700", fontSize: "14px" }}>👟 Return Fraud Protection</span>
                  <span style={{ fontSize: "9px", background: "rgba(255, 92, 26, 0.1)", color: "var(--color-accent-coral)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>ACTIVE</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total returns analysed:</span>
                    <strong>{report.fraud_summary.total_returns}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Flagged suspect accounts:</span>
                    <strong style={{ color: "var(--color-accent-coral)" }}>{report.fraud_summary.flagged_customers}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>SPF/SAFE-T claims ready:</span>
                    <strong>{report.fraud_summary.claims_ready}</strong>
                  </div>
                </div>
              </div>

              {/* Review Authenticity widget */}
              <div className="card-standard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "700", fontSize: "14px" }}>⭐ Review Authenticity</span>
                  <span style={{ fontSize: "9px", background: "rgba(255, 92, 26, 0.1)", color: "var(--color-accent-coral)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>ACTIVE</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total reviews analysed:</span>
                    <strong>{report.review_summary.total_reviews_analysed}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Fake competitor ratings:</span>
                    <strong style={{ color: "var(--color-accent-coral)" }}>{report.review_summary.fake_reviews_flagged}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Average authenticity:</span>
                    <strong>{report.review_summary.average_authenticity}%</strong>
                  </div>
                </div>
              </div>

              {/* Price Intelligence widget */}
              <div className="card-standard">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "700", fontSize: "14px" }}>📉 Price Intelligence</span>
                  <span style={{ fontSize: "9px", background: "rgba(255, 92, 26, 0.1)", color: "var(--color-accent-coral)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>ACTIVE</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Audited catalog size:</span>
                    <strong>{report.pricing_summary.total_products} items</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Products undercut:</span>
                    <strong style={{ color: "var(--color-accent-coral)" }}>{report.pricing_summary.being_undercut}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Active price wars:</span>
                    <strong>{report.pricing_summary.active_price_wars}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Strategic Action Ledger */}
            <div className="card-standard">
              <div className="card-title">Strategic Action Ledger</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "16px" }}>
                Prioritized recommendations based on compiled audit results. Follow steps to restore Stride Co. buy-box preference.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {report.action_items.map((item, idx) => {
                  const isHigh = item.severity === "HIGH";
                  const isMed = item.severity === "MEDIUM";
                  
                  return (
                    <div 
                      key={idx}
                      className="threat-pulsing"
                      style={{ 
                        padding: "16px", 
                        borderRadius: "12px", 
                        background: "var(--bg-hover)", 
                        borderLeft: `5px solid ${isHigh ? "var(--color-accent-coral)" : isMed ? "var(--color-accent-yellow)" : "var(--text-tertiary)"}`,
                        borderTop: "none",
                        borderRight: "none",
                        borderBottom: "none"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "700", fontSize: "13.5px", color: "var(--text-primary)" }}>{item.module}</span>
                        <span style={{ 
                          fontSize: "10px", 
                          padding: "2px 8px", 
                          borderRadius: "6px", 
                          fontWeight: "bold",
                          background: isHigh ? "rgba(255, 92, 26, 0.1)" : isMed ? "#fef3c7" : "#f3f4f6",
                          color: isHigh ? "var(--color-accent-coral)" : isMed ? "#d97706" : "var(--text-secondary)"
                        }}>
                          {item.severity} PRIORITY
                        </span>
                      </div>
                      <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "8px", lineHeight: "1.5" }}>
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Report Metadata footer */}
            <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)", marginTop: "12px" }}>
              Compiled dynamically via StrategyAgent • Run ID: {report.run_id} • Stride Co. Unified protection engine callback.
            </div>

          </div>
        )}

      </div>
      
      {toast.visible && (
        <div className="toast-container">
          <div className="toast-alert">
            <span>🔔</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
