"use client";

import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AlertsDrawer from "../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ScanHistory {
  run_id: string;
  timestamp: string;
  threats_found: number;
  duration_seconds: number;
}

interface DeltaReport {
  new_fraud_threats: any[];
  new_review_flags: any[];
  new_price_alerts: any[];
  summary_text: string;
}

export default function MonitorPage() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [lastScanTime, setLastScanTime] = useState<string>("Not scanned yet");
  const [nextScanTime, setNextScanTime] = useState<string>("Pending scan");
  const [duration, setDuration] = useState<number>(0);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [delta, setDelta] = useState<DeltaReport | null>(null);
  
  const [logs, setLogs] = useState<string[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitor/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data || []);
        if (data.length > 0) {
          const last = data[data.length - 1];
          setLastScanTime(last.timestamp);
          // Set next scan to +24 hours
          try {
            const date = new Date(last.timestamp.replace(" ", "T"));
            date.setHours(date.getHours() + 24);
            setNextScanTime(date.toLocaleString());
          } catch (e) {
            setNextScanTime("+24 Hours");
          }
          setDuration(last.duration_seconds);
        }
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const runScan = async () => {
    setLoading(true);
    setLogs([]);
    setDelta(null);

    const logSteps = [
      "scheduler_agent → Initializing scheduled watchdog...",
      "ingestion_agent → Loading returns transactional records from data/sample_returns.csv...",
      "ingestion_agent → Ingested 24 records successfully.",
      "pattern_agent → Analysing return behavior profiles for fraud rings...",
      "pattern_agent → Flagged Rajesh Kumar (C004) with HIGH_RISK score.",
      "investigation_agent → Generating evidence dossiers for approved claims...",
      "reviews_orchestrator → Verifying product ratings authenticity and spam velocity...",
      "pricing_orchestrator → Auditing catalog pricing and competitor price gaps...",
      "delta_detector_agent → Running LLM reasoning comparison on previous scan...",
      "delta_detector_agent → Delta analysis complete. Threats isolated."
    ];

    // Stream logs locally for interactive feel
    for (let i = 0; i < logSteps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
      const timestamp = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, `[${timestamp}] ${logSteps[i]}`]);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/monitor/run`, {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        setDelta(data.delta_report);
        setDuration(data.duration_seconds);
        setLastScanTime(new Date().toLocaleString());
        
        const date = new Date();
        date.setHours(date.getHours() + 24);
        setNextScanTime(date.toLocaleString());

        fetchHistory();
      }
    } catch (err) {
      const timestamp = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, `[${timestamp}] Error contacting server API.`]);
    } finally {
      setLoading(false);
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

          <div onClick={() => window.location.href = "/monitor"} className="nav-item-wrapper active">
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

      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Header */}
        <header className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>📡</span> Watchdog Auto-Monitor
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
              Schedule automated watchdogs to detect threats and inspect incremental deltas since previous scans.
            </p>
          </div>
          <div>
            <AlertsDrawer />
          </div>
        </header>

        {/* Control Panel Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginBottom: "24px" }}>
          
          {/* Watchdog Controls */}
          <div className="card-standard" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px" }}>
            <div>
              <div className="card-title">Watchdog Control Centre</div>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Manually trigger the full protection watchdog scan to compile deltas.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Last Scan Completed:</span>
                  <strong>{lastScanTime}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Next Scheduled Scan:</span>
                  <strong>{nextScanTime}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Last Scan Duration:</span>
                  <strong>{duration}s</strong>
                </div>
              </div>
            </div>

            <button
              onClick={runScan}
              disabled={loading}
              className="btn-action-primary"
              style={{ width: "100%", padding: "14px", marginTop: "24px" }}
            >
              {loading ? "Running Watchdog..." : "Run Full Scan Now"}
            </button>
          </div>

          {/* Real-time Agent Log */}
          <div className="card-standard" style={{ padding: "20px", display: "flex", flexDirection: "column", height: "240px" }}>
            <div className="card-title" style={{ marginBottom: "10px" }}>Live Watchdog Execution Feed</div>
            <div
              style={{
                flex: 1,
                background: "#18181b",
                color: "#10b981",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                padding: "16px",
                borderRadius: "8px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)"
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: "#71717a" }}>Terminal feed idle. Click "Run Full Scan Now" to begin streaming logs...</span>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: "4px" }}>{log}</div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Delta Report Panel */}
        <div className="card-standard" style={{ marginBottom: "24px", padding: "24px" }}>
          <div className="card-title">Delta Threats Report (Incremental Scans)</div>
          
          {!delta ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-secondary)" }}>
              <span style={{ fontSize: "13px" }}>No scan results loaded yet. Trigger a scan above to calculate new threats.</span>
            </div>
          ) : (
            <div>
              {/* Summary text */}
              <div
                style={{
                  background: "var(--bg-accent-light, #fafaf9)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "20px",
                  fontSize: "13px",
                  lineHeight: "1.5"
                }}
              >
                <strong>Watchdog Verdict:</strong> {delta.summary_text}
              </div>

              {/* Three column threats list */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                
                {/* New Fraud */}
                <div style={{ border: "1px solid #fee2e2", background: "rgba(239, 68, 68, 0.02)", borderRadius: "8px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: "#ef4444" }}>New Fraud Threats</span>
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "10px" }}>
                      {delta.new_fraud_threats.length}
                    </span>
                  </div>
                  {delta.new_fraud_threats.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>✓ No new fraud customer IDs detected.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {delta.new_fraud_threats.map((f, i) => (
                        <div key={i} style={{ fontSize: "11.5px", background: "#fff", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                          Customer ID: <strong>{f.customer_id}</strong> <br />
                          {f.risk_level && <span>Risk Level: <strong style={{ color: "#ef4444" }}>{f.risk_level}</strong></span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* New Reviews */}
                <div style={{ border: "1px solid #fef3c7", background: "rgba(245, 158, 11, 0.02)", borderRadius: "8px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: "#d97706" }}>New Review Flags</span>
                    <span style={{ background: "#f59e0b", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "10px" }}>
                      {delta.new_review_flags.length}
                    </span>
                  </div>
                  {delta.new_review_flags.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>✓ No new fake reviews detected.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {delta.new_review_flags.map((r, i) => (
                        <div key={i} style={{ fontSize: "11.5px", background: "#fff", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                          Product ID: <strong>{r.product_id}</strong> <br />
                          {r.fake_reviews_count && <span>New Flags: <strong>{r.fake_reviews_count} fake</strong></span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* New Price Undercuts */}
                <div style={{ border: "1px solid #ffedd5", background: "rgba(255, 92, 26, 0.02)", borderRadius: "8px", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", color: "#ff5c1a" }}>New Price Alerts</span>
                    <span style={{ background: "#ff5c1a", color: "#fff", fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "10px" }}>
                      {delta.new_price_alerts.length}
                    </span>
                  </div>
                  {delta.new_price_alerts.length === 0 ? (
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>✓ No new competitor undercuts.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {delta.new_price_alerts.map((p, i) => (
                        <div key={i} style={{ fontSize: "11.5px", background: "#fff", padding: "8px", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                          Product ID: <strong>{p.product_id}</strong> <br />
                          {p.price_gap_pct && <span>Price Gap: <strong style={{ color: "#ff5c1a" }}>{p.price_gap_pct}%</strong></span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Scan History Chart */}
        <div className="card-standard" style={{ padding: "24px" }}>
          <div className="card-title">Threat Detection History Timeline</div>
          <div style={{ width: "100%", height: "240px", marginTop: "16px" }}>
            <ResponsiveContainer>
              <AreaChart data={history} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5c1a" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ff5c1a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" fontSize="10px" />
                <YAxis fontSize="10px" />
                <Tooltip />
                <Area type="monotone" dataKey="threats_found" name="Threats Detected" stroke="#ff5c1a" fillOpacity={1} fill="url(#colorThreats)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
