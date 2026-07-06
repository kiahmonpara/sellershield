"use client";

import React, { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface Alert {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  module: string;
  title: string;
  description: string;
  action_link: string;
  timestamp: string;
  dismissed: boolean;
}

export default function AlertsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data || []);
        // Active unread alerts are those that are not dismissed
        const active = data.filter((a: Alert) => !a.dismissed);
        setUnreadCount(active.length);
      }
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-poll every 60 seconds
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/dismiss/${alertId}`, {
        method: "POST",
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleDismissAll = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts/dismiss-all`, {
        method: "POST",
      });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error("Failed to dismiss all alerts:", err);
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "#ef4444"; // red
      case "WARNING":
        return "#f59e0b"; // amber
      default:
        return "#3b82f6"; // blue
    }
  };

  const getBgColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "rgba(239, 68, 68, 0.08)";
      case "WARNING":
        return "rgba(245, 158, 11, 0.08)";
      default:
        return "rgba(59, 130, 246, 0.08)";
    }
  };

  return (
    <>
      {/* Bell Button */}
      <div style={{ position: "relative", display: "inline-block" }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            position: "relative",
            padding: "8px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-primary)",
            transition: "background 0.2s",
          }}
          title="Notifications"
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "4px",
                right: "4px",
                background: "#ef4444",
                color: "#fff",
                borderRadius: "50%",
                width: "16px",
                height: "16px",
                fontSize: "10px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 2px #fff",
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Sliding Drawer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.4)",
            zIndex: 999,
            display: "flex",
            justifyContent: "flex-end",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "360px",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.15)",
              display: "flex",
              flexDirection: "column",
              animation: "slideIn 0.25s ease-out",
              position: "relative",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-accent-light, #fafaf9)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: "800",
                    fontFamily: "var(--font-display)",
                    color: "var(--text-primary)",
                  }}
                >
                  Seller Health Alerts
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  Real-time marketplace watchlist
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  fontSize: "20px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                &times;
              </button>
            </div>

            {/* Actions Bar */}
            {alerts.length > 0 && (
              <div
                style={{
                  padding: "10px 20px",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={handleDismissAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ff5c1a",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Dismiss All
                </button>
              </div>
            )}

            {/* Alerts List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {alerts.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                  }}
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    style={{ marginBottom: "12px", opacity: 0.5 }}
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: "600" }}>
                    All Clear!
                  </span>
                  <span style={{ fontSize: "11px" }}>
                    No active threats or alerts at this moment.
                  </span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.action_link) {
                        window.location.href = alert.action_link;
                      }
                    }}
                    style={{
                      borderLeft: `4px solid ${getBorderColor(alert.severity)}`,
                      background: getBgColor(alert.severity),
                      borderRadius: "0 8px 8px 0",
                      padding: "16px",
                      position: "relative",
                      cursor: alert.action_link ? "pointer" : "default",
                      transition: "transform 0.15s",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                    }}
                    onMouseEnter={(e) => {
                      if (alert.action_link) {
                        e.currentTarget.style.transform = "translateX(2px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    {/* Severity & Module Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background:
                            alert.severity === "CRITICAL"
                              ? "#fee2e2"
                              : alert.severity === "WARNING"
                              ? "#fef3c7"
                              : "#dbeafe",
                          color: getBorderColor(alert.severity),
                        }}
                      >
                        {alert.module}
                      </span>
                      <button
                        onClick={(e) => handleDismiss(alert.id, e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-secondary)",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          padding: "4px",
                        }}
                        title="Dismiss"
                      >
                        &times;
                      </button>
                    </div>

                    {/* Alert Title */}
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "800",
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      {alert.title}
                    </div>

                    {/* Alert Description */}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        lineHeight: "1.4",
                        marginBottom: "8px",
                      }}
                    >
                      {alert.description}
                    </div>

                    {/* Timestamp & Action Link */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10px",
                        color: "var(--text-secondary)",
                        marginTop: "8px",
                      }}
                    >
                      <span>{alert.timestamp}</span>
                      {alert.action_link && (
                        <span
                          style={{
                            color: "#ff5c1a",
                            fontWeight: "700",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Resolve →
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
