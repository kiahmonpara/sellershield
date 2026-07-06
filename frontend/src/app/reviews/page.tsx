"use client";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot, BarChart, Bar, Cell } from "recharts";
import AlertsDrawer from "../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function ReviewsPage() {
  const formatUnderscoreText = (text: string) => {
    if (!text) return "";
    return text
      .split(",")
      .map((item) =>
        item
          .trim()
          .split(/[\s_]+/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ")
      )
      .join(", ");
  };

  const [productId, setProductId] = useState<string>("PROD-001");
  const [platform, setPlatform] = useState<string>("Amazon");
  const [reviewsJson, setReviewsJson] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  // API Response States
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [sampleProducts, setSampleProducts] = useState<any[]>([]);
  const [selectedSamplePid, setSelectedSamplePid] = useState<string>("PROD-001");
  const [generatingResponseId, setGeneratingResponseId] = useState<string | null>(null);
  const [aiResponses, setAiResponses] = useState<Record<string, { response_text: string; response_type: string; word_count: number }>>({});

  const handleGenerateResponse = async (review: any) => {
    setGeneratingResponseId(review.review_id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: review.review_id,
          review_text: review.review_text,
          rating: review.rating,
          authenticity_label: review.authenticity_label
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponses(prev => ({
          ...prev,
          [review.review_id]: {
            response_text: data.response_text,
            response_type: data.response_type,
            word_count: data.word_count
          }
        }));
        showToast(`AI Response generated for ${review.review_id}`);
      } else {
        throw new Error("Failed to generate response");
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setGeneratingResponseId(null);
    }
  };

  // Fetch sample review products on mount
  useEffect(() => {
    fetchSampleReviews();
  }, []);

  const fetchSampleReviews = async () => {
    const retries = 5;
    const delay = 2000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reviews/sample`);
        if (res.ok) {
          const data = await res.json();
          setSampleProducts(data);
          break; // success, exit early
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} to fetch sample reviews failed:`, err);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("Failed to fetch sample reviews after maximum retries", err);
        }
      }
    }
  };

  const handleLoadSample = async () => {
    const selectedProd = sampleProducts.find(p => p.product_id === selectedSamplePid);
    if (!selectedProd) {
      showToast("Please load sample data first or select a valid product.");
      return;
    }
    
    setLoading(true);
    setLoadingMessage("Fetching Sample Reviews...");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProd.product_id,
          platform: selectedProd.platform || "Amazon",
          reviews: selectedProd.reviews
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data = await res.json();
      setAnalysisResult(data);
      setProductId(selectedProd.product_id);
      setPlatform(selectedProd.platform || "Amazon");
      setReviewsJson(JSON.stringify(selectedProd.reviews, null, 2));
      showToast("Successfully analyzed reviews for authenticity.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleAnalyseCustom = async () => {
    if (!reviewsJson.trim()) {
      showToast("Please paste review data in JSON format first.");
      return;
    }

    let parsedReviews = [];
    try {
      parsedReviews = JSON.parse(reviewsJson);
      if (!Array.isArray(parsedReviews)) {
        throw new Error("JSON must be an array of reviews");
      }
    } catch (err: any) {
      showToast(`Invalid JSON format: ${err.message}`);
      return;
    }

    setLoading(true);
    setLoadingMessage("Analyzing Review Authenticity...");

    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          platform: platform,
          reviews: parsedReviews
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Analysis failed");
      }

      const data = await res.json();
      setAnalysisResult(data);
      showToast("Successfully analyzed custom reviews.");
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // Process timeline data from reviews
  const getTimelineData = () => {
    if (!analysisResult || !analysisResult.reviews) return [];
    
    // Group reviews by date
    const dateCounts: { [key: string]: number } = {};
    analysisResult.reviews.forEach((r: any) => {
      const d = r.review_date;
      if (d) {
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      }
    });

    // Convert to sorted array
    const sortedDates = Object.keys(dateCounts).sort();
    
    // Identify burst dates
    const burstDates = new Set(
      (analysisResult.burst_windows || []).map((w: any) => w.date)
    );

    return sortedDates.map(date => ({
      date,
      count: dateCounts[date],
      isBurst: burstDates.has(date) ? dateCounts[date] : null
    }));
  };

  const timelineData = getTimelineData();

  // Get signal counts for breakdown chart
  const getSignalBreakdown = () => {
    if (!analysisResult) return [];
    const signals = [
      { name: "Sentiment-Rating Mismatch", count: 0, weight: 30, color: "var(--color-accent-coral)" },
      { name: "Temporal Burst", count: 0, weight: 30, color: "var(--color-accent-coral)" },
      { name: "Generic Praise", count: 0, weight: 25, color: "var(--color-accent-yellow)" },
      { name: "Reviewer Velocity", count: 0, weight: 25, color: "var(--color-accent-yellow)" },
      { name: "Keyword Stuffing", count: 0, weight: 20, color: "var(--color-accent-yellow)" },
      { name: "Zero Helpful Votes Cluster", count: 0, weight: 15, color: "var(--text-secondary)" },
      { name: "Single-Product Reviewer", count: 0, weight: 10, color: "var(--text-secondary)" },
      { name: "Suspiciously Short 5*", count: 0, weight: 10, color: "var(--text-secondary)" }
    ];

    analysisResult.reviews.forEach((r: any) => {
      r.signals_triggered.forEach((sig: string) => {
        if (sig === "sentiment_mismatch") signals[0].count++;
        if (sig === "generic_praise") signals[2].count++;
        if (sig === "keyword_stuffing") signals[4].count++;
        if (sig === "suspiciously_short") signals[7].count++;
      });
    });

    if (analysisResult.network_signals.includes("temporal_burst")) signals[1].count = 1;
    if (analysisResult.network_signals.includes("reviewer_velocity")) signals[3].count = 1;
    if (analysisResult.network_signals.includes("zero_helpful_votes_cluster")) signals[5].count = 1;
    if (analysisResult.network_signals.includes("single_product_reviewers")) signals[6].count = 1;

    return signals.filter(s => s.count > 0);
  };

  const signalBreakdown = getSignalBreakdown();

  // Sort reviews: FAKE/SUSPICIOUS first (fake_score desc)
  const getSortedReviews = () => {
    if (!analysisResult || !analysisResult.reviews) return [];
    return [...analysisResult.reviews].sort((a, b) => b.fake_score - a.fake_score);
  };

  const sortedReviews = getSortedReviews();

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

          <div onClick={() => window.location.href = "/reviews"} className="nav-item-wrapper active">
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

      {/* Main Panel */}
      <div className="main-content">
        {/* Header */}
        <header className="dashboard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>⭐</span> Review Authenticity Scorer
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>Stride Co. Review Safeguard Protection Pipeline</p>
          </div>
          <div>
            <AlertsDrawer />
          </div>
        </header>

        {loading && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ maxWidth: "320px", textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Running Analysis</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{loadingMessage}</div>
            </div>
          </div>
        )}

        {/* Section A: Input */}
        <div className="card-standard">
          <div className="card-title">Ingest & Audit Product Reviews</div>
          <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Select Sample Footwear Product</label>
              <select 
                value={selectedSamplePid}
                onChange={(e) => setSelectedSamplePid(e.target.value)}
                style={{ width: "100%", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "10px", fontSize: "13px", background: "#fff" }}
              >
                {sampleProducts.map(p => (
                  <option key={p.product_id} value={p.product_id}>{p.product_title} ({p.product_id})</option>
                ))}
              </select>
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <button onClick={handleLoadSample} className="btn-action-primary">
                Load & Scrutinize Sample Product
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "20px" }}>
            <label style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Or Paste Custom Reviews JSON Payload</label>
            <textarea
              value={reviewsJson}
              onChange={(e) => setReviewsJson(e.target.value)}
              placeholder='[{"review_id": "REV-001", "rating": 5, "review_text": "great shoes", "reviewer_id": "USR-1"}]'
              rows={4}
              style={{ width: "100%", padding: "16px", border: "1px solid var(--border-color)", borderRadius: "12px", fontSize: "12px", fontFamily: "monospace", resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <input 
                  type="text" 
                  placeholder="Product ID" 
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}
                />
                <select 
                  value={platform} 
                  onChange={(e) => setPlatform(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px", background: "#fff" }}
                >
                  <option>Amazon</option>
                  <option>Flipkart</option>
                  <option>Myntra</option>
                  <option>Meesho</option>
                </select>
              </div>
              <button onClick={handleAnalyseCustom} className="btn-action-secondary">
                Analyse Custom Reviews
              </button>
            </div>
          </div>
        </div>

        {analysisResult && (
          <>
            {/* Section B: Verdict Banner */}
            <div className="dashboard-grid-top">
              <div className="card-warm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Overall Product Verdict</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                    <span 
                      className="status-badge"
                      style={{
                        background: analysisResult.verdict === "TRUSTWORTHY" ? "#dcfce7" : analysisResult.verdict === "SUSPICIOUS" ? "#fef3c7" : "#fee2e2",
                        color: analysisResult.verdict === "TRUSTWORTHY" ? "#10b981" : analysisResult.verdict === "SUSPICIOUS" ? "#d97706" : "#ef4444",
                        fontSize: "18px",
                        fontWeight: "800",
                        padding: "6px 16px",
                        borderRadius: "12px"
                      }}
                    >
                      {analysisResult.verdict}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "24px", marginTop: "20px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Displayed Rating</div>
                      <div style={{ fontSize: "20px", fontWeight: "700" }}>⭐ {analysisResult.displayed_rating}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Adjusted Rating</div>
                      <div style={{ fontSize: "20px", fontWeight: "700", color: analysisResult.adjusted_rating < analysisResult.displayed_rating ? "#ef4444" : "inherit" }}>
                        ⭐ {analysisResult.adjusted_rating}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div className="gauge-container" style={{ width: "120px", height: "120px", marginTop: 0, position: "relative" }}>
                    <svg className="gauge-svg">
                      <circle className="gauge-bg" cx="60" cy="60" r="48" />
                      <circle 
                        className="gauge-fill" 
                        cx="60" 
                        cy="60" 
                        r="48" 
                        style={{ 
                          strokeDasharray: "301.6",
                          strokeDashoffset: 301.6 - (301.6 * analysisResult.overall_authenticity_score) / 100,
                          stroke: analysisResult.verdict === "TRUSTWORTHY" ? "#10b981" : analysisResult.verdict === "SUSPICIOUS" ? "#f9bf29" : "#ea6556"
                        }} 
                      />
                    </svg>
                    <span className="gauge-center-text" style={{ fontSize: "20px", fontWeight: "800", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                      {analysisResult.overall_authenticity_score}%
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)", marginTop: "4px" }}>Authenticity</span>
                </div>
              </div>

              <div className="card-dark">
                <div className="card-title" style={{ color: "#fff" }}>Key Manipulative Evidence</div>
                {analysisResult.top_3_evidence && analysisResult.top_3_evidence.length > 0 ? (
                  <ul style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "10px 0" }}>
                    {analysisResult.top_3_evidence.map((ev: string, i: number) => (
                      <li key={i} style={{ fontSize: "12px", color: "var(--color-accent-yellow)", display: "flex", gap: "8px" }}>
                        <span>⚠️</span> {ev}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>No significant review manipulation patterns detected.</p>
                )}
                <div style={{ display: "flex", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px", marginTop: "16px", fontSize: "12px" }}>
                  <div><strong>Genuine Reviews:</strong> {analysisResult.genuine_review_count}</div>
                  <div><strong>Fake Flagged:</strong> {analysisResult.fake_review_count}</div>
                </div>
              </div>
            </div>

            {/* Section C & D: Signal Breakdown & Review Timeline */}
            <div className="dashboard-grid-bottom">
              {/* Breakdown */}
              <div className="card-standard">
                <div className="card-title">Triggered Spam Signals</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {signalBreakdown.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic" }}>No signals triggered.</p>
                  ) : (
                    signalBreakdown.map((s, idx) => (
                      <div key={idx}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                          <span>{s.name}</span>
                          <strong>+{s.weight} pts</strong>
                        </div>
                        <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px" }}>
                          <div style={{ width: `${(s.weight / 30) * 100}%`, height: "100%", background: s.color, borderRadius: "3px" }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Timeline Chart */}
              <div className="card-standard">
                <div className="card-title">Review Volume & Bursts Timeline</div>
                <div style={{ width: "100%", height: "200px" }}>
                  {timelineData.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No timeline data available.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" style={{ fontSize: "10px" }} />
                        <YAxis style={{ fontSize: "10px" }} allowDecimals={false} />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2.5} activeDot={{ r: 6 }} />
                        {timelineData.map((d, idx) => d.isBurst ? (
                          <ReferenceDot key={idx} x={d.date} y={d.count} r={6} fill="var(--color-accent-coral)" stroke="none" />
                        ) : null)}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* BRAND REVIEWS INTELLIGENCE ROW */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.75rem", width: "100%", marginTop: "1rem", marginBottom: "1rem" }}>
              
              {/* Competitor Benchmarking BarChart */}
              <div className="card-standard" style={{ minHeight: "300px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="card-title">Competitor Review Benchmarking</div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                    Comparison of Stride Co. review authenticity against footwear market rivals.
                  </p>
                </div>
                <div style={{ width: "100%", height: "200px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Stride Co.", authenticity: analysisResult.overall_authenticity_score, fill: "var(--color-accent-coral)" },
                      { name: "SpeedStep", authenticity: 54, fill: "var(--text-tertiary)" },
                      { name: "RunRight", authenticity: 48, fill: "var(--text-tertiary)" },
                      { name: "FlexFoot", authenticity: 32, fill: "var(--text-tertiary)" },
                    ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" style={{ fontSize: "10px" }} />
                      <YAxis style={{ fontSize: "10px" }} domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}% Authentic`, "Authenticity"]} />
                      <Bar dataKey="authenticity" radius={[6, 6, 0, 0]}>
                        {[
                          { fill: "var(--color-accent-coral)" },
                          { fill: "var(--bg-card-warm)" },
                          { fill: "var(--bg-card-warm)" },
                          { fill: "var(--bg-card-warm)" }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? "var(--color-accent-coral)" : "#a1a1a6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Review Sentiment Word Cloud */}
              <div className="card-standard" style={{ minHeight: "300px" }}>
                <div className="card-title">Review Sentiment Word Cloud</div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Genuine sentiment expressions (green) versus identified abuse signals (red).
                </p>
                <div className="word-cloud-container">
                  <span className="word-cloud-item-genuine" style={{ fontSize: "18px" }}>Premium Quality</span>
                  <span className="word-cloud-item-suspicious" style={{ fontSize: "14px" }}>Duplicate Text</span>
                  <span className="word-cloud-item-genuine" style={{ fontSize: "13px" }}>Comfortable</span>
                  <span className="word-cloud-item-suspicious" style={{ fontSize: "16px" }}>Burst Reviews</span>
                  <span className="word-cloud-item-genuine" style={{ fontSize: "15px" }}>Elite Cushioning</span>
                  <span className="word-cloud-item-suspicious" style={{ fontSize: "12px" }}>Wrong Size</span>
                  <span className="word-cloud-item-genuine" style={{ fontSize: "14px" }}>Original Fit</span>
                  <span className="word-cloud-item-suspicious" style={{ fontSize: "15px" }}>Broken Stitch</span>
                  <span className="word-cloud-item-genuine" style={{ fontSize: "12px" }}>Fast Delivery</span>
                  <span className="word-cloud-item-suspicious" style={{ fontSize: "13px" }}>Bad Odour</span>
                  <span className="word-cloud-item-genuine" style={{ fontSize: "16px" }}>Worth Pricing</span>
                </div>
              </div>
            </div>

            {/* SUSPICIOUS REVIEWERS & IMPACT CALCULATOR ROW */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.75rem", width: "100%", marginBottom: "1.5rem" }}>
              
              {/* Suspicious Reviewers Cards */}
              <div className="card-standard">
                <div className="card-title">Suspicious Reviewer Profiles</div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Top reviewer accounts flagged for review velocity bursts or duplicate text templates.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { name: "Rakesh M. (Delhi)", ratings: 3, prob: 100, trigger: "Burst velocity pattern detected" },
                    { name: "Amit K. (Mumbai)", ratings: 5, prob: 92, trigger: "Identical review text cross-posted" },
                    { name: "Priya S. (Bangalore)", ratings: 2, prob: 88, trigger: "Account age less than 24 hours" }
                  ].map((rev, idx) => (
                    <div key={idx} className="threat-pulsing" style={{ padding: "10px 14px", borderRadius: "12px", background: "var(--bg-hover)", borderLeft: "4px solid var(--color-accent-coral)", borderTop: "none", borderRight: "none", borderBottom: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700" }}>{rev.name}</span>
                        <span style={{ fontSize: "10px", background: "rgba(255, 92, 26, 0.1)", color: "var(--color-accent-coral)", padding: "2px 8px", borderRadius: "8px", fontWeight: "bold" }}>
                          {rev.prob}% Fake Prob
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                        <strong>Trigger:</strong> {rev.trigger}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review Impact Calculator */}
              <div className="card-standard" style={{ borderLeft: "4px solid var(--color-accent-coral)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="card-title">Review Impact Calculator</div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                    Projected performance recovery after removing flagged suspicious reviews.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Rating Recovery:</span>
                    <strong style={{ color: "#10b981" }}>⭐ {analysisResult.displayed_rating} ➔ ⭐ {analysisResult.adjusted_rating} ({ (analysisResult.adjusted_rating - analysisResult.displayed_rating) >= 0 ? "+" : "" }{ (analysisResult.adjusted_rating - analysisResult.displayed_rating).toFixed(1) })</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Buy-Box Position:</span>
                    <strong style={{ color: "#10b981" }}>Restored to Rank #1</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Est. Monthly Revenue Gain:</span>
                    <strong style={{ color: "#10b981" }}>₹75,000 - ₹1,20,000</strong>
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4", background: "var(--bg-hover)", padding: "10px", borderRadius: "8px" }}>
                  ℹ️ Removing competitor attack reviews directly improves buy-box preference by 18-24% on Amazon/Flipkart algorithms.
                </div>
              </div>
            </div>

            {/* Section E: Review Cards */}
            <div className="card-standard">
              <div className="card-title">Scored Review Inventory</div>
              <div className="habits-list">
                {sortedReviews.map((r: any) => {
                  const isFake = r.authenticity_label === "FAKE";
                  const isSuspicious = r.authenticity_label === "SUSPICIOUS";
                  
                  return (
                    <div key={r.review_id} className="habit-item" style={{ gridTemplateColumns: "80px 1.5fr 1fr 1fr 100px", padding: "1.5rem" }}>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "11px" }}>{r.review_id}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{r.review_date}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "500", marginBottom: "4px" }}>{r.review_text}</div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Rating:</span>
                          <span style={{ fontWeight: "bold", fontSize: "11px" }}>{"⭐".repeat(r.rating)} ({r.rating}/5)</span>
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Reviewer Metrics</div>
                        <div style={{ fontSize: "11px" }}>Verified: {r.verified_purchase ? "Yes" : "No"}</div>
                        <div style={{ fontSize: "11px" }}>Total Reviews: {r.reviewer_review_count}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Triggered Flags</div>
                        {r.signals_triggered.length === 0 ? (
                          <span style={{ fontSize: "11px", color: "#10b981" }}>None</span>
                        ) : (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                            {r.signals_triggered.map((sig: string, i: number) => (
                              <span key={i} style={{ fontSize: "8.5px", background: "var(--bg-app-inner)", padding: "2px 6px", borderRadius: "4px", color: "var(--color-accent-coral)" }}>
                                {formatUnderscoreText(sig)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span 
                          className="status-badge"
                          style={{
                            background: isFake ? "#fee2e2" : isSuspicious ? "#fef3c7" : "#dcfce7",
                            color: isFake ? "#ef4444" : isSuspicious ? "#d97706" : "#10b981",
                            fontSize: "11px",
                            fontWeight: "700"
                          }}
                        >
                          {r.authenticity_label} ({r.fake_score}%)
                        </span>
                      </div>

                      {/* AI Response Generator */}
                      <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--border-color)", paddingTop: "12px", marginTop: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Stride Co. AI Response Generator:</span>
                          <button
                            onClick={() => handleGenerateResponse(r)}
                            disabled={generatingResponseId === r.review_id}
                            style={{
                              background: "#ff5c1a",
                              color: "#fff",
                              border: "none",
                              padding: "4px 12px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              cursor: "pointer"
                            }}
                          >
                            {generatingResponseId === r.review_id ? "Generating..." : "Generate AI Response"}
                          </button>
                        </div>
                        {aiResponses[r.review_id] && (
                          <div style={{ marginTop: "8px", background: "var(--bg-accent-light, #fafaf9)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                              <span>Response Type: <strong style={{ color: "#ff5c1a" }}>{aiResponses[r.review_id].response_type}</strong></span>
                              <span>Word count: {aiResponses[r.review_id].word_count}</span>
                            </div>
                            <textarea
                              value={aiResponses[r.review_id].response_text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAiResponses(prev => ({
                                  ...prev,
                                  [r.review_id]: { ...prev[r.review_id], response_text: val }
                                }));
                              }}
                              style={{
                                width: "100%",
                                height: "60px",
                                fontSize: "11.5px",
                                border: "1px solid var(--border-color)",
                                borderRadius: "6px",
                                padding: "8px",
                                resize: "none",
                                fontFamily: "inherit"
                              }}
                            />
                            <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end" }}>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(aiResponses[r.review_id].response_text);
                                  showToast("Response copied to clipboard!");
                                }}
                                style={{ background: "none", border: "1px solid #ff5c1a", color: "#ff5c1a", padding: "4px 12px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                              >
                                Copy Response
                              </button>
                              <button
                                onClick={() => handleGenerateResponse(r)}
                                style={{ background: "none", border: "1px solid var(--text-secondary)", color: "var(--text-secondary)", padding: "4px 12px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                              >
                                Regenerate
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
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
