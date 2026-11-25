
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const statuses = ["Pending", "In Progress", "Completed"];
const priorities = ["Low", "Medium", "High"];

const emptyForm = {
  project_id: "",
  employee_id: "",
  title: "",
  description: "",
  priority: "Medium",
  deadline: "",
};

async function request(path, method = "GET", body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("token")}`,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Request failed. Check the input."
    );
  }

  return data;
}

export default function Tasks({ canManageTasks = false }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [logs, setLogs] = useState([]);

  const [logForm, setLogForm] = useState({
    work_date: "",
    hours: "",
    description: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadTasks() {
    setTasks(await request("/tasks/"));
  }

  async function loadData() {
  try {
    if (!canManageTasks) {
      await loadTasks();
      return;
    }

    const [taskData, projectData, employeeData] =
      await Promise.all([
        request("/tasks/"),
        request("/projects/"),
        request("/employees/"),
      ]);

    setTasks(taskData);
    setProjects(projectData);
    setEmployees(employeeData);
  } catch (err) {
    setError(err.message);
  }
}

useEffect(() => {
  loadData();
}, [canManageTasks]);

  async function execute(action, successMessage) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await action();
      await loadTasks();
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createTask(event) {
    event.preventDefault();

    await execute(async () => {
      await request("/tasks/", "POST", {
        ...form,
        project_id: Number(form.project_id),
        employee_id: Number(form.employee_id),
      });

      setForm(emptyForm);
      setShowForm(false);
    }, "Task created successfully");
  }

  async function updateTask(task, field, value) {
    await execute(async () => {
      await request(`/tasks/${task.id}`, "PUT", {
        status: task.status,
        priority: task.priority,
        [field]: value,
      });
    }, "Task updated successfully");
  }

  async function reviewTask(taskId, approvalStatus) {
    await execute(async () => {
      await request(`/tasks/${taskId}/approval`, "PUT", {
        approval_status: approvalStatus,
      });
    }, `Task ${approvalStatus.toLowerCase()} successfully`);
  }

  async function openLogs(task) {
    setError("");
    setMessage("");

    try {
      const data = await request(`/tasks/${task.id}/work-logs`);

      setLogs(data);
      setSelectedTask(task);
      setShowForm(false);

      setLogForm({
        work_date: "",
        hours: "",
        description: "",
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function addWorkLog(event) {
    event.preventDefault();

    await execute(async () => {
      await request(
        `/tasks/${selectedTask.id}/work-logs`,
        "POST",
        {
          ...logForm,
          hours: Number(logForm.hours),
        }
      );

      setLogs(
        await request(`/tasks/${selectedTask.id}/work-logs`)
      );

      setLogForm({
        work_date: "",
        hours: "",
        description: "",
      });
    }, "Work log added successfully");
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Task & Workflow Management</h2>
        {canManageTasks && (
        <button
          style={styles.primary}
          disabled={saving}
          onClick={() => {
            setShowForm(!showForm);
            setSelectedTask(null);
          }}
        >
          + Create Task
        </button>)}

      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {/* TASK CREATION */}

      {showForm && (
        <form style={styles.form} onSubmit={createTask}>
          <h3>Create Task</h3>

          <label>Project</label>
          <select
            required
            style={styles.input}
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

          <label>Assign Employee</label>
          <select
            required
            style={styles.input}
            value={form.employee_id}
            onChange={(e) =>
              setForm({ ...form, employee_id: e.target.value })
            }
          >
            <option value="">Select Employee</option>
            {employees
              .filter((employee) => employee.is_active)
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code} - {employee.full_name}
                </option>
              ))}
          </select>

          <label>Task Title</label>
          <input
            required
            maxLength={150}
            style={styles.input}
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
          />

          <label>Description</label>
          <textarea
            style={styles.input}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />

          <label>Priority</label>
          <select
            style={styles.input}
            value={form.priority}
            onChange={(e) =>
              setForm({ ...form, priority: e.target.value })
            }
          >
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>

          <label>Deadline</label>
          <input
            type="date"
            required
            style={styles.input}
            value={form.deadline}
            onChange={(e) =>
              setForm({ ...form, deadline: e.target.value })
            }
          />

          <div style={styles.actions}>
            <button
              style={styles.primary}
              disabled={saving}
            >
              Create Task
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

      {/* WORK LOGS */}

      {selectedTask && (
        <div style={styles.form}>
          <h3>Work Logs — {selectedTask.title}</h3>

          <form style={styles.logForm} onSubmit={addWorkLog}>
            <label>Work Date</label>
            <input
              required
              type="date"
              style={styles.input}
              value={logForm.work_date}
              onChange={(e) =>
                setLogForm({
                  ...logForm,
                  work_date: e.target.value,
                })
              }
            />

            <label>Hours Worked</label>
            <input
              required
              type="number"
              min="0.1"
              max="24"
              step="0.1"
              style={styles.input}
              value={logForm.hours}
              onChange={(e) =>
                setLogForm({
                  ...logForm,
                  hours: e.target.value,
                })
              }
            />

            <label>Work Description</label>
            <input
              maxLength={255}
              style={styles.input}
              value={logForm.description}
              onChange={(e) =>
                setLogForm({
                  ...logForm,
                  description: e.target.value,
                })
              }
            />

            <button
              style={styles.primary}
              disabled={saving}
            >
              Add Work Log
            </button>
          </form>

          <h4>
            Total Hours:{" "}
            {logs.reduce((sum, log) => sum + log.hours, 0).toFixed(2)}
          </h4>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Date</th>
                <th style={styles.cell}>Hours</th>
                <th style={styles.cell}>Description</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={styles.cell}>{log.work_date}</td>
                  <td style={styles.cell}>{log.hours}</td>
                  <td style={styles.cell}>
                    {log.description || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && <p>No work logs yet.</p>}

          <button
            style={styles.secondary}
            disabled={saving}
            onClick={() => setSelectedTask(null)}
          >
            Close Work Logs
          </button>
        </div>
      )}

      {/* KANBAN BOARD */}

      <h3>Task Board</h3>

      <div style={styles.board}>
        {statuses.map((status) => (
          <div key={status} style={styles.column}>
            <h3>
              {status} (
              {tasks.filter((task) => task.status === status).length})
            </h3>

            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <div key={task.id} style={styles.taskCard}>
                  <h4 style={{ margin: 0 }}>{task.title}</h4>

                  <small>{task.project_name}</small>

                  <p>{task.description || "No description"}</p>

                  <small>
                    <strong>Assigned to:</strong>{" "}
                    {task.employee_name}
                  </small>

                  <small>
                    <strong>Deadline:</strong> {task.deadline}
                  </small>

                  {task.reminder && (
                    <span style={styles.reminder}>
                      {task.reminder}
                    </span>
                  )}

                  <label>Priority</label>
                  <select
                    style={styles.input}
                    value={task.priority}
                    disabled={saving}
                    onChange={(e) =>
                      updateTask(task, "priority", e.target.value)
                    }
                  >
                    {priorities.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>

                  <label>Status</label>
                  <select
                    style={styles.input}
                    value={task.status}
                    disabled={saving}
                    onChange={(e) =>
                      updateTask(task, "status", e.target.value)
                    }
                  >
                    {statuses.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>

                  <small>
                    <strong>Approval:</strong>{" "}
                    {task.approval_status}
                  </small>

                  <small>
                    <strong>Total Hours:</strong>{" "}
                    {task.total_hours}
                  </small>

                  <button
                    style={styles.secondary}
                    disabled={saving}
                    onClick={() => openLogs(task)}
                  >
                    Work Logs
                  </button>

                  {canManageTasks &&
  task.status === "Completed" &&
  task.approval_status === "Pending" && (
                      <div style={styles.actions}>
                        <button
                          style={styles.approve}
                          disabled={saving}
                          onClick={() =>
                            reviewTask(task.id, "Approved")
                          }
                        >
                          Approve
                        </button>

                        <button
                          style={styles.reject}
                          disabled={saving}
                          onClick={() =>
                            reviewTask(task.id, "Rejected")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                </div>
              ))}
          </div>
        ))}
      </div>
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

  logForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  input: {
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },

  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(230px, 1fr))",
    gap: "15px",
    overflowX: "auto",
  },

  column: {
    background: "#f1f5f9",
    padding: "15px",
    borderRadius: "10px",
    minHeight: "300px",
  },

  taskCard: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
    background: "white",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    marginBottom: "12px",
    overflowWrap: "anywhere",
  },

  reminder: {
    color: "#dc2626",
    background: "#fee2e2",
    padding: "6px",
    borderRadius: "5px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  actions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  primary: {
    padding: "10px 15px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },

  secondary: {
    padding: "10px 15px",
    background: "#e2e8f0",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },

  approve: {
    padding: "8px 12px",
    background: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  reject: {
    padding: "8px 12px",
    background: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  cell: {
    padding: "10px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left",
  },
};
