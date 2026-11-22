
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = { name: "", description: "" };

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  });

  async function loadDepartments() {
    try {
      const response = await fetch(`${API_URL}/departments/`, {
        headers: headers(),
      });
      if (!response.ok) throw new Error("Failed to load departments");
      setDepartments(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEdit(department) {
    setForm({
      name: department.name,
      description: department.description || "",
    });
    setEditingId(department.id);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/departments/${editingId}`
          : `${API_URL}/departments/`,
        {
          method: editingId ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to save department"
        );
      }

      setMessage(
        editingId
          ? "Department updated successfully"
          : "Department created successfully"
      );
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadDepartments();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateDepartment(id) {
    if (!window.confirm("Deactivate this department?")) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/departments/${id}`,
        {
          method: "DELETE",
          headers: headers(),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to deactivate department");
      }

      setMessage("Department deactivated successfully");
      await loadDepartments();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2>Department Management</h2>
        <button style={styles.primary} onClick={openCreate}>
          + Add Department
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <h3>{editingId ? "Edit Department" : "Add Department"}</h3>

          <label>Department Name</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            required
            minLength={2}
            maxLength={100}
          />

          <label>Description</label>
          <textarea
            style={styles.input}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={3}
          />

          <div style={styles.actions}>
            <button type="submit" disabled={saving} style={styles.primary}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading departments...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>ID</th>
                <th style={styles.cell}>Department</th>
                <th style={styles.cell}>Description</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id}>
                  <td style={styles.cell}>{department.id}</td>
                  <td style={styles.cell}>{department.name}</td>
                  <td style={styles.cell}>
                    {department.description || "-"}
                  </td>
                  <td style={styles.cell}>
                    {department.is_active ? "Active" : "Inactive"}
                  </td>
                  <td style={styles.cell}>
                    <div style={styles.actions}>
                      <button
                        style={styles.secondary}
                        onClick={() => openEdit(department)}
                      >
                        Edit
                      </button>
                      {department.is_active && (
                        <button
                          style={styles.danger}
                          onClick={() =>
                            deactivateDepartment(department.id)
                          }
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.cell}>
                    No departments found.
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
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "#f8fafc",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "25px",
  },
  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  cell: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
  },
  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  primary: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "7px",
    padding: "10px 15px",
    cursor: "pointer",
  },
  secondary: {
    background: "#e2e8f0",
    border: "none",
    borderRadius: "7px",
    padding: "9px 13px",
    cursor: "pointer",
  },
  danger: {
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "7px",
    padding: "9px 13px",
    cursor: "pointer",
  },
  error: { color: "#dc2626" },
  success: { color: "#16a34a" },
};
