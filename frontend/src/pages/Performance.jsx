
import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const emptyForm = {
  employee_id: "",
  review_date: "",
  rating: "3",
  feedback: "",
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
        : Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg).join(", ")
        : "Request failed"
    );
  }

  return data;
}

export default function Performance() {
  const [employees, setEmployees] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    try {
      const [employeeRes, reviewRes] = await Promise.all([
        fetch(`${API_URL}/employees/`, {
          headers: headers(),
        }),
        fetch(`${API_URL}/performance/`, {
          headers: headers(),
        }),
      ]);

      const employeeData = await readResponse(employeeRes);
      const reviewData = await readResponse(reviewRes);

      setEmployees(employeeData);
      setReviews(reviewData);
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
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function openEdit(review) {
    setEditingId(review.id);
    setForm({
      employee_id: String(review.employee_id),
      review_date: review.review_date,
      rating: String(review.rating),
      feedback: review.feedback || "",
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

  async function saveReview(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = editingId
      ? {
          review_date: form.review_date,
          rating: Number(form.rating),
          feedback: form.feedback || null,
        }
      : {
          employee_id: Number(form.employee_id),
          review_date: form.review_date,
          rating: Number(form.rating),
          feedback: form.feedback || null,
        };

    try {
      const response = await fetch(
        editingId
          ? `${API_URL}/performance/${editingId}`
          : `${API_URL}/performance/`,
        {
          method: editingId ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify(payload),
        }
      );

      await readResponse(response);

      closeForm();
      await loadData();
      setMessage(
        editingId
          ? "Performance review updated successfully"
          : "Performance review created successfully"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredReviews = reviews.filter(
    (review) =>
      !filterEmployee ||
      review.employee_id === Number(filterEmployee)
  );

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Employee Performance</h2>

        <button style={styles.primary} onClick={openCreate}>
          + Add Review
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}
      {message && <p style={styles.success}>{message}</p>}

      {showForm && (
        <form onSubmit={saveReview} style={styles.form}>
          <h3>
            {editingId ? "Edit Performance Review" : "Add Performance Review"}
          </h3>

          <label>Employee</label>
          <select
            style={styles.input}
            value={form.employee_id}
            disabled={editingId !== null}
            required
            onChange={(e) =>
              setForm({ ...form, employee_id: e.target.value })
            }
          >
            <option value="">Select Employee</option>
            {employees
              .filter(
                (employee) =>
                  employee.is_active ||
                  String(employee.id) === form.employee_id
              )
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code} - {employee.full_name}
                </option>
              ))}
          </select>

          <label>Review Date</label>
          <input
            type="date"
            style={styles.input}
            value={form.review_date}
            required
            onChange={(e) =>
              setForm({ ...form, review_date: e.target.value })
            }
          />

          <label>Rating (1–5)</label>
          <select
            style={styles.input}
            value={form.rating}
            onChange={(e) =>
              setForm({ ...form, rating: e.target.value })
            }
          >
            {[1, 2, 3, 4, 5].map((rating) => (
              <option key={rating} value={rating}>
                {rating} / 5
              </option>
            ))}
          </select>

          <label>Feedback</label>
          <textarea
            style={styles.input}
            rows={4}
            value={form.feedback}
            onChange={(e) =>
              setForm({ ...form, feedback: e.target.value })
            }
          />

          <div style={styles.actions}>
            <button
              type="submit"
              style={styles.primary}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Review"
                : "Save Review"}
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

        <button
          style={styles.secondary}
          onClick={loadData}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading performance reviews...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.cell}>Employee ID</th>
                <th style={styles.cell}>Employee Name</th>
                <th style={styles.cell}>Review Date</th>
                <th style={styles.cell}>Rating</th>
                <th style={styles.cell}>Feedback</th>
                <th style={styles.cell}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredReviews.map((review) => (
                <tr key={review.id}>
                  <td style={styles.cell}>{review.employee_code}</td>
                  <td style={styles.cell}>{review.employee_name}</td>
                  <td style={styles.cell}>{review.review_date}</td>
                  <td style={styles.cell}>
                    <strong>{review.rating} / 5</strong>
                  </td>
                  <td style={styles.cell}>{review.feedback || "-"}</td>
                  <td style={styles.cell}>
                    <button
                      style={styles.secondary}
                      onClick={() => openEdit(review)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {filteredReviews.length === 0 && (
                <tr>
                  <td colSpan={6} style={styles.cell}>
                    No performance reviews found.
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
  error: {
    color: "#dc2626",
  },
  success: {
    color: "#16a34a",
  },
};
