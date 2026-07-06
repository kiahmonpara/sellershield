"use client";

import React, { useState, useRef, useEffect } from "react";
import AlertsDrawer from "../components/AlertsDrawer";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  sources?: string[];
}

export default function AssistantPage() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "agent",
      text: "Namaste! I am the Stride Co. protection assistant. How can I help you audit return fraud, verify reviews, or monitor competitor pricing gaps today?",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Unique session ID for conversation persistence in memory
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    sessionIdRef.current = `sess_${Math.random().toString(36).substring(2, 10)}`;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const suggestedQuestions = [
    "Which customers should I file claims against today?",
    "Are my Elite Runner Pro reviews trustworthy?",
    "Am I being undercut on any products right now?",
    "What is my Brand Health Score and why?",
    "Which product has the highest fraud risk?",
    "Should I lower the price of TrailBlazer Hiking Shoes?",
    "What were the last 5 security events?",
    "How much revenue is at risk across all modules?",
  ];

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: "user",
      text: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionIdRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentMsg: Message = {
          id: `msg_${Date.now() + 1}`,
          sender: "agent",
          text: data.response || "I didn't receive a response from the protection engine.",
          sources: data.sources_used || [],
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_err_${Date.now()}`,
            sender: "agent",
            text: `Error: ${errData.detail || "Failed to reach the SellerShield assistant."}`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: "agent",
          text: "Communication error: Ensure the FastAPI backend is running on port 8000.",
        },
      ]);
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

          <div onClick={() => window.location.href = "/assistant"} className="nav-item-wrapper active">
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

      {/* Main Content Area */}
      <div className="main-content" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        
        {/* Header */}
        <header className="dashboard-header" style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="welcome-text">
            <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>💬</span> Ask Stride Co. AI
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
              Query Return Fraud, Reviews, and Pricing metrics via natural language.
            </p>
          </div>
          <div>
            <AlertsDrawer />
          </div>
        </header>

        {/* Chat UI Workspace */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", gap: "24px", paddingBottom: "24px" }}>
          
          {/* Left Column: Suggested Prompts */}
          <div
            className="card-standard"
            style={{
              width: "280px",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
              gap: "12px",
              overflowY: "auto",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "8px" }}>
              Suggested Inquiries
            </div>
            {suggestedQuestions.map((q, idx) => (
              <div
                key={idx}
                onClick={() => handleSend(q)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  background: "var(--bg-accent-light, #fafaf9)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.borderColor = "#ff5c1a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-accent-light, #fafaf9)";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                }}
              >
                {q}
              </div>
            ))}
          </div>

          {/* Right Column: Chat History & Input */}
          <div
            className="card-standard"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              gap: "16px",
              overflow: "hidden",
            }}
          >
            
            {/* Scrollable Message Box */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingRight: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "16px",
                      borderRadius: "16px",
                      fontSize: "13.5px",
                      lineHeight: "1.5",
                      background: m.sender === "user" ? "#1a2744" : "var(--bg-accent-light, #fafaf9)",
                      color: m.sender === "user" ? "#ffffff" : "var(--text-primary)",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                      border: m.sender === "user" ? "none" : "1px solid var(--border-color)",
                    }}
                  >
                    <div>{m.text}</div>
                    
                    {/* Tool citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div
                        style={{
                          marginTop: "12px",
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                          borderTop: "1px solid var(--border-color)",
                          paddingTop: "8px",
                        }}
                      >
                        <span style={{ fontSize: "10px", color: "var(--text-secondary)", alignSelf: "center" }}>
                          Sources used:
                        </span>
                        {m.sources.map((src) => (
                          <span
                            key={src}
                            style={{
                              fontSize: "9px",
                              fontWeight: "bold",
                              background: "#e2e8f0",
                              color: "var(--text-secondary)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: "var(--bg-accent-light, #fafaf9)",
                      border: "1px solid var(--border-color)",
                      padding: "16px",
                      borderRadius: "16px",
                      display: "flex",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    <div className="typing-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff5c1a", animation: "bounce 0.8s infinite alternate" }}></div>
                    <div className="typing-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff5c1a", animation: "bounce 0.8s infinite alternate 0.2s" }}></div>
                    <div className="typing-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff5c1a", animation: "bounce 0.8s infinite alternate 0.4s" }}></div>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div style={{ display: "flex", gap: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "16px", flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Ask about returns fraud, price undercuts, or review flags..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend(inputText);
                }}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "14px 20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  outline: "none",
                  fontSize: "13.5px",
                }}
              />
              <button
                onClick={() => handleSend(inputText)}
                disabled={loading}
                style={{
                  background: "#ff5c1a",
                  color: "#ffffff",
                  border: "none",
                  padding: "0 24px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Send
              </button>
            </div>
            
          </div>
          
        </div>
        
      </div>

      {/* Typing animation keyframe injection */}
      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
