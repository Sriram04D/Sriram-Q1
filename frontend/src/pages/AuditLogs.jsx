
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/audit-logs/`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load audit logs");
      }

      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString();
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Audit Logs</h2>

        <button
          style={styles.primary}
          onClick={loadLogs}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <p style={styles.description}>
        View recorded activities across the ERP system.
      </p>

      {error && <p style={styles.error}>{error}</p>}

      {loading ? (
        <p>Loading audit logs...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Log ID</th>
                <th style={styles.cell}>User</th>
                <th style={styles.cell}>Action</th>
                <th style={styles.cell}>Entity</th>
                <th style={styles.cell}>Entity ID</th>
                <th style={styles.cell}>Date & Time</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={styles.cell}>{log.id}</td>

                  <td style={styles.cell}>
                    {log.username || `User ${log.user_id}`}
                  </td>

                  <td style={styles.cell}>
                    {log.action}
                  </td>

                  <td style={styles.cell}>
                    {log.entity_type}
                  </td>

                  <td style={styles.cell}>
                    {log.entity_id ?? "-"}
                  </td>

                  <td style={styles.cell}>
                    {formatDate(log.created_at)}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={styles.cell}>
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    padding: "25px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "12px",
  },

  description: {
    color: "#64748b",
    marginBottom: "20px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },

  cell: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  primary: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "7px",
    padding: "10px 15px",
    cursor: "pointer",
  },

  error: {
    color: "#dc2626",
  },
};
