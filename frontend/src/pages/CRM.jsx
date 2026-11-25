
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const sections = {
  clients: "Client Profiles",
  leads: "Leads",
  communications: "Communication History",
  projects: "Client Projects",
  proposals: "Proposals & Quotations",
  feedback: "Client Feedback",
};

const initialForms = {
  clients: {
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
  },
  leads: {
    client_id: "",
    title: "",
    description: "",
  },
  communications: {
    client_id: "",
    communication_date: "",
    communication_type: "Meeting",
    notes: "",
  },
  projects: {
    client_id: "",
    project_id: "",
  },
  proposals: {
    client_id: "",
    title: "",
    description: "",
    amount: "",
    proposal_date: "",
  },
  feedback: {
    client_id: "",
    project_id: "",
    rating: "5",
    comments: "",
    feedback_date: "",
  },
};

const columns = {
  clients: [
    "company_name", "contact_name", "email", "phone", "address"
  ],
  leads: [
    "client_name", "title", "description", "status"
  ],
  communications: [
    "client_name", "communication_date",
    "communication_type", "notes"
  ],
  projects: [
    "client_name", "project_name", "project_status"
  ],
  proposals: [
    "client_name", "title", "description",
    "amount", "proposal_date", "status"
  ],
  feedback: [
    "client_name", "project_name", "rating",
    "comments", "feedback_date"
  ],
};

const leadStatuses = [
  "New", "Contacted", "Qualified", "Converted", "Lost"
];

const proposalStatuses = [
  "Draft", "Sent", "Accepted", "Rejected"
];

