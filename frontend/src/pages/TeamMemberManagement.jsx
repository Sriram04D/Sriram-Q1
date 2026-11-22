
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

export default function TeamMembers({ team, employees, onClose }) {
  const [members, setMembers] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadMembers() {
    try {
      const response = await fetch(
        `${API_URL}/teams/${team.id}/members`,
        { headers: authHeaders() }
      );

      if (!response.ok) {
        throw new Error("Failed to load team members");
      }

      const data = await response.json();
      setMembers(data.members);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, [team.id]);

  const availableEmployees = employees.filter(
    (employee) =>
      employee.department_id === team.department_id &&
      !members.some(
        (member) => member.employee_id === employee.id
      )
  );

  async function addMember(e) {
    e.preventDefault();

    if (!employeeId) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/teams/${team.id}/members`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            employee_id: Number(employeeId),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to add team member"
        );
      }

      setEmployeeId("");
      setMessage("Employee added to team successfully");
      await loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id) {
    if (!window.confirm("Remove this employee from the team?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/teams/${team.id}/members/${id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to remove team member"
        );
      }

      setMessage("Employee removed from team successfully");
      await loadMembers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div>
          <h3 style={{ margin: 0 }}>
            Team Members — {team.name}
          </h3>
          <p style={styles.subtitle}>
            Assign employees to this team
          </p>
        </div>

        <button onClick={onClose} style={styles.secondary}>
          Close
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {team.is_active && (
        <form onSubmit={addMember} style={styles.form}>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={styles.input}
            required
          >
            <option value="">Select Employee</option>
            {availableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name} ({employee.employee_code})
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={saving || !employeeId}
            style={styles.primary}
          >
            {saving ? "Adding..." : "Add Member"}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading members...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Employee ID</th>
                <th style={styles.cell}>Name</th>
                <th style={styles.cell}>Designation</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.employee_id}>
                  <td style={styles.cell}>
                    {member.employee_code}
                  </td>
                  <td style={styles.cell}>
                    {member.full_name}
                  </td>
                  <td style={styles.cell}>
                    {member.designation || "-"}
                  </td>
                  <td style={styles.cell}>
                    {member.is_active ? "Active" : "Inactive"}
                  </td>
                  <td style={styles.cell}>
                    <button
                      onClick={() =>
                        removeMember(member.employee_id)
                      }
                      style={styles.danger}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}

              {members.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.cell}>
                    No members assigned yet.
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
    background: "#f8fafc",
    padding: "22px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    marginTop: "25px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    marginBottom: "20px",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "13px",
  },
  form: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    flex: 1,
    minWidth: "220px",
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
