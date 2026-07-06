"use client";

import React, { useState } from "react";

export default function Welcome() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const features = [
    {
      id: 1,
      title: "Return Fraud Guard",
      icon: "🛡️",
      description: "Applies 6 risk heuristic filters and weight difference scans to flag serial returners and compile dispute claims.",
      color: "#ff5c1a"
    },
    {
      id: 2,
      title: "Review Authenticity Audit",
      icon: "⭐",
      description: "Scans reviews for linguistic text quality and temporal reviewer spikes in parallel to isolate rating manipulation.",
      color: "#f9bf29"
    },
    {
      id: 3,
      title: "Pricing Intelligence",
      icon: "📊",
      description: "Monitors competitor undercutting overnight, alerts on active price wars, and models margin-safe pricing strategies.",
      color: "#1a2744"
    },
    {
      id: 4,
      title: "Auto-Monitor Watchdog",
      icon: "🤖",
      description: "Executes scheduled multi-pipeline scans autonomously, tracking seller account health and isolating new threat deltas.",
      color: "#10b981"
    }
  ];

  return (
    <div style={{
      background: "#f4f1eb",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: "#1a2744",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "2rem"
    }}>
      {/* Header */}
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: "1100px",
        width: "100%",
        margin: "0 auto",
        paddingBottom: "1.5rem",
        borderBottom: "1px solid rgba(26, 39, 68, 0.08)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "800", fontSize: "18px", letterSpacing: "-0.5px" }}>
          <span>👟</span> Stride Co.
        </div>
        <div style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#6e6f73" }}>
          SellerShield Engine
        </div>
      </header>

      {/* Hero Section */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "1100px",
        width: "100%",
        margin: "0 auto",
        padding: "4rem 0"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #ffffff 0%, #faf8f5 100%)",
          borderRadius: "32px",
          padding: "5rem 3rem",
          border: "1px solid rgba(26, 39, 68, 0.06)",
          boxShadow: "0 10px 30px rgba(26, 39, 68, 0.03)",
          textAlign: "center",
          width: "100%",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Subtle Warm Radial Glow */}
          <div style={{
            position: "absolute",
            top: "-20%",
            left: "-20%",
            width: "140%",
            height: "140%",
            background: "radial-gradient(circle, rgba(255, 92, 26, 0.03) 0%, transparent 70%)",
            pointerEvents: "none"
          }} />

          {/* Product Badge */}
          <div style={{
            background: "#dbd6cc",
            color: "#1a2744",
            padding: "6px 16px",
            borderRadius: "30px",
            fontSize: "11px",
            fontWeight: "800",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "2rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ width: "6px", height: "6px", background: "#ff5c1a", borderRadius: "50%" }} />
            Autonomous Protection Suite
          </div>

          {/* Hero Heading */}
          <h1 style={{
            fontSize: "64px",
            fontWeight: "900",
            letterSpacing: "-2.5px",
            fontFamily: "'Outfit', sans-serif",
            color: "#1a2744",
            marginBottom: "1.25rem",
            textTransform: "uppercase",
            lineHeight: "0.95"
          }}>
            SellerShield
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "18px",
            color: "#6e6f73",
            maxWidth: "640px",
            lineHeight: "1.6",
            margin: "0 auto 3.5rem auto",
            fontWeight: "500"
          }}>
            Advanced multi-agent shield defending premium Indian D2C brands against profit leakage, counterfeit reviews, and predatory price warfare.
          </p>

          {/* Launch CTA */}
          <button 
            onClick={() => window.location.href = "/?tab=dashboard"}
            style={{
              background: "#1a2744",
              color: "#ffffff",
              border: "none",
              padding: "16px 36px",
              borderRadius: "30px",
              fontSize: "15px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(26, 39, 68, 0.15)",
              transition: "transform 0.2s ease, background-color 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#ff5c1a";
              e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#1a2744";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Launch Command Center →
          </button>
        </div>

        {/* Feature Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.5rem",
          width: "100%",
          marginTop: "2.5rem"
        }}>
          {features.map((feat) => {
            const isHovered = hoveredCard === feat.id;
            return (
              <div
                key={feat.id}
                onMouseEnter={() => setHoveredCard(feat.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => {
                  if (feat.id === 1) window.location.href = "/?tab=results";
                  if (feat.id === 2) window.location.href = "/reviews";
                  if (feat.id === 3) window.location.href = "/pricing";
                  if (feat.id === 4) window.location.href = "/monitor";
                }}
                style={{
                  background: "#ffffff",
                  border: isHovered ? `1px solid ${feat.color}` : "1px solid rgba(26, 39, 68, 0.05)",
                  borderRadius: "20px",
                  padding: "1.75rem",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isHovered ? "translateY(-6px)" : "translateY(0)",
                  boxShadow: isHovered ? "0 10px 25px rgba(26, 39, 68, 0.06)" : "0 4px 15px rgba(26, 39, 68, 0.01)"
                }}
              >
                <div style={{
                  fontSize: "32px",
                  marginBottom: "1rem",
                  background: isHovered ? `${feat.color}15` : "#faf9f6",
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease"
                }}>
                  {feat.icon}
                </div>
                <h3 style={{
                  fontWeight: "800",
                  fontSize: "16px",
                  color: "#1a2744",
                  marginBottom: "0.5rem"
                }}>
                  {feat.title}
                </h3>
                <p style={{
                  fontSize: "12.5px",
                  color: "#6e6f73",
                  lineHeight: "1.5"
                }}>
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        maxWidth: "1100px",
        width: "100%",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "1.5rem",
        borderTop: "1px solid rgba(26, 39, 68, 0.08)",
        fontSize: "11px",
        color: "#6e6f73"
      }}>
        <div>© 2026 Stride Co. Protection Hub. All rights reserved.</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <a href="/?tab=dashboard" style={{ color: "#1a2744", textDecoration: "none", fontWeight: "700" }}>Dashboard</a>
          <span>•</span>
          <a href="/assistant" style={{ color: "#1a2744", textDecoration: "none", fontWeight: "700" }}>AI Assistant</a>
        </div>
      </footer>
    </div>
  );
}
