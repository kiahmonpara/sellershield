"use client";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import AlertsDrawer from "../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface CompetitorPrice {
  competitor_name: string;
  price_inr: number;
}

interface ProductRecord {
  product_id: string;
  name: string;
  category: string;
  seller_price_inr: number;
  platform: string;
  competitors: CompetitorPrice[];
  monitor_events: string[];
  analysis: {
    price_position: string;
    price_gap_inr: number;
    price_gap_pct: number;
    undercutting_detected: boolean;
    undercutting_competitor: string | null;
    price_war_active: boolean;
    psychological_threshold: boolean;
  };
  strategy: {
    recommended_price_inr: number;
    strategy: string;
    urgency: string;
    rationale: string;
    estimated_margin_impact: number;
  };
}

export default function PricingPage() {
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

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  
  // API Response States
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  // Simulation Tool States
  const [simProductId, setSimProductId] = useState<string>("PROD-001");
  const [simPrice, setSimPrice] = useState<number>(2499);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  // Load sample prices on load
  useEffect(() => {
    fetchPriceHistory();
  }, []);

  const fetchPriceHistory = async () => {
    const retries = 5;
    const delay = 2000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/pricing/history`);
        if (res.ok) {
          const data = await res.json();
          setHistoricalData(data);
          break; // success, exit early
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} to fetch price history failed:`, err);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("Failed to fetch price history after maximum retries", err);
        }
      }
    }
  };

  const handleLoadSample = async () => {
    setLoading(true);
    setLoadingMessage("Fetching Footwear Catalog...");
    try {
      // 1. Fetch products
      const pRes = await fetch(`${API_BASE_URL}/api/pricing/sample`);
      if (!pRes.ok) throw new Error("Could not fetch sample products");
      const sampleProds = await pRes.json();

      // 2. Run pricing analysis
      const aRes = await fetch(`${API_BASE_URL}/api/pricing/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: sampleProds })
      });
      if (!aRes.ok) throw new Error("Repricing analysis failed");
      const analysisResult = await aRes.json();

      setProducts(analysisResult.products || []);
      if (analysisResult.products && analysisResult.products.length > 0) {
        setSelectedProductId(analysisResult.products[0].product_id);
        setSimProductId(analysisResult.products[0].product_id);
        setSimPrice(analysisResult.products[0].seller_price_inr);
      }
      
      // Refresh history log
      fetchPriceHistory();
      showToast("Successfully loaded and analyzed Stride Co. catalog.");
    } catch (err: any) {
      showToast(`Error loading price intelligence catalog: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleSimulatePrice = async () => {
    if (!simProductId) {
      showToast("Please select a product to simulate.");
      return;
    }
    
    setLoading(true);
    setLoadingMessage("Simulating pricing scenario...");
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/pricing/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: simProductId,
          hypothetical_price: Number(simPrice)
        })
      });
      
      if (!res.ok) {
        throw new Error("Simulation endpoint returned an error");
      }
      
      const data = await res.json();
      setSimResult(data);
      showToast("Pricing scenario simulation completed successfully.");
    } catch (err: any) {
      showToast(`Simulation failed: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // Compute portfolio counts
  const totalProducts = products.length;
  const beingUndercutCount = products.filter(p => p.analysis.undercutting_detected).length;
  const priceWarsCount = products.filter(p => p.analysis.price_war_active).length;
  const actNowCount = products.filter(p => p.strategy.urgency === "ACT_NOW").length;

  // Scatter plot data formatting
  const getScatterData = () => {
    return products.map(p => ({
      name: p.name,
      x: p.seller_price_inr,
      y: p.analysis.price_gap_pct,
      urgency: p.strategy.urgency,
      recommended: p.strategy.recommended_price_inr
    }));
  };

  // Price history chart data for selected product
  const getSelectedProductHistory = () => {
    if (!selectedProductId || historicalData.length === 0) return [];
    
    return historicalData.map(scan => {
      const pRecord = scan.products.find((prod: any) => prod.product_id === selectedProductId);
      if (!pRecord) return null;
      
      const entry: any = { date: scan.scan_date, Seller: pRecord.seller_price };
      Object.keys(pRecord.competitors || {}).forEach(cName => {
        entry[cName] = pRecord.competitors[cName];
      });
      return entry;
    }).filter(Boolean);
  };

  const selectedHistory = getSelectedProductHistory();

  // Get active competitor names for the legend
  const getCompetitorNames = () => {
    if (!selectedProductId || products.length === 0) return [];
    const prod = products.find(p => p.product_id === selectedProductId);
    if (!prod) return [];
    return prod.competitors.map(c => c.competitor_name);
  };

  const currentCompetitorNames = getCompetitorNames();

  const handleRowClick = (productId: string) => {
    setSelectedProductId(productId);
  };

  const toggleRowExpand = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRows(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const handleExportCSV = () => {
    if (products.length === 0) return;
    const headers = "Product ID,Product Name,Seller Price,Cheapest Competitor,Price Gap %,Urgency,Recommended Price,Strategy,Rationale\n";
    const rows = products.map(p => {
      const cheapest = minPrice(p.competitors);
      return `"${p.product_id}","${p.name}",${p.seller_price_inr},${cheapest},${p.analysis.price_gap_pct}%,"${p.strategy.urgency}",${p.strategy.recommended_price_inr},"${p.strategy.strategy}","${p.strategy.rationale}"`;
    }).join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SellerShield_Repricing_Recommendations_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const minPrice = (competitors: CompetitorPrice[]) => {
    if (!competitors || competitors.length === 0) return 0;
    return Math.min(...competitors.map(c => c.price_inr));
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

          <div onClick={() => window.location.href = "/pricing"} className="nav-item-wrapper active">
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
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>📉</span> Price Intelligence Audit
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>Stride Co. Price Intelligence & Margin Optimiser Engine</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <AlertsDrawer />
            <button onClick={handleLoadSample} className="btn-upgrade">
              Load & Audit Footwear Catalog
            </button>
          </div>
        </header>

        {loading && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ maxWidth: "320px", textAlign: "center" }}>
              <div style={{ fontSize: "16px", fontWeight: "600", marginBottom: "8px" }}>Analyzing Catalog</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{loadingMessage}</div>
            </div>
          </div>
        )}

        {products.length === 0 ? (
          <div className="card-standard" style={{ textAlign: "center", padding: "48px" }}>
            <h3 className="card-title">No Catalog Data Loaded</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13.5px" }}>
              Click "Load & Audit Footwear Catalog" above to initiate competitor scan and strategy modeling.
            </p>
          </div>
        ) : (
          <>
            {/* Section B: Portfolio Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.75rem", width: "100%" }}>
              <div className="card-standard" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Total Audited</div>
                <div style={{ fontSize: "24px", fontWeight: "800", marginTop: "4px" }}>{totalProducts} Items</div>
              </div>
              <div className="card-standard" style={{ padding: "1.5rem", borderLeft: "4px solid var(--color-accent-coral)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Being Undercut</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: beingUndercutCount > 0 ? "var(--color-accent-coral)" : "inherit", marginTop: "4px" }}>{beingUndercutCount} Items</div>
              </div>
              <div className="card-standard" style={{ padding: "1.5rem", borderLeft: "4px solid var(--color-accent-coral)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Price Wars Active</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: priceWarsCount > 0 ? "var(--color-accent-coral)" : "inherit", marginTop: "4px" }}>{priceWarsCount} Channels</div>
              </div>
              <div className="card-standard" style={{ padding: "1.5rem", borderLeft: "4px solid var(--color-accent-yellow)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>Action Required (ACT NOW)</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: actNowCount > 0 ? "var(--color-accent-yellow)" : "inherit", marginTop: "4px" }}>{actNowCount} Alert(s)</div>
              </div>
            </div>

            {/* Grid for Scatter Plot & Simulation Tool */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1.75rem", width: "100%" }}>
              
              {/* Scatter Plot */}
              <div className="card-standard">
                <div className="card-title">Catalogue Pricing Gap vs Seller Value</div>
                <div style={{ width: "100%", height: "220px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" dataKey="x" name="Seller Price" unit=" ₹" style={{ fontSize: "10px" }} />
                      <YAxis type="number" dataKey="y" name="Price Gap" unit="%" style={{ fontSize: "10px" }} />
                      <ZAxis type="category" dataKey="name" name="Product" />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter 
                        name="Products" 
                        data={getScatterData()} 
                        fill="var(--color-primary)"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pricing Strategy Simulation Tool */}
              <div className="card-standard" style={{ borderLeft: "4px solid var(--color-accent-coral)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div className="card-title">Pricing Strategy Simulation Tool</div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                    Simulate how adjusting Stride Co.'s price impacts buy-box rank, margins, and strategy.
                  </p>
                  
                  <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Select Product</label>
                      <select 
                        value={simProductId} 
                        onChange={(e) => {
                          const pid = e.target.value;
                          setSimProductId(pid);
                          const p = products.find(prod => prod.product_id === pid);
                          if (p) setSimPrice(p.seller_price_inr);
                        }} 
                        style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "#ffffff", fontSize: "12.5px" }}
                      >
                        {products.map(p => (
                          <option key={p.product_id} value={p.product_id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: "120px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "600", display: "block", marginBottom: "4px" }}>Simulated Price (₹)</label>
                      <input 
                        type="number" 
                        value={simPrice} 
                        onChange={(e) => setSimPrice(Number(e.target.value))} 
                        style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSimulatePrice} 
                    className="btn-action-primary" 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", border: "none" }}
                  >
                    Run Pricing Simulation
                  </button>
                </div>

                {simResult ? (
                  <div style={{ marginTop: "14px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11.5px", marginBottom: "8px" }}>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Simulated Buy-Box Rank:</span>{" "}
                        <strong style={{ color: simResult.undercuts_competitors ? "#10b981" : "var(--color-accent-coral)" }}>
                          Rank #{simResult.new_rank} of {simResult.total_competitors}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Margin Impact:</span>{" "}
                        <strong style={{ color: simResult.margin_impact_pct >= 0 ? "#10b981" : "#ef4444" }}>
                          {simResult.margin_impact_pct >= 0 ? "+" : ""}{simResult.margin_impact_pct}%
                        </strong>
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--bg-hover)", padding: "8px", borderRadius: "8px", lineHeight: "1.4" }}>
                      <strong>Strategy Model: {simResult.strategy}</strong> — {simResult.rationale}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontStyle: "italic", textAlign: "center", padding: "16px" }}>
                    Configure a product and price above, then click Run Simulation.
                  </div>
                )}
              </div>
            </div>

            {/* Section D: Products Table */}
            <div className="card-standard">
              <div className="card-title">Product Pricing Matrix</div>
              <div className="table-container">
                <table className="enterprise-table" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }} />
                      <th>Product</th>
                      <th>Seller ₹</th>
                      <th>Cheapest Comp ₹</th>
                      <th>Price Gap</th>
                      <th>Position</th>
                      <th>Undercutting</th>
                      <th>Urgency</th>
                      <th>Strategy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const cheapest = minPrice(p.competitors);
                      const isExpanded = expandedRows.includes(p.product_id);
                      const isSelected = selectedProductId === p.product_id;

                      return (
                        <React.Fragment key={p.product_id}>
                          <tr 
                            onClick={() => handleRowClick(p.product_id)}
                            style={{ 
                              cursor: "pointer", 
                              background: isSelected ? "var(--bg-hover)" : "transparent",
                              fontWeight: isSelected ? "600" : "normal"
                            }}
                          >
                            <td>
                              <button 
                                onClick={(e) => toggleRowExpand(p.product_id, e)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}
                              >
                                {isExpanded ? "▼" : "▶"}
                              </button>
                            </td>
                            <td>
                              <div>{p.name}</div>
                              <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{p.product_id} • {p.category}</span>
                            </td>
                            <td>INR {p.seller_price_inr}</td>
                            <td>INR {cheapest}</td>
                            <td style={{ color: p.analysis.price_gap_inr > 0 ? "var(--color-accent-coral)" : "#10b981" }}>
                              {p.analysis.price_gap_inr > 0 ? `+INR ${p.analysis.price_gap_inr}` : `INR ${p.analysis.price_gap_inr}`} ({p.analysis.price_gap_pct}%)
                            </td>
                            <td>
                              <span style={{ textTransform: "capitalize", fontSize: "11px", fontWeight: "bold" }}>
                                {p.analysis.price_position}
                              </span>
                            </td>
                            <td>
                              {p.analysis.undercutting_detected ? (
                                <span style={{ color: "var(--color-accent-coral)", fontSize: "11px" }}>
                                  Yes ({p.analysis.undercutting_competitor})
                                </span>
                              ) : (
                                <span style={{ color: "#10b981", fontSize: "11px" }}>No</span>
                              )}
                            </td>
                            <td>
                              <span 
                                className="status-badge"
                                style={{
                                  background: p.strategy.urgency === "ACT_NOW" ? "#fee2e2" : p.strategy.urgency === "MONITOR" ? "#fef3c7" : "#dcfce7",
                                  color: p.strategy.urgency === "ACT_NOW" ? "#ef4444" : p.strategy.urgency === "MONITOR" ? "#d97706" : "#10b981",
                                  fontSize: "10px",
                                  borderRadius: "4px"
                                }}
                              >
                                {formatUnderscoreText(p.strategy.urgency)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "11px", fontWeight: "bold" }}>
                                {formatUnderscoreText(p.strategy.strategy)}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} style={{ background: "var(--bg-hover)", padding: "16px 24px" }}>
                                <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                                  <div style={{ marginBottom: "6px" }}><strong>Recommended Repricing:</strong> <span style={{ color: "var(--color-accent-coral)", fontWeight: "bold" }}>INR {p.strategy.recommended_price_inr}</span></div>
                                  <div style={{ marginBottom: "6px" }}><strong>Estimated Margin Change:</strong> <span style={{ fontWeight: "bold", color: p.strategy.estimated_margin_impact < 0 ? "var(--color-accent-coral)" : "#10b981" }}>{p.strategy.estimated_margin_impact}%</span></div>
                                  <div><strong>Strategy Rationale:</strong> {p.strategy.rationale}</div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section E: Price History Line Chart */}
            <div className="dashboard-grid-bottom">
              <div className="card-standard" style={{ flex: 1.8 }}>
                <div className="card-title">
                  Price Tracking Trend: {products.find(p => p.product_id === selectedProductId)?.name || "Selected Product"}
                </div>
                <div style={{ width: "100%", height: "220px" }}>
                  {selectedHistory.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No history data available for this product.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" style={{ fontSize: "10px" }} />
                        <YAxis style={{ fontSize: "10px" }} />
                        <Tooltip />
                        <Legend style={{ fontSize: "11px" }} />
                        <Line type="monotone" dataKey="Seller" stroke="var(--color-primary)" strokeWidth={3} />
                        {currentCompetitorNames.map((cName, i) => (
                          <Line 
                            key={i} 
                            type="monotone" 
                            dataKey={cName} 
                            stroke={i === 0 ? "var(--color-accent-coral)" : i === 1 ? "var(--color-accent-yellow)" : "var(--text-secondary)"} 
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Section F: ACT NOW Alerts Panel */}
              <div className="card-standard" style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div className="card-title" style={{ marginBottom: "0" }}>ACT NOW Action Plan</div>
                  <button onClick={handleExportCSV} className="btn-action-primary" style={{ padding: "6px 12px", fontSize: "10px" }}>
                    Export CSV
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "220px", overflowY: "auto" }}>
                  {products.filter(p => p.strategy.urgency === "ACT_NOW").length === 0 ? (
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", fontStyle: "italic" }}>No critical pricing actions required.</p>
                  ) : (
                    products.filter(p => p.strategy.urgency === "ACT_NOW").map(p => (
                      <div key={p.product_id} style={{ background: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", fontWeight: "bold" }}>
                          <span>{p.name}</span>
                          <span style={{ color: "var(--color-accent-coral)" }}>INR {p.strategy.recommended_price_inr}</span>
                        </div>
                        <p style={{ fontSize: "10.5px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                          {p.strategy.rationale}
                        </p>
                      </div>
                    ))
                  )}
                </div>
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
