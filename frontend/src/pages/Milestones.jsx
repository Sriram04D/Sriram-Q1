
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  project_id: "",
  title: "",
  deadline: "",
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

async function parseResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg).join(", ")
        : "Request failed"
    );
  }

  return data;
}

export default function Milestones() {
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [filterProject, setFilterProject] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const [projectRes, milestoneRes] = await Promise.all([
        fetch(`${API}/projects/`, {
          headers: authHeaders(),
        }),
        fetch(`${API}/milestones/`, {
          headers: authHeaders(),
        }),
      ]);

      const projectData = await parseResponse(projectRes);
      const milestoneData = await parseResponse(milestoneRes);

      setProjects(projectData);
      setMilestones(milestoneData);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createMilestone(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/milestones/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          project_id: Number(form.project_id),
          title: form.title,
          deadline: form.deadline,
        }),
      });

      await parseResponse(response);

      setForm(emptyForm);
      setShowForm(false);

      await loadData();

      setMessage("Milestone created successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(milestone, status) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/milestones/${milestone.id}/status`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ status }),
        }
      );

      await parseResponse(response);
      await loadData();

      setMessage(`Milestone marked as ${status}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredMilestones = milestones.filter(
    (milestone) =>
      !filterProject ||
      milestone.project_id === Number(filterProject)
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Project Milestones & Deadlines</h2>

        <button
          style={styles.primary}
          onClick={() => {
            setShowForm(true);
            setError("");
            setMessage("");
          }}
        >
          + Add Milestone
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {showForm && (
        <form style={styles.form} onSubmit={createMilestone}>
          <h3>Create Milestone</h3>

          <label>Project</label>

          <select
            style={styles.input}
            required
            value={form.project_id}
            onChange={(e) =>
              setForm({ ...form, project_id: e.target.value })
            }
          >
            <option value="">Select Project</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <label>Milestone Title</label>

          <input
            style={styles.input}
            required
            maxLength={150}
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
          />

          <label>Deadline</label>

          <input
            type="date"
            style={styles.input}
            required
            value={form.deadline}
            onChange={(e) =>
              setForm({ ...form, deadline: e.target.value })
            }
          />

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.primary}
              disabled={saving}
            >
              {saving ? "Saving..." : "Create Milestone"}
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

      <div style={styles.filters}>
        <label>Filter by Project</label>

        <select
          style={styles.input}
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>

          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <button
          style={styles.secondary}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading milestones...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Project</th>
                <th style={styles.cell}>Milestone</th>
                <th style={styles.cell}>Deadline</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredMilestones.map((milestone) => (
                <tr key={milestone.id}>
                  <td style={styles.cell}>
                    {milestone.project_name}
                  </td>

                  <td style={styles.cell}>
                    {milestone.title}
                  </td>

                  <td style={styles.cell}>
                    {milestone.deadline}
                  </td>

                  <td style={styles.cell}>
                    <span
                      style={
                        milestone.status === "Completed"
                          ? styles.completed
                          : styles.pending
                      }
                    >
                      {milestone.status}
                    </span>
                  </td>

                  <td style={styles.cell}>
                    <button
                      style={styles.secondary}
                      disabled={saving}
                      onClick={() =>
                        updateStatus(
                          milestone,
                          milestone.status === "Completed"
                            ? "Pending"
                            : "Completed"
                        )
                      }
                    >
                      {milestone.status === "Completed"
                        ? "Mark Pending"
                        : "Mark Completed"}
                    </button>
                  </td>
                </tr>
              ))}

              {filteredMilestones.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.cell}>
                    No milestones found.
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
  container: {
    background: "white",
    padding: "25px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    marginBottom: "20px",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "#f8fafc",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "20px",
  },

  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
  },

  filters: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginBottom: "20px",
    maxWidth: "300px",
  },

  actions: {
    display: "flex",
    gap: "10px",
  },

  primary: {
    padding: "11px 16px",
    border: "none",
    borderRadius: "7px",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
  },

  secondary: {
    padding: "10px 15px",
    border: "none",
    borderRadius: "7px",
    background: "#e2e8f0",
    cursor: "pointer",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },

  cell: {
    padding: "12px",
    borderBottom: "1px solid #e5e7eb",
    textAlign: "left",
  },

  completed: {
    color: "#16a34a",
    fontWeight: "600",
  },

  pending: {
    color: "#d97706",
    fontWeight: "600",
  },

  error: {
    color: "#dc2626",
  },

  success: {
    color: "#16a34a",
  },
};
