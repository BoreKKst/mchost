"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@mc-hosting/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
    const id = setInterval(loadHealth, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main>
      <h1>MC Hosting — Этап 1</h1>

      <div className="card">
        <div className="row">
          <span>Backend API</span>
          {health ? (
            <span className="badge">ok</span>
          ) : error ? (
            <span className="badge error">down</span>
          ) : (
            <span className="badge">checking…</span>
          )}
        </div>

        {health && (
          <>
            <div className="row">
              <span>Service</span>
              <span>{health.service}</span>
            </div>
            <div className="row">
              <span>Version</span>
              <span>{health.version}</span>
            </div>
            <div className="row">
              <span>Uptime</span>
              <span>{health.uptimeSeconds} s</span>
            </div>
            <div className="row">
              <span>Timestamp</span>
              <span>{health.timestamp}</span>
            </div>
          </>
        )}

        {error && (
          <div className="row">
            <span>Ошибка</span>
            <span className="badge error">{error}</span>
          </div>
        )}
      </div>

      <button onClick={loadHealth} disabled={loading}>
        {loading ? "Проверка…" : "Проверить снова"}
      </button>

      <p className="muted" style={{ marginTop: 16 }}>
        API URL: {API_URL}
      </p>
    </main>
  );
}