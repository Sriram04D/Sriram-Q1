
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  name: "",
  description: "",
  team_ids: [],
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
        : "Request failed"
    );
  }

  return data;
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [managerProject, setManagerProject] = useState(null);
  const [selectedManager, setSelectedManager] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);

    try {
      const [projectRes, teamRes, employeeRes] = await Promise.all([
        fetch(`${API}/projects/`, { headers: authHeaders() }),
        fetch(`${API}/teams/`, { headers: authHeaders() }),
        fetch(`${API}/employees/`, { headers: authHeaders() }),
      ]);

      const projectData = await parseResponse(projectRes);
      const teamData = await parseResponse(teamRes);
      const employeeData = await parseResponse(employeeRes);

      setProjects(projectData);
      setTeams(teamData);
      setEmployees(employeeData);
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

  function openCreate() {
    setManagerProject(null);
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      team_ids: [],
    });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openAllocate(project) {
    setManagerProject(null);
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description || "",
      team_ids: project.team_ids || [],
    });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function toggleTeam(teamId) {
    setForm((previous) => ({
      ...previous,
      team_ids: previous.team_ids.includes(teamId)
        ? previous.team_ids.filter((id) => id !== teamId)
        : [...previous.team_ids, teamId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const isEditing = editingId !== null;

    try {
      const response = await fetch(
        isEditing
          ? `${API}/projects/${editingId}/allocate`
          : `${API}/projects/`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(
            isEditing
              ? { team_ids: form.team_ids }
              : form
          ),
        }
      );

      await parseResponse(response);

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadData();

      setMessage(
        isEditing
          ? "Project teams updated successfully"
          : "Project created successfully"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openManagerAssignment(project) {
    setShowForm(false);
    setManagerProject(project);
    setSelectedManager(
      project.manager_id != null
        ? String(project.manager_id)
        : ""
    );
    setError("");
    setMessage("");
  }

  async function saveManager(event) {
    event.preventDefault();

    if (!selectedManager || !managerProject) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/projects/${managerProject.id}/manager`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            manager_id: Number(selectedManager),
          }),
        }
      );

      await parseResponse(response);

      setManagerProject(null);
      setSelectedManager("");

      await loadData();

      setMessage("Project manager assigned successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
    
async function updateProjectStatus(projectId, status) {
  setSaving(true);
  setError("");
  setMessage("");

  try {
    const response = await fetch(
      `${API}/projects/${projectId}/status`,
      {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      }
    );

    await parseResponse(response);
    await loadData();

    setMessage("Project status updated successfully");
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
}


  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Project Management</h2>

        <button
          style={styles.primary}
          onClick={openCreate}
        >
          + Create Project
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {/* CREATE PROJECT / ASSIGN TEAMS */}

      {showForm && (
        <form style={styles.form} onSubmit={handleSubmit}>
          <h3>
            {editingId !== null
              ? "Update Team Allocation"
              : "Create Project"}
          </h3>

          {editingId === null ? (
            <>
              <label>Project Name</label>

              <input
                style={styles.input}
                required
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
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
            </>
          ) : (
            <p>
              <strong>Project:</strong> {form.name}
            </p>
          )}

          <label>Assign Teams</label>

          <div style={styles.teamBox}>
            {teams
              .filter(
                (team) =>
                  team.is_active ||
                  form.team_ids.includes(team.id)
              )
              .map((team) => (
                <label
                  key={team.id}
                  style={styles.teamRow}
                >
                  <input
                    type="checkbox"
                    checked={form.team_ids.includes(team.id)}
                    onChange={() => toggleTeam(team.id)}
                  />

                  {team.name}
                </label>
              ))}

            {teams.length === 0 && (
              <p>No teams available.</p>
            )}
          </div>

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.primary}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId !== null
                ? "Update Allocation"
                : "Create Project"}
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

      {/* ASSIGN PROJECT MANAGER */}

      {managerProject && (
        <form
          style={styles.form}
          onSubmit={saveManager}
        >
          <h3>Assign Project Manager</h3>

          <p>
            <strong>Project:</strong> {managerProject.name}
          </p>

          <label>Select Employee</label>

          <select
            style={styles.input}
            value={selectedManager}
            required
            onChange={(e) =>
              setSelectedManager(e.target.value)
            }
          >
            <option value="">
              Select Project Manager
            </option>

            {employees
              .filter(
                (employee) =>
                  employee.is_active ||
                  String(employee.id) === selectedManager
              )
              .map((employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                >
                  {employee.employee_code} - {employee.full_name}
                </option>
              ))}
          </select>

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.primary}
              disabled={saving}
            >
              {saving ? "Saving..." : "Assign Manager"}
            </button>

            <button
              type="button"
              style={styles.secondary}
              onClick={() => setManagerProject(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* PROJECT TABLE */}

      {loading ? (
        <p>Loading projects...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Project ID</th>
                <th style={styles.cell}>Project Name</th>
                <th style={styles.cell}>Description</th>
                <th style={styles.cell}>Assigned Teams</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Progress</th>
                <th style={styles.cell}>Project Manager</th>
                
                <th style={styles.cell}>Action</th>
              </tr>
            </thead>

            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td style={styles.cell}>
                    {project.id}
                  </td>

                  <td style={styles.cell}>
                    {project.name}
                  </td>

                  <td style={styles.cell}>
                    {project.description || "-"}
                  </td>

                  <td style={styles.cell}>
                    {project.teams?.length
                      ? project.teams
                          .map((team) => team.name)
                          .join(", ")
                      : "Not allocated"}
                  </td>

<td style={styles.cell}>
  <select
    style={styles.input}
    value={project.status || "Not Started"}
    disabled={saving}
    onChange={(e) =>
      updateProjectStatus(project.id, e.target.value)
    }
  >
    <option value="Not Started">Not Started</option>
    <option value="In Progress">In Progress</option>
    <option value="On Hold">On Hold</option>
    <option value="Completed">Completed</option>
  </select>
</td>


<td style={styles.cell}>
  <div style={styles.progressContainer}>
    <div style={styles.progressTrack}>
      <div
        style={{
          ...styles.progressFill,
          width: `${project.progress || 0}%`,
          background:
            project.progress === 100
              ? "#16a34a"
              : "#2563eb",
        }}
      />
    </div>

    <span style={styles.progressText}>
      {project.progress || 0}%
    </span>

    <small style={styles.milestoneText}>
      {project.completed_milestones || 0}/
      {project.total_milestones || 0} milestones
    </small>
  </div>
</td>



                  <td style={styles.cell}>
                    {project.manager_name
                      ? `${project.manager_code} - ${project.manager_name}`
                      : "Not assigned"}
                  </td>

                  <td style={styles.cell}>
                    <div style={styles.actions}>
                      <button
                        style={styles.secondary}
                        onClick={() => openAllocate(project)}
                      >
                        Assign Teams
                      </button>

                      <button
                        style={styles.secondary}
                        onClick={() =>
                          openManagerAssignment(project)
                        }
                      >
                        Assign Manager
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {projects.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={styles.cell}
                  >
                    No projects created yet.
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
    marginBottom: "20px",
    gap: "15px",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px",
    background: "#f8fafc",
    borderRadius: "10px",
    marginBottom: "20px",
  },

  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
  },

  teamBox: {
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    maxHeight: "180px",
    overflowY: "auto",
  },

  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px",
  },

  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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

  error: {
    color: "#dc2626",
  },

  success: {
    color: "#16a34a",
  },


progressContainer: {
  minWidth: "140px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
},

progressTrack: {
  width: "100%",
  height: "10px",
  background: "#e2e8f0",
  borderRadius: "10px",
  overflow: "hidden",
},

progressFill: {
  height: "100%",
  borderRadius: "10px",
  transition: "width 0.3s ease",
},

progressText: {
  fontSize: "13px",
  fontWeight: "600",
},

milestoneText: {
  fontSize: "12px",
  color: "#64748b",
},

};
