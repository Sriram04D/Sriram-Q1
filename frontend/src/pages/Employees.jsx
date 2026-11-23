
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  full_name: "",
  phone: "",
  designation: "",
  joining_date: "",
  department_id: "",
};

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const [employeesRes, departmentsRes] = await Promise.all([
        fetch(`${API_URL}/employees/`, {
          headers: authHeaders(),
        }),
        fetch(`${API_URL}/departments/`, {
          headers: authHeaders(),
        }),
      ]);

      if (!employeesRes.ok || !departmentsRes.ok) {
        throw new Error("Failed to load employee data");
      }

      setEmployees(await employeesRes.json());
      setDepartments(await departmentsRes.json());
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
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEdit(employee) {
    setForm({
      full_name: employee.full_name,
      phone: employee.phone || "",
      designation: employee.designation || "",
      joining_date: employee.joining_date || "",
      department_id: String(employee.department_id),
    });

    setEditingId(employee.id);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveEmployee(e) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      designation: form.designation || null,
      joining_date: form.joining_date || null,
      department_id: Number(form.department_id),
    };

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/employees/${editingId}`
          : `${API_URL}/employees/`,
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
            : "Failed to save employee"
        );
      }

      setMessage(
        editingId
          ? "Employee updated successfully"
          : `Employee created successfully. ID: ${data.employee_code}`
      );

      closeForm();
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateEmployee(id) {
    if (!window.confirm("Deactivate this employee?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/employees/${id}`,
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
            : "Failed to deactivate employee"
        );
      }

      setMessage("Employee deactivated successfully");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const keyword = search.toLowerCase();

    return (
      employee.full_name.toLowerCase().includes(keyword) ||
      employee.employee_code.toLowerCase().includes(keyword) ||
      (employee.designation || "").toLowerCase().includes(keyword)
    );
  });

  function departmentName(id) {
    return (
      departments.find((department) => department.id === id)?.name ||
      "Unknown"
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Employee Management</h2>

        <button style={styles.primary} onClick={openCreate}>
          + Add Employee
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {showForm && (
        <form onSubmit={saveEmployee} style={styles.form}>
          <h3>{editingId ? "Edit Employee" : "Add Employee"}</h3>

          <label>Full Name</label>
          <input
            style={styles.input}
            value={form.full_name}
            onChange={(e) =>
              setForm({ ...form, full_name: e.target.value })
            }
            required
            minLength={2}
            maxLength={150}
          />

          <label>Phone</label>
          <input
            style={styles.input}
            value={form.phone}
            onChange={(e) =>
              setForm({ ...form, phone: e.target.value })
            }
          />

          <label>Designation</label>
          <input
            style={styles.input}
            placeholder="e.g. Software Developer"
            value={form.designation}
            onChange={(e) =>
              setForm({ ...form, designation: e.target.value })
            }
          />

          <label>Joining Date</label>
          <input
            type="date"
            style={styles.input}
            value={form.joining_date}
            onChange={(e) =>
              setForm({ ...form, joining_date: e.target.value })
            }
          />

          <label>Department</label>
          <select
            style={styles.input}
            value={form.department_id}
            onChange={(e) =>
              setForm({ ...form, department_id: e.target.value })
            }
            required
          >
            <option value="">Select Department</option>

            {departments
              .filter(
                (department) =>
                  department.is_active ||
                  String(department.id) === form.department_id
              )
              .map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
          </select>

          <div style={styles.actions}>
            <button
              type="submit"
              disabled={saving}
              style={styles.primary}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Employee"
                : "Create Employee"}
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

      <input
        style={{ ...styles.input, marginBottom: "20px", width: "100%" }}
        placeholder="Search by name, employee ID, or designation..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p>Loading employees...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Employee ID</th>
                <th style={styles.cell}>Name</th>
                <th style={styles.cell}>Department</th>
                <th style={styles.cell}>Designation</th>
                <th style={styles.cell}>Phone</th>
                <th style={styles.cell}>Joining Date</th>
                <th style={styles.cell}>Status</th>
                <th style={styles.cell}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td style={styles.cell}>
                    {employee.employee_code}
                  </td>
                  <td style={styles.cell}>
                    {employee.full_name}
                  </td>
                  <td style={styles.cell}>
                    {departmentName(employee.department_id)}
                  </td>
                  <td style={styles.cell}>
                    {employee.designation || "-"}
                  </td>
                  <td style={styles.cell}>
                    {employee.phone || "-"}
                  </td>
                  <td style={styles.cell}>
                    {employee.joining_date || "-"}
                  </td>
                  <td style={styles.cell}>
                    {employee.is_active ? "Active" : "Inactive"}
                  </td>
                  <td style={styles.cell}>
                    <div style={styles.actions}>
                      <button
                        style={styles.secondary}
                        onClick={() => openEdit(employee)}
                      >
                        Edit
                      </button>

                      {employee.is_active && (
                        <button
                          style={styles.danger}
                          onClick={() =>
                            deactivateEmployee(employee.id)
                          }
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} style={styles.cell}>
                    No employees found.
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
    whiteSpace: "nowrap",
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
