
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

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

export default function Resources() {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [resources, setResources] = useState([]);

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const [projectRes, employeeRes] = await Promise.all([
        fetch(`${API}/projects/`, {
          headers: authHeaders(),
        }),
        fetch(`${API}/employees/`, {
          headers: authHeaders(),
        }),
      ]);

      setProjects(await parseResponse(projectRes));
      setEmployees(await parseResponse(employeeRes));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    setResources([]);
    setSelectedEmployees([]);

    if (!selectedProject) {
      setLoading(false);
      return;
    }

    async function fetchResources() {
      setLoading(true);

      try {
        const response = await fetch(
          `${API}/projects/${selectedProject}/resources`,
          { headers: authHeaders() }
        );

        const data = await parseResponse(response);

        if (!cancelled) {
          setResources(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchResources();

    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  async function loadResources(projectId) {
    const response = await fetch(
      `${API}/projects/${projectId}/resources`,
      { headers: authHeaders() }
    );

    setResources(await parseResponse(response));
  }

  function toggleEmployee(employeeId) {
    setSelectedEmployees((previous) =>
      previous.includes(employeeId)
        ? previous.filter((id) => id !== employeeId)
        : [...previous, employeeId]
    );
  }

  async function allocateResources(event) {
    event.preventDefault();

    if (!selectedProject || !selectedEmployees.length) {
      setError("Select a project and at least one employee");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/projects/${selectedProject}/resources`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            employee_ids: selectedEmployees,
          }),
        }
      );

      await parseResponse(response);

      setSelectedEmployees([]);
      await loadResources(selectedProject);

      setMessage("Resources allocated successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeResource(employeeId) {
    if (!window.confirm("Remove this employee from the project?")) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/projects/${selectedProject}/resources/${employeeId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      await parseResponse(response);
      await loadResources(selectedProject);

      setMessage("Resource removed successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const allocatedIds = resources.map(
    (resource) => resource.employee_id
  );

  const availableEmployees = employees.filter(
    (employee) =>
      employee.is_active &&
      !allocatedIds.includes(employee.id)
  );

  return (
    <div style={styles.container}>
      <h2>Project Resource Allocation</h2>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      <div style={styles.form}>
        <label>Select Project</label>

        <select
          style={styles.input}
          value={selectedProject}
          disabled={saving}
          onChange={(e) => {
            setSelectedProject(e.target.value);
            setError("");
            setMessage("");
          }}
        >
          <option value="">Select Project</option>

          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProject && (
        loading ? (
          <p>Loading resources...</p>
        ) : (
          <>
            <form
              style={styles.form}
              onSubmit={allocateResources}
            >
              <h3>Allocate Employees</h3>

              <div style={styles.employeeBox}>
                {availableEmployees.map((employee) => (
                  <label
                    key={employee.id}
                    style={styles.employeeRow}
                  >
                    <input
                      type="checkbox"
                      disabled={saving}
                      checked={selectedEmployees.includes(
                        employee.id
                      )}
                      onChange={() =>
                        toggleEmployee(employee.id)
                      }
                    />

                    {employee.employee_code} - {employee.full_name}
                    {" "}
                    ({employee.designation || "No designation"})
                  </label>
                ))}

                {availableEmployees.length === 0 && (
                  <p>No available employees.</p>
                )}
              </div>

              <button
                type="submit"
                style={styles.primary}
                disabled={
                  saving || selectedEmployees.length === 0
                }
              >
                {saving
                  ? "Saving..."
                  : "Allocate Selected Employees"}
              </button>
            </form>

            <h3>
              Allocated Resources ({resources.length})
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.cell}>Employee Code</th>
                    <th style={styles.cell}>Employee Name</th>
                    <th style={styles.cell}>Designation</th>
                    <th style={styles.cell}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {resources.map((resource) => (
                    <tr key={resource.id}>
                      <td style={styles.cell}>
                        {resource.employee_code}
                      </td>

                      <td style={styles.cell}>
                        {resource.employee_name}
                      </td>

                      <td style={styles.cell}>
                        {resource.designation || "-"}
                      </td>

                      <td style={styles.cell}>
                        <button
                          style={styles.danger}
                          disabled={saving}
                          onClick={() =>
                            removeResource(resource.employee_id)
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                  {resources.length === 0 && (
                    <tr>
                      <td colSpan={4} style={styles.cell}>
                        No employees allocated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )
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

  employeeBox: {
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    maxHeight: "220px",
    overflowY: "auto",
  },

  employeeRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px",
  },

  primary: {
    padding: "11px 16px",
    border: "none",
    borderRadius: "7px",
    background: "#2563eb",
    color: "white",
    cursor: "pointer",
    alignSelf: "flex-start",
  },

  danger: {
    padding: "9px 14px",
    border: "none",
    borderRadius: "7px",
    background: "#fee2e2",
    color: "#dc2626",
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
};
