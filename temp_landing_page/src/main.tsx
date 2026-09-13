import React, { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#090a0f",
          color: "#f87171",
          padding: "32px",
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <h1 style={{ color: "#ef4444", fontSize: "20px", fontWeight: "bold" }}>
            Arayüz Yüklenirken Bir Hata Oluştu
          </h1>
          <div style={{
            background: "#1e1f2b",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid #374151",
            color: "#e2e8f0",
            whiteSpace: "pre-wrap",
            fontSize: "13px"
          }}>
            {this.state.error?.toString()}
            {"\n\n"}
            {this.state.error?.stack}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              width: "fit-content"
            }}
          >
            Sayfayı Yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// PIXEL-PIXEL FRONTEND LOGGING
const sendFrontendLog = (event: string, details: any) => {
  try {
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/logs/frontend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        details,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    }).catch(() => {});
  } catch (e) {}
};

// GLOBAL CLICK TRACKER (Her dokunulan yeri kaydet)
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  // Sadece buton, link veya input gibi etkileşimli öğeleri logla (spam olmasın diye)
  if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('.lucide')) {
    const el = target.closest('button') || target.closest('a') || target.closest('input') || target;
    const details = {
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.textContent?.substring(0, 30)
    };
    sendFrontendLog('CLICK', details);
  }
});

// GLOBAL ERROR TRACKER (Tüm React/JS Hatalarını kaydet)
window.addEventListener('error', (e) => {
  sendFrontendLog('WINDOW_ERROR', { message: e.message, file: e.filename, line: e.lineno });
});

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
