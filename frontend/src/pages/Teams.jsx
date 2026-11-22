
import { useEffect, useState } from "react";
import TeamMembers from "./TeamMemberManagement";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  name: "",
  description: "",
  department_id: "",
  team_lead_id: "",
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [selectedTeam, setSelectedTeam] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [teamsRes, departmentsRes, employeesRes] =
        await Promise.all([
          fetch(`${API_URL}/teams/`, {
            headers: authHeaders(),
          }),
          fetch(`${API_URL}/departments/`, {
            headers: authHeaders(),
          }),
          fetch(`${API_URL}/employees/`, {
            headers: authHeaders(),
          }),
        ]);

      if (
        !teamsRes.ok ||
        !departmentsRes.ok ||
        !employeesRes.ok
      ) {
        throw new Error("Failed to load team management data");
      }

      const teamsData = await teamsRes.json();
      const departmentsData = await departmentsRes.json();
      const employeesData = await employeesRes.json();

      setTeams(teamsData);
      setDepartments(departmentsData);
      setEmployees(employeesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEdit(team) {
    setEditingId(team.id);

    setForm({
      name: team.name,
      description: team.description || "",
      department_id: String(team.department_id),
      team_lead_id: team.team_lead_id
        ? String(team.team_lead_id)
        : "",
    });

    setShowForm(true);
    setError("");
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveTeam(e) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      description: form.description,
      team_lead_id: form.team_lead_id
        ? Number(form.team_lead_id)
        : null,
    };

    if (!editingId) {
      payload.department_id = Number(form.department_id);
    }

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/teams/${editingId}`
          : `${API_URL}/teams/`,
        {
          method: editingId ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to save team"
        );
      }

      setMessage(
        editingId
          ? "Team updated successfully"
          : "Team created successfully"
      );

      closeForm();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateTeam(id) {
    if (!window.confirm("Deactivate this team?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/teams/${id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to deactivate team"
        );
      }

      setMessage("Team deactivated successfully");

      if (selectedTeam?.id === id) {
        setSelectedTeam(null);
      }

      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const eligibleLeads = employees.filter(
    (employee) =>
      employee.department_id === Number(form.department_id) &&
      employee.is_active !== false
  );

  return (
    <div style={styles.card}>
      {/* Page Header */}
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>
          Team Management
        </h2>

        <button
          style={styles.primary}
          onClick={openCreate}
        >
          + Add Team
        </button>
      </div>

      {/* Messages */}
      {error && (
        <p style={styles.error}>{error}</p>
      )}

      {message && (
        <p style={styles.success}>{message}</p>
      )}

      {/* Create / Edit Team Form */}
      {showForm && (
        <form
          onSubmit={saveTeam}
          style={styles.form}
        >
          <h3>
            {editingId ? "Edit Team" : "Create Team"}
          </h3>

          <label>Team Name</label>
          <input
            style={styles.input}
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            required
            minLength={2}
            maxLength={100}
          />

          <label>Description</label>
          <textarea
            style={styles.input}
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
          />

          <label>Department</label>
          <select
            style={styles.input}
            value={form.department_id}
            disabled={Boolean(editingId)}
            onChange={(e) =>
              setForm({
                ...form,
                department_id: e.target.value,
                team_lead_id: "",
              })
            }
            required
          >
            <option value="">
              Select Department
            </option>

            {departments
              .filter(
                (department) => department.is_active
              )
              .map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
          </select>

          <label>Team Lead (Optional)</label>
          <select
            style={styles.input}
            value={form.team_lead_id}
            onChange={(e) =>
              setForm({
                ...form,
                team_lead_id: e.target.value,
              })
            }
          >
            <option value="">
              No Team Lead
            </option>

            {eligibleLeads.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.full_name}
              </option>
            ))}
          </select>

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.primary}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Team"
                : "Create Team"}
            </button>

            <button
              type="button"
              style={styles.secondary}
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Teams Table */}
      {loading ? (
        <p>Loading teams...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>
                  Team
                </th>
                <th style={styles.cell}>
                  Department
                </th>
                <th style={styles.cell}>
                  Team Lead
                </th>
                <th style={styles.cell}>
                  Status
                </th>
                <th style={styles.cell}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td style={styles.cell}>
                    {team.name}
                  </td>

                  <td style={styles.cell}>
                    {team.department_name}
                  </td>

                  <td style={styles.cell}>
                    {team.team_lead_name ||
                      "Not Assigned"}
                  </td>

                  <td style={styles.cell}>
                    {team.is_active
                      ? "Active"
                      : "Inactive"}
                  </td>

                  <td style={styles.cell}>
                    <div style={styles.actions}>
                      <button
                        style={styles.secondary}
                        onClick={() =>
                          openEdit(team)
                        }
                      >
                        Edit
                      </button>

                      <button
                        style={styles.secondary}
                        onClick={() => {
                          setSelectedTeam(team);
                          setError("");
                          setMessage("");
                        }}
                      >
                        Members
                      </button>

                      {team.is_active && (
                        <button
                          style={styles.danger}
                          onClick={() =>
                            deactivateTeam(team.id)
                          }
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {teams.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={styles.cell}
                  >
                    No teams found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Members Section */}
      {selectedTeam && (
        <TeamMembers
          key={selectedTeam.id}
          team={selectedTeam}
          employees={employees}
          onClose={() =>
            setSelectedTeam(null)
          }
        />
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
    alignItems: "center",
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

  error: {
    color: "#dc2626",
  },

  success: {
    color: "#16a34a",
  },
};