async function request(path, method = "GET", body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("token")}`,
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Request failed. Check your input."
    );
  }

  return data;
}

function formatLabel(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CRM() {
  const [section, setSection] = useState("clients");
  const [records, setRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [form, setForm] = useState(initialForms.clients);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    try {
      const [clientData, projectData, allocationData, sectionData] =
        await Promise.all([
          request("/crm/clients"),
          request("/projects/"),
          request("/crm/projects"),
          request(`/crm/${section}`),
        ]);

      setClients(clientData);
      setProjects(projectData);
      setAllocations(allocationData);
      setRecords(sectionData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [section]);

  function changeSection(value) {
    setSection(value);
    setForm({ ...initialForms[value] });
    setShowForm(false);
    setEditingId(null);
    setRecords([]);
    setError("");
    setMessage("");
  }

  function openForm() {
    setForm({ ...initialForms[section] });
    setEditingId(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function editClient(client) {
    setEditingId(client.id);

    setForm({
      company_name: client.company_name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone || "",
      address: client.address || "",
    });

    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function saveRecord(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = { ...form };

      ["client_id", "project_id", "rating", "amount"]
        .forEach((key) => {
          if (key in payload) {
            payload[key] = Number(payload[key]);
          }
        });

      if (editingId !== null) {
        await request(
          `/crm/clients/${editingId}`,
          "PUT",
          payload
        );
      } else {
        await request(`/crm/${section}`, "POST", payload);
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...initialForms[section] });
      setMessage("Record saved successfully");

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id, status) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(
        `/crm/${section}/${id}/status`,
        "PUT",
        { status }
      );

      setMessage("Status updated successfully");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function changeField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "client_id" && section === "feedback"
        ? { project_id: "" }
        : {}),
    }));
  }

  function renderField(key) {
    const common = {
      style: styles.input,
      value: form[key],
      onChange: (e) => changeField(key, e.target.value),
    };

    if (key === "client_id") {
      return (
        <select {...common} required>
          <option value="">Select Client</option>

          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company_name}
            </option>
          ))}
        </select>
      );
    }

    if (key === "project_id") {
      let availableProjects = projects;

      if (section === "projects") {
        availableProjects = projects.filter(
          (project) =>
            !allocations.some(
              (item) => item.project_id === project.id
            )
        );
      }

      if (section === "feedback") {
        availableProjects = projects.filter(
          (project) =>
            allocations.some(
              (item) =>
                item.project_id === project.id &&
                item.client_id === Number(form.client_id)
            )
        );
      }

      return (
        <select {...common} required>
          <option value="">Select Project</option>

          {availableProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      );
    }

    if (key === "communication_type") {
      return (
        <select {...common} required>
          {["Email", "Call", "Meeting", "Other"].map(
            (type) => (
              <option key={type}>{type}</option>
            )
          )}
        </select>
      );
    }

    if (key === "rating") {
      return (
        <select {...common} required>
          {[1, 2, 3, 4, 5].map((rating) => (
            <option key={rating} value={rating}>
              {rating} / 5
            </option>
          ))}
        </select>
      );
    }

    if (key === "amount") {
      return (
        <input
          {...common}
          type="number"
          min="0.01"
          max="9999999999.99"
          step="0.01"
          required
        />
      );
    }

    if (key.endsWith("_date")) {
      return <input {...common} type="date" required />;
    }

    if (
      ["description", "notes", "comments", "address"].includes(key)
    ) {
      return (
        <textarea
          {...common}
          rows={3}
          required={key === "notes"}
        />
      );
    }

    return (
      <input
        {...common}
        type={key === "email" ? "email" : "text"}
        maxLength={key === "phone" ? 20 : 150}
        required={key !== "phone"}
      />
    );
  }

  return (
    <div style={styles.container}>
      <h2>Client & CRM Management</h2>

      <div style={styles.tabs}>
        {Object.entries(sections).map(([key, label]) => (
          <button
            key={key}
            disabled={saving || loading}
            onClick={() => changeSection(key)}
            style={{
              ...styles.tab,
              ...(section === key ? styles.activeTab : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.header}>
        <h3>{sections[section]}</h3>

        <button
          style={styles.primary}
          disabled={saving || loading}
          onClick={openForm}
        >
          + Add Record
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {message && (
        <p style={{ color: "green" }}>{message}</p>
      )}

      {showForm && (
        <form style={styles.form} onSubmit={saveRecord}>
          <h3>
            {editingId !== null ? "Edit Client" : "New Record"}
          </h3>

          {Object.keys(form).map((key) => (
            <div key={key} style={styles.field}>
              <label>{formatLabel(key)}</label>
              {renderField(key)}
            </div>
          ))}

          <div style={styles.actions}>
            <button style={styles.primary} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              style={styles.secondary}
              disabled={saving}
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading records...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns[section].map((column) => (
                  <th key={column} style={styles.th}>
                    {formatLabel(column)}
                  </th>
                ))}

                {section === "clients" && (
                  <th style={styles.th}>Action</th>
                )}
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  {columns[section].map((column) => (
                    <td key={column} style={styles.td}>
                      {column === "status" &&
                      ["leads", "proposals"].includes(section) ? (
                        <select
                          style={styles.input}
                          value={record.status}
                          disabled={saving}
                          onChange={(e) =>
                            updateStatus(
                              record.id,
                              e.target.value
                            )
                          }
                        >
                          {(section === "leads"
                            ? leadStatuses
                            : proposalStatuses
                          ).map((status) => (
                            <option key={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : column === "amount" ? (
                        Number(record.amount).toLocaleString(
                          "en-IN",
                          {
                            style: "currency",
                            currency: "INR",
                          }
                        )
                      ) : column === "rating" ? (
                        `${record.rating} / 5`
                      ) : (
                        record[column] ?? "-"
                      )}
                    </td>
                  ))}

                  {section === "clients" && (
                    <td style={styles.td}>
                      <button
                        style={styles.secondary}
                        disabled={saving}
                        onClick={() => editClient(record)}
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {records.length === 0 && <p>No records found.</p>}
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
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "25px",
  },
  tab: {
    padding: "10px 15px",
    background: "#e2e8f0",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  activeTab: {
    background: "#2563eb",
    color: "white",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
  },
  form: {
    background: "#f8fafc",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "25px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  input: {
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    width: "100%",
    boxSizing: "border-box",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    gap: "10px",
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    padding: "12px",
    background: "#f1f5f9",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e2e8f0",
    textAlign: "left",
  },
};
