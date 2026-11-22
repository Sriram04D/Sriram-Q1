
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyCompany = {
  name: "",
  email: "",
  phone: "",
  address: "",
  website: "",
};

export default function CompanyProfile() {
  const [company, setCompany] = useState(emptyCompany);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function fetchCompany() {
      try {
        const token = sessionStorage.getItem("token");

        const response = await fetch(`${API_URL}/company/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 404) {
          setEditing(true);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load company profile");
        }

        const data = await response.json();

        setCompany({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          website: data.website || "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCompany();
  }, []);

  function handleChange(e) {
    setCompany({
      ...company,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const token = sessionStorage.getItem("token");

      const response = await fetch(`${API_URL}/company/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(company),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to save company");
      }

      const data = await response.json();

      setCompany({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        website: data.website || "",
      });

      setMessage("Company profile updated successfully!");
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading company profile...</p>;
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>Company Information</h2>
          <p style={styles.subtitle}>
            View and manage organization details
          </p>
        </div>

        {!editing && (
          <button
            style={styles.editButton}
            onClick={() => {
              setMessage("");
              setEditing(true);
            }}
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      <form onSubmit={handleSave}>
        <div style={styles.grid}>
          {[
            ["name", "Company Name"],
            ["email", "Company Email"],
            ["phone", "Phone Number"],
            ["address", "Office Address"],
            ["website", "Website"],
          ].map(([field, label]) => (
            <div key={field} style={styles.field}>
              <label style={styles.label}>{label}</label>

              {editing ? (
                <input
                  type={field === "email" ? "email" : "text"}
                  name={field}
                  value={company[field]}
                  onChange={handleChange}
                  required={field === "name"}
                  minLength={field === "name" ? 2 : undefined}
                  maxLength={field === "name" ? 150 : undefined}
                  style={styles.input}
                />
              ) : (
                <div style={styles.value}>
                  {company[field] || "Not provided"}
                </div>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div style={styles.actions}>
            <button
              type="submit"
              disabled={saving}
              style={styles.saveButton}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              style={styles.cancelButton}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

const styles = {
  card: {
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    maxWidth: "900px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "25px",
    gap: "15px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "25px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: "bold",
  },
  value: {
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "7px",
    minHeight: "43px",
    overflowWrap: "anywhere",
  },
  input: {
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
    width: "100%",
  },
  actions: {
    display: "flex",
    gap: "12px",
    marginTop: "30px",
  },
  editButton: {
    padding: "10px 16px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  saveButton: {
    padding: "11px 18px",
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "11px 18px",
    background: "#e5e7eb",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
  },
  success: {
    color: "#16a34a",
  },
};
