"use client";

import React, { useState, useEffect, useRef } from "react";
import AlertsDrawer from "./components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface ClaimRecord {
  ticket_id: string;
  order_id: string;
  customer_id: string;
  platform: string;
  amount: number;
  status: string;
  date: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "results" | "audit" | "reviews" | "pricing">("dashboard");
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(false);
  
  // API Response States
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Simulated data state for live webhook scanner feed
  const [records, setRecords] = useState<any[]>([]);
  const [liveScans, setLiveScans] = useState<any[]>([]);
  const [simulatedCount, setSimulatedCount] = useState<number>(1875);
  const [simulatedWeightLoss, setSimulatedWeightLoss] = useState<number>(850);

  // Stride Co. Brand Custom States & Constants
  const [selectedProductFilter, setSelectedProductFilter] = useState<string | null>(null);
  const [revenueAtRisk, setRevenueAtRisk] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const BRAND_PRODUCTS = [
    { id: "PROD-A", name: "Elite Runner Pro", price: "₹2,499", category: "Running Shoes", platforms: ["Amazon"], status: { pricing: "Stable", reviews: "94% Authentic", returns: "Low Risk" }, icon: "👟" },
    { id: "PROD-E", name: "CloudWalk Sneakers", price: "₹1,899", category: "Sneakers", platforms: ["Myntra"], status: { pricing: "Stable", reviews: "96% Authentic", returns: "Low Risk" }, icon: "👟" },
    { id: "PROD-C", name: "OrthoPro Insoles", price: "₹599", category: "Accessories", platforms: ["Flipkart"], status: { pricing: "Undercut Alert", reviews: "95% Authentic", returns: "Medium Risk" }, icon: "👣" },
    { id: "PROD-B", name: "StrideClean Spray", price: "₹349", category: "Shoe Care", platforms: ["Amazon"], status: { pricing: "Stable", reviews: "92% Authentic", returns: "Low Risk" }, icon: "🧼" },
    { id: "PROD-D", name: "LaceUp Reflective Laces", price: "₹149", category: "Accessories", platforms: ["Flipkart"], status: { pricing: "Stable", reviews: "90% Authentic", returns: "Low Risk" }, icon: "🧵" },
    { id: "PROD-F", name: "TrailBlazer Hiking Shoes", price: "₹3,299", category: "Hiking Shoes", platforms: ["Meesho"], status: { pricing: "Stable", reviews: "93% Authentic", returns: "Low Risk" }, icon: "🥾" }
  ];

  const showToast = (msg: string) => {
    setToast({ message: msg, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  const getFilteredLiveScans = () => {
    if (!selectedProductFilter) return liveScans;
    const prodName = BRAND_PRODUCTS.find(p => p.id === selectedProductFilter)?.name || "";
    return liveScans.filter(scan => scan.item_name === prodName);
  };

  const getFilteredProfiles = () => {
    if (!selectedProductFilter) return profiles;
    const prodName = BRAND_PRODUCTS.find(p => p.id === selectedProductFilter)?.name || "";
    return profiles.filter(p => {
      return records.some(rec => rec.customer_id === p.customer_id && rec.item_name === prodName);
    });
  };

  const filteredLiveScans = getFilteredLiveScans();
  const filteredProfiles = getFilteredProfiles();

  // Custom capstone USPs
  const [filingLedger, setFilingLedger] = useState<ClaimRecord[]>([
    {
      ticket_id: "TIC-49281740",
      order_id: "ORD-00928",
      customer_id: "C002",
      platform: "Flipkart",
      amount: 4200.0,
      status: "REIMBURSED",
      date: "2026-07-02"
    },
    {
      ticket_id: "TIC-50192837",
      order_id: "ORD-01042",
      customer_id: "C011",
      platform: "Amazon",
      amount: 8700.0,
      status: "APPROVED",
      date: "2026-07-03"
    }
  ]);
  
  // Selection and Modal States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDossier, setActiveDossier] = useState<any | null>(null);
  const [activeClaim, setActiveClaim] = useState<any | null>(null);
  const [claimSubmitLoading, setClaimSubmitLoading] = useState<boolean>(false);

  // Parse URL tab parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "results" || tab === "audit" || tab === "dashboard") {
        setActiveTab(tab as any);
      }
    }
  }, []);

  // Fetch live returns on mount
  useEffect(() => {
    fetchLiveReturns();
  }, []);

  // Fetch audit logs when tab changes to audit
  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchLiveReturns = async () => {
    setLoading(true);
    setLoadingMessage("Fetching real-time returns data...");
    const retries = 5;
    const delay = 2000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/returns/live`);
        if (res.ok) {
          const data = await res.json();
          const profilesList = data.profiles || [];
          setProfiles(profilesList);
          setDossiers(data.dossiers || []);
          const recordsList = data.records || [];
          setRecords(recordsList);
          
          // Seed initial live scans
          const getRecordRiskLevel = (cid: string) => {
            const prof = profilesList.find((p: any) => p.customer_id === cid);
            return prof ? prof.risk_level : "CLEAN";
          };
          
          const initialScans = recordsList.slice(0, 10).map((r: any, idx: number) => ({
            ...r,
            scan_time: new Date(Date.now() - (10 - idx) * 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            risk_level: getRecordRiskLevel(r.customer_id)
          }));
          setLiveScans(initialScans.reverse());
          break; // success, exit early
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} to fetch live returns failed:`, err);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("Failed to fetch live returns after maximum retries", err);
        }
      }
    }
    setLoading(false);
    setLoadingMessage("");
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    }
  };

  // Stride Co. count-up animation effect
  const targetRevenue = profiles.filter(p => p.risk_level !== "LOW_RISK").reduce((acc, p) => acc + (p.evidence.total_return_value_inr || 0), 0) + 12000;
  useEffect(() => {
    if (loading || targetRevenue === 0) return;
    let start = 0;
    const end = targetRevenue;
    const duration = 800;
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setRevenueAtRisk(Math.floor(progress * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [targetRevenue, loading]);

  // Initial load success toast
  useEffect(() => {
    if (profiles.length > 0) {
      showToast(`Successfully synchronized Stride Co. catalog and returns data.`);
    }
  }, [profiles.length]);

  // Simulate real-time webhook scan feed
  useEffect(() => {
    if (records.length === 0) return;

    const getRecordRiskLevel = (cid: string) => {
      const prof = profiles.find((p: any) => p.customer_id === cid);
      return prof ? prof.risk_level : "CLEAN";
    };

    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * records.length);
      const record = records[randomIdx];
      const risk = getRecordRiskLevel(record.customer_id);
      
      const newScan = {
        ...record,
        scan_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        risk_level: risk
      };
      
      setLiveScans(prev => [newScan, ...prev.slice(0, 12)]);
      setSimulatedCount(prev => prev + 1);
      
      const origW = parseFloat(record.original_weight_g) || 0;
      const retW = parseFloat(record.return_weight_g) || 0;
      const delta = Math.abs(origW - retW);
      if (record.return_date && delta > 0) {
        setSimulatedWeightLoss(prev => prev + Math.round(delta));
      }
    }, 8000);
    
    return () => clearInterval(interval);
  }, [records, profiles]);

  const handleApproveSelected = async () => {
    if (selectedIds.length === 0) return;

    setLoading(true);
    setLoadingMessage("Compiling Evidence & Writing Claim Documents...");

    try {
      const res = await fetch(`${API_BASE_URL}/api/approve-claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_ids: selectedIds,
          dossiers: dossiers,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Approval failed");
      }

      const data = await res.json();
      // Force claims update
      if (data.claims && data.claims.length > 0) {
        try {
          const enhanceRes = await fetch(`${API_BASE_URL}/api/fraud/claims/enhance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ claims: data.claims, dossiers: dossiers })
          });
          if (enhanceRes.ok) {
            const enhancedClaims = await enhanceRes.json();
            setActiveClaim(enhancedClaims[0]);
          } else {
            setActiveClaim(data.claims[0]);
          }
        } catch (e) {
          setActiveClaim(data.claims[0]);
        }
      }
      
      fetchAuditLogs();
    } catch (err: any) {
      alert(`Failed to approve claims: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleSingleApprove = async (customerId: string) => {
    setSelectedIds([customerId]);
    setLoading(true);
    setLoadingMessage("Generating Claim Document...");
    try {
      const res = await fetch(`${API_BASE_URL}/api/approve-claims`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_ids: [customerId],
          dossiers: dossiers,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Approval failed");
      }

      const data = await res.json();
      
      if (data.claims && data.claims.length > 0) {
        try {
          const enhanceRes = await fetch(`${API_BASE_URL}/api/fraud/claims/enhance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ claims: data.claims, dossiers: dossiers })
          });
          if (enhanceRes.ok) {
            const enhancedClaims = await enhanceRes.json();
            setActiveClaim(enhancedClaims[0]);
          } else {
            setActiveClaim(data.claims[0]);
          }
        } catch (e) {
          setActiveClaim(data.claims[0]);
        }
      }
      fetchAuditLogs();
    } catch (err: any) {
      alert(`Failed to approve claim: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleApiSubmitClaim = async () => {
    if (!activeClaim) return;
    
    setClaimSubmitLoading(true);
    const platform = activeClaim.activeType === "amazon" ? "Amazon" : activeClaim.activeType === "flipkart" ? "Flipkart" : "Generic";
    
    const textContent = activeClaim.generic || "";
    const orderIdMatch = textContent.match(/Claim Reference\*\*:\s*([^\s\n]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : "ORD-UNKNOWN";
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/submit-claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: activeClaim.customer_id,
          platform: platform,
          claim_amount: activeClaim.claim_value || 8900.0,
          order_id: orderId
        })
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit claim to platform API");
      }
      
      const data = await res.json();
      
      const newRecord: ClaimRecord = {
        ticket_id: data.ticket_id,
        order_id: orderId,
        customer_id: activeClaim.customer_id,
        platform: platform,
        amount: activeClaim.claim_value || 8900.0,
        status: data.status,
        date: new Date().toISOString().split("T")[0]
      };
      
      setFilingLedger(prev => [newRecord, ...prev]);
      showToast(`Claim filed successfully! Ticket: ${data.ticket_id}`);
      setActiveClaim(null); 
      fetchAuditLogs();
    } catch (err: any) {
      showToast(`API Submission failed: ${err.message}`);
    } finally {
      setClaimSubmitLoading(false);
    }
  };

  const handleCheckboxChange = (customerId: string) => {
    setSelectedIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const openDossier = (customerId: string) => {
    const d = dossiers.find((dos) => dos.profile.customer_id === customerId);
    if (d) {
      setActiveDossier(d);
    }
  };

  const getGeographicHotspots = () => {
    const cityCounts: { [key: string]: number } = {};
    dossiers.forEach((d) => {
      (d.history || []).forEach((h: any) => {
        if (h.return_date && h.city) {
          const cityClean = h.city.trim();
          cityCounts[cityClean] = (cityCounts[cityClean] || 0) + 1;
        }
      });
    });

    const sortedCities = Object.entries(cityCounts)
      .map(([city, count]) => {
        let risk = "LOW RISK";
        let color = "#10b981";
        if (count >= 5) {
          risk = "HIGH RISK";
          color = "var(--color-accent-coral)";
        } else if (count >= 2) {
          risk = "MEDIUM RISK";
          color = "var(--color-accent-yellow)";
        }
        return { city, count, risk, color };
      })
      .sort((a, b) => b.count - a.count);

    const maxCount = sortedCities.length > 0 ? sortedCities[0].count : 1;
    return sortedCities.map((c) => ({
      ...c,
      pct: Math.round((c.count / maxCount) * 100)
    }));
  };

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

  const renderClaimContent = (text: string) => {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("####")) {
        return <h4 key={idx} style={{ fontSize: "13.5px", fontWeight: "700", marginTop: "16px", marginBottom: "8px", color: "var(--text-primary)", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>{trimmed.replace("####", "").trim()}</h4>;
      }
      if (trimmed.startsWith("###")) {
        return <h3 key={idx} style={{ fontSize: "14.5px", fontWeight: "700", marginTop: "18px", marginBottom: "10px", color: "var(--text-primary)" }}>{trimmed.replace("###", "").trim()}</h3>;
      }
      if (trimmed.startsWith("##")) {
        return <h3 key={idx} style={{ fontSize: "14.5px", fontWeight: "700", marginTop: "18px", marginBottom: "10px", color: "var(--text-primary)" }}>{trimmed.replace("##", "").trim()}</h3>;
      }
      if (trimmed.startsWith("#")) {
        return <h3 key={idx} style={{ fontSize: "14.5px", fontWeight: "700", marginTop: "18px", marginBottom: "10px", color: "var(--text-primary)" }}>{trimmed.replace("#", "").trim()}</h3>;
      }
      if (trimmed.startsWith("- ") || (trimmed.startsWith("* ") && !trimmed.startsWith("**"))) {
        const itemContent = trimmed.substring(2).trim();
        return (
          <li key={idx} style={{ marginLeft: "16px", listStyleType: "disc", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6", margin: "6px 0" }}>
            {parseBoldText(itemContent)}
          </li>
        );
      }
      return <p key={idx} style={{ margin: "6px 0", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6" }}>{parseBoldText(trimmed)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} style={{ color: "var(--text-primary)", fontWeight: "700" }}>{part}</strong>;
      }
      return part;
    });
  };

  const renderRiskPills = (score: number, level: string) => {
    const activeCount = Math.ceil(score / 10);
    const pills = [];
    const isHigh = level === "HIGH_RISK";
    const isMed = level === "MEDIUM_RISK";
    
    for (let i = 1; i <= 10; i++) {
      let activeClass = "";
      if (i <= activeCount) {
        activeClass = isHigh ? "active-red" : isMed ? "active-yellow" : "active-green";
      }
      pills.push(
        <div key={i} className={`risk-indicator-pill ${activeClass}`} />
      );
    }
    return <div className="risk-indicator-container">{pills}</div>;
  };

  return (
    <div className="app-container">
      {/* Expandable Sidebar */}
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
            onClick={() => {
              setActiveTab("dashboard");
              window.history.pushState(null, "", "/?tab=dashboard");
            }}
            className={`nav-item-wrapper ${activeTab === "dashboard" ? "active" : ""}`}
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
            onClick={() => {
              setActiveTab("results");
              window.history.pushState(null, "", "/?tab=results");
            }}
            className={`nav-item-wrapper ${activeTab === "results" ? "active" : ""}`}
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
            onClick={() => {
              setActiveTab("audit");
              window.history.pushState(null, "", "/?tab=audit");
            }}
            className={`nav-item-wrapper ${activeTab === "audit" ? "active" : ""}`}
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
            className="nav-item-wrapper"
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
        {/* Dashboard Header */}
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>👟</span> Stride Co. Command Centre
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>India's Premium Footwear Brand — Unified Protection Engine</p>
          </div>
          
          <div className="header-actions" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <AlertsDrawer />
            {/* Live Session Stats Bar */}
            <div style={{ display: "flex", gap: "16px", background: "var(--bg-card)", padding: "10px 20px", borderRadius: "12px", border: "1px solid var(--border-color)", fontSize: "12px" }}>
              <div><span style={{ color: "var(--text-secondary)" }}>Session:</span> <strong style={{ color: "#10b981" }}>Active</strong></div>
              <div style={{ width: "1px", background: "var(--border-color)" }}></div>
              <div><span style={{ color: "var(--text-secondary)" }}>Analysed:</span> <strong>{simulatedCount}</strong></div>
              <div style={{ width: "1px", background: "var(--border-color)" }}></div>
              <div><span style={{ color: "var(--text-secondary)" }}>Threats:</span> <strong style={{ color: "#ef4444" }}>{profiles.filter(p => p.risk_level !== "LOW_RISK").length}</strong></div>
              <div style={{ width: "1px", background: "var(--border-color)" }}></div>
              <div><span style={{ color: "var(--text-secondary)" }}>Claims Ready:</span> <strong style={{ color: "var(--color-accent-coral)" }}>{dossiers.length}</strong></div>
              <div style={{ width: "1px", background: "var(--border-color)" }}></div>
              <div><span style={{ color: "var(--text-secondary)" }}>Protected:</span> <strong style={{ color: "#10b981" }}>₹{dossiers.reduce((acc, d) => acc + (d.profile.evidence.total_return_value_inr || 0), 0).toLocaleString()}</strong></div>
            </div>
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

        {/* Tab 1: Brand Command Centre / Home */}
        {activeTab === "dashboard" && (
          <div className="main-content" style={{ padding: "0", gap: "24px" }}>
            
            {/* Top Row: Brand Health Score & Revenue at Risk Ticker */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.75rem", width: "100%" }}>
              
              {/* Brand Health Score */}
              <div className="card-warm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.5rem" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Brand Health Score</span>
                  <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--text-primary)", marginTop: "8px" }}>
                    86%
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <span style={{ fontSize: "10px", padding: "2px 8px", background: "#dcfce7", color: "#10b981", borderRadius: "12px", fontWeight: "bold" }}>HEALTHY</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "12px", lineHeight: "1.4" }}>
                    Weighted index of Review Authenticity (35%), Return Protection (35%), and Pricing Health (30%).
                  </p>
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
                        strokeDashoffset: 276.4 - (276.4 * 86) / 100,
                        stroke: "#10b981"
                      }} 
                    />
                  </svg>
                  <span className="gauge-center-text" style={{ fontSize: "16px", fontWeight: "800", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>86%</span>
                </div>
              </div>

              {/* Revenue at Risk Ticker */}
              <div className="card-standard" style={{ borderLeft: "4px solid var(--color-accent-coral)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "1.5rem" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "bold" }}>Revenue at Risk</span>
                  <div style={{ fontSize: "36px", fontWeight: "800", color: "var(--color-accent-coral)", marginTop: "8px", display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span>₹</span>
                    <span>{revenueAtRisk.toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px", lineHeight: "1.4" }}>
                    Estimated value currently vulnerable to return fraud (₹{profiles.filter(p => p.risk_level !== "LOW_RISK").reduce((sum, p) => sum + (p.evidence.total_return_value_inr || 0), 0).toLocaleString()}) and competitor price undercutting campaigns.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255, 92, 26, 0.1)", color: "var(--color-accent-coral)", padding: "4px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: "bold", width: "fit-content", marginTop: "12px" }}>
                  <span className="pulse-dot" style={{ width: "6px", height: "6px", background: "var(--color-accent-coral)", borderRadius: "50%" }}></span>
                  PROTECTION AUDIT ACTIVE
                </div>
              </div>
            </div>

            {/* Product Performance Grid (6 Footwear Products) */}
            <div className="card-standard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div className="card-title" style={{ marginBottom: "4px" }}>Stride Co. Product Catalog</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    Select a footwear product to filter real-time returns and risk profiles downstream.
                  </p>
                </div>
                {selectedProductFilter && (
                  <button onClick={() => setSelectedProductFilter(null)} className="btn-action-secondary" style={{ padding: "6px 12px", fontSize: "11px" }}>
                    Reset Filter
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
                {BRAND_PRODUCTS.map((prod) => {
                  const isSelected = selectedProductFilter === prod.id;
                  const isUndercut = prod.status.pricing === "Undercut Alert";
                  
                  return (
                    <div 
                      key={prod.id} 
                      onClick={() => window.location.href = `/product/${prod.id}`}
                      className="card-standard"
                      style={{ 
                        cursor: "pointer", 
                        padding: "1.25rem", 
                        background: "#ffffff",
                        border: "1px solid var(--border-color)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                        <span style={{ fontSize: "28px" }}>{prod.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text-primary)" }}>{prod.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{prod.category} • {prod.price}</div>
                          <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
                            {prod.platforms.map((plat) => (
                              <span key={plat} style={{ fontSize: "9px", background: "#f3f4f6", padding: "1px 6px", borderRadius: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>
                                {plat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border-color)", marginTop: "12px", paddingTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "10.5px" }}>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Reviews:</span>{" "}
                          <span style={{ fontWeight: "600", color: "#10b981" }}>{prod.status.reviews}</span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Pricing:</span>{" "}
                          <span style={{ fontWeight: "600", color: isUndercut ? "#ef4444" : "#10b981" }}>{prod.status.pricing}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Webhook Ingestion Feed */}
            <div className="card-standard">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div className="card-title" style={{ marginBottom: "4px" }}>
                    Live Webhook Inbound Scans {selectedProductFilter ? `— Filtered for ${BRAND_PRODUCTS.find(p => p.id === selectedProductFilter)?.name}` : ""}
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                    Real-time listener monitoring API callbacks from marketplace delivery partners.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", padding: "6px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "bold" }}>
                  <span className="pulse-dot" style={{ width: "8px", height: "8px", background: "#10b981", borderRadius: "50%", display: "inline-block" }}></span>
                  LISTENER ACTIVE
                </div>
              </div>

              <div className="live-scans-feed" style={{ maxHeight: "350px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                {filteredLiveScans.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", fontStyle: "italic", fontSize: "13px", textAlign: "center", padding: "24px" }}>
                    No return webhook events matching the filter...
                  </p>
                ) : (
                  filteredLiveScans.map((scan, idx) => {
                    const isHigh = scan.risk_level === "HIGH_RISK";
                    const isMed = scan.risk_level === "MEDIUM_RISK";
                    
                    let bg = "var(--bg-hover)";
                    let borderColor = "var(--border-color)";
                    let riskBadgeColor = "var(--text-secondary)";
                    let riskBadgeBg = "#f3f4f6";
                    
                    if (isHigh) {
                      bg = "rgba(234, 101, 86, 0.04)";
                      borderColor = "rgba(234, 101, 86, 0.2)";
                      riskBadgeColor = "var(--color-accent-coral)";
                      riskBadgeBg = "rgba(234, 101, 86, 0.1)";
                    } else if (isMed) {
                      bg = "rgba(249, 191, 41, 0.04)";
                      borderColor = "rgba(249, 191, 41, 0.2)";
                      riskBadgeColor = "#d97706";
                      riskBadgeBg = "rgba(249, 191, 41, 0.1)";
                    }
                    
                    return (
                      <div key={idx} style={{ 
                        background: bg, 
                        border: `1px solid ${borderColor}`, 
                        borderRadius: "12px", 
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "12.5px",
                        transition: "all 0.3s ease"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ 
                            width: "6px", 
                            height: "6px", 
                            borderRadius: "50%", 
                            background: isHigh ? "var(--color-accent-coral)" : isMed ? "var(--color-accent-yellow)" : "#10b981"
                          }}></span>
                          <span style={{ 
                            fontSize: "10px", 
                            fontWeight: "bold", 
                            padding: "2px 6px", 
                            borderRadius: "4px", 
                            background: scan.platform === "Amazon" ? "#ff9900" : scan.platform === "Flipkart" ? "#0000ff" : "#1e222b",
                            color: "#ffffff"
                          }}>
                            {scan.platform}
                          </span>
                          <div>
                            <strong>{scan.order_id}</strong>
                            <span style={{ color: "var(--text-tertiary)", marginLeft: "6px" }}>({scan.customer_id})</span>
                          </div>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {scan.return_date ? (
                              <span>Returned SKU <strong>{scan.item_name}</strong> - Reason: <span style={{ color: "var(--color-accent-coral)", fontWeight: "500" }}>{formatUnderscoreText(scan.return_reason)}</span></span>
                            ) : (
                              <span>Kept SKU <strong>{scan.item_name}</strong> - Safe Delivery</span>
                            )}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ 
                            fontSize: "10px", 
                            fontWeight: "bold", 
                            padding: "3px 8px", 
                            borderRadius: "10px", 
                            background: riskBadgeBg, 
                            color: riskBadgeColor 
                          }}>
                            {formatUnderscoreText(scan.risk_level)}
                          </span>
                          <span style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>{scan.scan_time}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Suspects Listing */}
        {activeTab === "results" && (
          <div className="main-content" style={{ padding: "0", gap: "24px" }}>
            {profiles.length === 0 ? (
              <div className="card-standard" style={{ textAlign: "center", padding: "48px" }}>
                <h3 className="card-title">No Profiles Scored</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", marginBottom: "20px" }}>
                  Please select and process a return shipment sheet in the first tab to build risk indicators.
                </p>
              </div>
            ) : (
              <div className="main-content" style={{ padding: "0", gap: "24px" }}>
                
                {/* KPIs / Progress and Habits grid */}
                <div className="dashboard-grid-bottom">
                  
                  {/* Left Column: Gauge and prevented progress bar */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    
                    <div className="card-standard">
                      <div className="card-title">Filing Success Rate</div>
                    <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                      <div className="gauge-container" style={{ width: "120px", height: "120px", marginTop: 0, flexShrink: 0 }}>
                        <svg className="gauge-svg">
                          <circle className="gauge-bg" cx="60" cy="60" r="48" />
                          <circle 
                            className="gauge-fill" 
                            cx="60" 
                            cy="60" 
                            r="48" 
                            style={{
                              strokeDasharray: "301.6",
                              strokeDashoffset: 301.6 - (301.6 * 94.2) / 100,
                              stroke: "#10b981"
                            }}
                          />
                        </svg>
                        <span className="gauge-center-text">94.2%</span>
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, fontSize: "12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Amazon SAFE-T:</span>
                          <strong style={{ color: "#10b981" }}>95.8%</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Flipkart SPF:</span>
                          <strong style={{ color: "#10b981" }}>92.6%</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Avg Resolution:</span>
                          <strong>2.4 Days</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Total Claims:</span>
                          <strong>48 Files</strong>
                        </div>
                      </div>
                    </div>
                    </div>

                    <div className="card-standard">
                      <div className="card-title">Loss Recovery Target</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                        <span>Recovered disputed funds</span>
                        <strong>68% Met</strong>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: "68%", height: "100%", background: "var(--bg-card-dark)" }} />
                      </div>
                    </div>

                    <div className="card-standard">
                      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>📍 Geographic Return Hotspots</span>
                        <span style={{ fontSize: "9px", background: "rgba(234, 101, 86, 0.1)", color: "var(--color-accent-coral)", padding: "2px 8px", borderRadius: "8px", fontWeight: "bold" }}>UPDATED</span>
                      </div>
                      <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: "1.4" }}>
                        Real-time tracking of returns clustered by geographic origin to isolate coordinated courier-looping fraud.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {getGeographicHotspots().length === 0 ? (
                          <p style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic", textAlign: "center", padding: "16px" }}>
                            No geographic data calculated yet. Upload returns logs to plot hotspots.
                          </p>
                        ) : (
                          getGeographicHotspots().map((h, i) => (
                            <div key={i} style={{ fontSize: "12px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontWeight: "600" }}>
                                <span>{h.city}</span>
                                <span style={{ color: h.color }}>{h.count} {h.count === 1 ? "return" : "returns"} ({h.risk})</span>
                              </div>
                              <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${h.pct}%`, height: "100%", background: h.color, borderRadius: "3px" }} />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Flagged profiles checklist */}
                  <div className="card-standard">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                      <div className="card-title" style={{ marginBottom: "0" }}>Scored Profiles & Flags</div>
                      {selectedIds.length > 0 && (
                        <button onClick={handleApproveSelected} className="btn-action-primary" style={{ padding: "8px 16px", fontSize: "11px" }}>
                          File Selected ({selectedIds.length})
                        </button>
                      )}
                    </div>

                    <div className="habits-list">
                      {filteredProfiles.map((p) => {
                        const isHigh = p.risk_level === "HIGH_RISK";
                        const avatarInitials = p.customer_id.substring(0, 3);
                        const isChecked = selectedIds.includes(p.customer_id);

                        return (
                          <div key={p.customer_id} className="habit-item">
                            <div>
                              {isHigh ? (
                                <div
                                  className={`custom-checkbox-round ${isChecked ? "checked" : ""}`}
                                  onClick={() => handleCheckboxChange(p.customer_id)}
                                >
                                  {isChecked && "✓"}
                                </div>
                              ) : (
                                <div className="custom-checkbox-round" style={{ opacity: 0.2, cursor: "not-allowed" }} />
                              )}
                            </div>
                            
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div className="habit-avatar">{avatarInitials}</div>
                              <div>
                                <div style={{ fontWeight: "600" }}>{p.customer_id}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{p.customer_name}</div>
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Risk indicators</div>
                              {renderRiskPills(p.risk_score, p.risk_level)}
                            </div>

                            <div>
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Triggers</div>
                              <span style={{ fontWeight: "600" }}>{p.evidence.return_count} returns</span>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              {(isHigh || p.risk_level === "MEDIUM_RISK") && (
                                <button
                                  onClick={() => openDossier(p.customer_id)}
                                  className="btn-action-secondary"
                                  style={{ padding: "6px 12px", fontSize: "10px", borderRadius: "12px" }}
                                >
                                  Dossier
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Ledger Log */}
                <div className="card-standard">
                  <div className="card-title">Claims Registry Ledger</div>
                  <div className="table-container">
                    <table className="enterprise-table" style={{ fontSize: "12.5px" }}>
                      <thead>
                        <tr>
                          <th>Ticket ID</th>
                          <th>Order ID</th>
                          <th>Customer ID</th>
                          <th>Platform</th>
                          <th>Value</th>
                          <th>Status</th>
                          <th>Filing Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filingLedger.map((f, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: "600" }}>{f.ticket_id}</td>
                            <td>{f.order_id}</td>
                            <td>{f.customer_id}</td>
                            <td>{f.platform}</td>
                            <td>INR {f.amount}</td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  background: f.status === "REIMBURSED" ? "#dcfce7" : "#e0e7ff",
                                  color: f.status === "REIMBURSED" ? "#10b981" : "#4f46e5",
                                  fontSize: "10px",
                                  borderRadius: "4px"
                                }}
                              >
                                {f.status}
                              </span>
                            </td>
                            <td>{f.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: System Logs */}
        {activeTab === "audit" && (
          <div className="card-standard">
            <div className="card-title">Pipeline Trace Logs</div>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
              Secure system logs generated directly by SellerShield components.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {auditLogs.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No audit log events written yet.</p>
              ) : (
                auditLogs.map((log, idx) => (
                  <div key={idx} style={{ background: "var(--bg-hover)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: "700" }}>{log.event_id}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{log.timestamp}</span>
                    </div>
                    <div style={{ fontSize: "13px", marginBottom: "6px" }}>
                      <span><strong>Module</strong>: <span style={{ fontWeight: "600", color: "var(--color-accent-coral)" }}>{log.module || "Return Fraud"}</span></span>
                      <span style={{ marginLeft: "16px" }}><strong>Component</strong>: {formatUnderscoreText(log.agent_name)}</span>
                      <span style={{ marginLeft: "16px" }}><strong>Action</strong>: {formatUnderscoreText(log.action)}</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                      {log.output_summary}
                    </p>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", wordBreak: "break-all" }}>
                      Verifiable Input Hash: {log.input_payload_hash}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Evidence Dossier */}
      {activeDossier && (
        <div className="modal-overlay" onClick={() => setActiveDossier(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title" style={{ marginBottom: "0" }}>Dossier: Customer {activeDossier.profile.customer_id}</span>
              <button onClick={() => setActiveDossier(null)} className="modal-close">✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px", fontSize: "13px" }}>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Classification score</span>
                <div style={{ fontWeight: "700", fontSize: "16px", color: "var(--color-accent-coral)" }}>
                  {formatUnderscoreText(activeDossier.profile.risk_level)} ({activeDossier.profile.risk_score}/100)
                </div>
              </div>
              <div>
                <span style={{ color: "var(--text-secondary)" }}>Total disputed claims value</span>
                <div style={{ fontWeight: "700", fontSize: "16px" }}>
                  INR {activeDossier.profile.evidence.total_return_value_inr}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
              <table className="enterprise-table" style={{ fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Product SKU</th>
                    <th>Outbound</th>
                    <th>Returned</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDossier.history.map((h: any, idx: number) => (
                    <tr key={idx}>
                      <td>{h.order_id}</td>
                      <td>{h.order_date}</td>
                      <td>{h.item_name}</td>
                      <td>{h.original_weight_g}g</td>
                      <td>{h.return_date ? `${h.return_weight_g}g` : "N/A"}</td>
                      <td>{h.return_date ? formatUnderscoreText(h.return_reason) : "Kept"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button onClick={() => setActiveDossier(null)} className="btn-action-secondary">Close Dossier</button>
              {activeDossier.profile.risk_level === "HIGH_RISK" && (
                <button
                  onClick={() => {
                    handleSingleApprove(activeDossier.profile.customer_id);
                    setActiveDossier(null);
                  }}
                  className="btn-action-primary"
                >
                  Compile Loss Claim
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Generated Claim & API Submission */}
      {activeClaim && (
        <div className="modal-overlay" onClick={() => setActiveClaim(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title" style={{ marginBottom: "0" }}>Marketplace Dispatch - {activeClaim.customer_id}</span>
              <button onClick={() => setActiveClaim(null)} className="modal-close">✕</button>
            </div>

            {/* Enhanced Claims Intelligence Stats */}
            {activeClaim.strength_score !== undefined && (
              <div style={{ background: "var(--bg-accent-light, #fafaf9)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "14px", marginBottom: "16px", fontSize: "11.5px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Claim Strength:</span> <strong>{activeClaim.strength_score}/100</strong>
                    <div style={{ width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "3px", marginTop: "4px" }}>
                      <div style={{ width: `${activeClaim.strength_score}%`, height: "100%", background: activeClaim.strength_score >= 75 ? "#10b981" : "#f59e0b", borderRadius: "3px" }}></div>
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Success Probability:</span> <br />
                    <strong style={{ color: activeClaim.success_probability_level === "High" ? "#10b981" : "#f59e0b" }}>{activeClaim.success_probability}</strong>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                  <span>SLA Countdown: <strong style={{ color: activeClaim.days_remaining <= 15 ? "#ef4444" : "var(--text-primary)" }}>{activeClaim.days_remaining} Days Left</strong></span>
                  <span>Priority Rank: <strong># {activeClaim.priority_rank}</strong></span>
                  <span>Length Check: <strong style={{ color: (activeClaim[activeClaim.activeType || "generic"] || "").length <= 500 ? "#10b981" : "#ef4444" }}>{(activeClaim[activeClaim.activeType || "generic"] || "").length}/500 chars</strong></span>
                </div>
              </div>
            )}
            
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              {["generic", "amazon", "flipkart"].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setActiveClaim((prev: any) => ({ ...prev, activeType: type }));
                  }}
                  className={`btn-action-secondary ${(!activeClaim.activeType && type === "generic") || activeClaim.activeType === type ? "btn-action-primary" : ""}`}
                  style={{ textTransform: "capitalize", padding: "8px 16px", fontSize: "12px", border: "none" }}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="claim-document-viewer" style={{ maxHeight: "300px", overflowY: "auto", borderRadius: "12px", background: "var(--bg-hover)", border: "1px solid var(--border-color)", padding: "16px" }}>
              {renderClaimContent(activeClaim[activeClaim.activeType || "generic"])}
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeClaim[activeClaim.activeType || "generic"]);
                  showToast("Claim template copied to clipboard.");
                }}
                className="btn-action-secondary"
              >
                Copy Content
              </button>
              <button
                onClick={handleApiSubmitClaim}
                className="btn-action-primary"
                disabled={claimSubmitLoading}
              >
                {claimSubmitLoading ? "Filing..." : "Submit Claim via API"}
              </button>
            </div>
          </div>
        </div>
      )}

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
