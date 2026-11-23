
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
  };
}

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    try {
      const [employeeRes, attendanceRes] = await Promise.all([
        fetch(`${API_URL}/employees/`, { headers: headers() }),
        fetch(`${API_URL}/attendance/`, { headers: headers() }),
      ]);

      if (!employeeRes.ok || !attendanceRes.ok) {
        throw new Error("Failed to load attendance data");
      }

      setEmployees(await employeeRes.json());
      setRecords(await attendanceRes.json());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAttendance(action) {
    if (!employeeId) {
      setError("Please select an employee");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/attendance/${action}`,
        {
          method: "POST",
          headers: headers(),
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
            : "Attendance action failed"
        );
      }

      setMessage(data.message);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function employeeCode(id) {
    return (
      employees.find((employee) => employee.id === id)
        ?.employee_code || id
    );
  }

  return (
    <div style={styles.card}>
      <h2>Attendance & Working Hours</h2>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      <div style={styles.controls}>
        <select
          style={styles.input}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
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

        <button
          style={styles.primary}
          disabled={loading}
          onClick={() => handleAttendance("check-in")}
        >
          Check In
        </button>

        <button
          style={styles.secondary}
          disabled={loading}
          onClick={() => handleAttendance("check-out")}
        >
          Check Out
        </button>
      </div>

      <h3>Attendance History</h3>

      <div style={{ overflowX: "auto" }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.cell}>Employee ID</th>
              <th style={styles.cell}>Employee Name</th>
              <th style={styles.cell}>Date</th>
              <th style={styles.cell}>Check In</th>
              <th style={styles.cell}>Check Out</th>
              <th style={styles.cell}>Working Hours</th>
            </tr>
          </thead>

          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td style={styles.cell}>
                  {employeeCode(record.employee_id)}
                </td>
                <td style={styles.cell}>
                  {record.employee_name}
                </td>
                <td style={styles.cell}>
                  {record.attendance_date}
                </td>
                <td style={styles.cell}>
                  {record.check_in
                    ? record.check_in.replace("T", " ").slice(11, 19)
                    : "-"}
                </td>
                <td style={styles.cell}>
                  {record.check_out
                    ? record.check_out.replace("T", " ").slice(11, 19)
                    : "-"}
                </td>
                <td style={styles.cell}>
                  {record.working_hours ?? "In Progress"}
                </td>
              </tr>
            ))}

            {records.length === 0 && (
              <tr>
                <td colSpan={6} style={styles.cell}>
                  No attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
  controls: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "25px",
  },
  input: {
    padding: "11px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    minWidth: "230px",
  },
  primary: {
    padding: "11px 18px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  secondary: {
    padding: "11px 18px",
    background: "#0f766e",
    color: "white",
    border: "none",
    borderRadius: "7px",
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
    whiteSpace: "nowrap",
  },
  error: { color: "#dc2626" },
  success: { color: "#16a34a" },
};
