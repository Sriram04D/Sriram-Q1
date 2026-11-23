
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  employee_id: "",
  leave_type: "Casual Leave",
  start_date: "",
  end_date: "",
  reason: "",
};

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

async function readResponse(response) {
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

export default function LeaveManagement() {
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const [employeeResponse, leaveResponse] =
        await Promise.all([
          fetch(`${API_URL}/employees/`, {
            headers: headers(),
          }),
          fetch(`${API_URL}/leaves/`, {
            headers: headers(),
          }),
        ]);

      const employeeData =
        await readResponse(employeeResponse);
      const leaveData = await readResponse(leaveResponse);

      setEmployees(employeeData);
      setLeaves(leaveData);
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

  async function applyLeave(event) {
    event.preventDefault();

    if (form.end_date < form.start_date) {
      setError("End date cannot be before start date");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/leaves/`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason || null,
        }),
      });

      await readResponse(response);

      setMessage("Leave request submitted successfully");
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function decideLeave(leaveId, status) {
    if (!window.confirm(`${status} this leave request?`)) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/leaves/${leaveId}/decision`,
        {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify({ status }),
        }
      );

      await readResponse(response);

      setMessage(`Leave request ${status.toLowerCase()}`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredLeaves = leaves.filter((leave) => {
    const employeeMatches =
      !filterEmployee ||
      leave.employee_id === Number(filterEmployee);

    const statusMatches =
      !filterStatus || leave.status === filterStatus;

    return employeeMatches && statusMatches;
  });

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Leave Management</h2>

        <button
          style={styles.primary}
          onClick={() => {
            setShowForm(!showForm);
            setError("");
            setMessage("");
          }}
        >
          {showForm ? "Cancel" : "+ Apply Leave"}
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {showForm && (
        <form onSubmit={applyLeave} style={styles.form}>
          <h3>Apply for Leave</h3>

          <label>Employee</label>
          <select
            style={styles.input}
            required
            value={form.employee_id}
            onChange={(e) =>
              setForm({
                ...form,
                employee_id: e.target.value,
              })
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

          <label>Leave Type</label>
          <select
            style={styles.input}
            value={form.leave_type}
            onChange={(e) =>
              setForm({
                ...form,
                leave_type: e.target.value,
              })
            }
          >
            <option>Casual Leave</option>
            <option>Sick Leave</option>
            <option>Earned Leave</option>
            <option>Unpaid Leave</option>
          </select>

          <label>Start Date</label>
          <input
            type="date"
            style={styles.input}
            required
            value={form.start_date}
            onChange={(e) =>
              setForm({
                ...form,
                start_date: e.target.value,
              })
            }
          />

          <label>End Date</label>
          <input
            type="date"
            style={styles.input}
            required
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={(e) =>
              setForm({
                ...form,
                end_date: e.target.value,
              })
            }
          />

          <label>Reason</label>
          <textarea
            style={styles.input}
            rows={3}
            value={form.reason}
            onChange={(e) =>
              setForm({
                ...form,
                reason: e.target.value,
              })
            }
          />

          <button
            type="submit"
            disabled={saving}
            style={styles.primary}
          >
            {saving ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}

      <h3>Leave Requests</h3>

      <div style={styles.filters}>
        <select
          style={styles.input}
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
        >
          <option value="">All Employees</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.employee_code} - {employee.full_name}
            </option>
          ))}
        </select>

        <select
          style={styles.input}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
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
        <p>Loading leave requests...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Employee ID</th>
                <th style={styles.cell}>Name</th>
                <th style={styles.cell}>Leave Type</th>
                <th style={styles.cell}>Start Date</th>
                <th style={styles.cell}>End Date</th>
                <th style={styles.cell}>Reason</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td style={styles.cell}>
                    {leave.employee_code}
                  </td>
                  <td style={styles.cell}>
                    {leave.employee_name}
                  </td>
                  <td style={styles.cell}>
                    {leave.leave_type}
                  </td>
                  <td style={styles.cell}>
                    {leave.start_date}
                  </td>
                  <td style={styles.cell}>
                    {leave.end_date}
                  </td>
                  <td style={styles.cell}>
                    {leave.reason || "-"}
                  </td>
                  <td style={styles.cell}>
                    <span
                      style={{
                        ...styles.status,
                        color:
                          leave.status === "Approved"
                            ? "#15803d"
                            : leave.status === "Rejected"
                            ? "#dc2626"
                            : "#a16207",
                      }}
                    >
                      {leave.status}
                    </span>
                  </td>
                  <td style={styles.cell}>
                    {leave.status === "Pending" ? (
                      <div style={styles.actions}>
                        <button
                          style={styles.approve}
                          disabled={saving}
                          onClick={() =>
                            decideLeave(leave.id, "Approved")
                          }
                        >
                          Approve
                        </button>

                        <button
                          style={styles.reject}
                          disabled={saving}
                          onClick={() =>
                            decideLeave(leave.id, "Rejected")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}

              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.cell}>
                    No leave requests found.
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
  filters: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    fontSize: "14px",
    minWidth: "180px",
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
  actions: {
    display: "flex",
    gap: "8px",
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
    padding: "11px 16px",
    border: "none",
    borderRadius: "7px",
    background: "#e2e8f0",
    cursor: "pointer",
  },
  approve: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    background: "#16a34a",
    color: "white",
    cursor: "pointer",
  },
  reject: {
    padding: "8px 12px",
    border: "none",
    borderRadius: "6px",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
  },
  status: {
    fontWeight: "bold",
  },
  error: {
    color: "#dc2626",
  },
  success: {
    color: "#16a34a",
  },
};
