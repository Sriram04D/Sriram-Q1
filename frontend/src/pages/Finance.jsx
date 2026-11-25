
import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const sections = {
  transactions: "Income & Expenses",
  budgets: "Project Budgets",
  invoices: "Invoices",
  payments: "Payments",
  salaries: "Employee Salaries",
  reports: "Financial Reports",
};

const initialForms = {
  transactions: {
    project_id: "",
    transaction_type: "Expense",
    category: "",
    amount: "",
    transaction_date: "",
    description: "",
  },
  budgets: {
    project_id: "",
    allocated_amount: "",
    description: "",
  },
  invoices: {
    client_id: "",
    project_id: "",
    amount: "",
    invoice_date: "",
    due_date: "",
    description: "",
  },
  payments: {
    invoice_id: "",
    amount: "",
    payment_date: "",
    payment_method: "Bank Transfer",
    reference: "",
  },
  salaries: {
    employee_id: "",
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    basic_salary: "",
    allowances: "0",
    deductions: "0",
  },
};

const columns = {
  transactions: [
    "project_name", "transaction_type", "category",
    "amount", "transaction_date", "description",
  ],
  budgets: [
    "project_name", "allocated_amount",
    "actual_expenses", "remaining_budget", "description",
  ],
  invoices: [
    "invoice_number", "client_name", "project_name",
    "amount", "paid_amount", "balance_amount",
    "invoice_date", "due_date", "status",
  ],
  payments: [
    "invoice_number", "amount", "payment_date",
    "payment_method", "reference",
  ],
  salaries: [
    "employee_code", "employee_name", "month", "year",
    "basic_salary", "allowances", "deductions",
    "net_salary", "status", "payment_date",
  ],
};

const moneyFields = [
  "amount", "allocated_amount", "actual_expenses",
  "remaining_budget", "paid_amount", "balance_amount",
  "basic_salary", "allowances", "deductions", "net_salary",
];

function currency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}

function label(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function today() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

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

export default function Finance() {
  const [section, setSection] = useState("transactions");
  const [records, setRecords] = useState([]);
  const [report, setReport] = useState(null);

  const [options, setOptions] = useState({
    projects: [],
    clients: [],
    client_projects: [],
    employees: [],
  });

  const [invoices, setInvoices] = useState([]);
  const [budgets, setBudgets] = useState([]);

  const [form, setForm] = useState(initialForms.transactions);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [salaryToPay, setSalaryToPay] = useState(null);
  const [paymentDate, setPaymentDate] = useState(today());

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);

    try {
      const [optionData, invoiceData, budgetData, sectionData] =
        await Promise.all([
          request("/finance/options"),
          request("/finance/invoices"),
          request("/finance/budgets"),
          request(`/finance/${section}`),
        ]);

      setOptions(optionData);
      setInvoices(invoiceData);
      setBudgets(budgetData);

      if (section === "reports") {
        setReport(sectionData);
      } else {
        setRecords(sectionData);
      }
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
    setRecords([]);
    setReport(null);
    setForm({ ...(initialForms[value] || {}) });
    setShowForm(false);
    setEditingId(null);
    setSalaryToPay(null);
    setError("");
    setMessage("");
  }

  function openForm() {
    setForm({ ...initialForms[section] });
    setEditingId(null);
    setSalaryToPay(null);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function editBudget(record) {
    setEditingId(record.id);

    setForm({
      project_id: String(record.project_id),
      allocated_amount: String(record.allocated_amount),
      description: record.description || "",
    });

    setShowForm(true);
    setError("");
    setMessage("");
  }

  function changeField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "client_id" && section === "invoices"
        ? { project_id: "" }
        : {}),
    }));
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = { ...form };

      [
        "project_id", "client_id", "employee_id",
        "invoice_id", "month", "year",
      ].forEach((key) => {
        if (key in payload) {
          payload[key] =
            payload[key] === "" ? null : Number(payload[key]);
        }
      });

      if (editingId !== null) {
        await request(
          `/finance/budgets/${editingId}`,
          "PUT",
          payload
        );
      } else {
        await request(`/finance/${section}`, "POST", payload);
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

  async function paySalary(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await request(
        `/finance/salaries/${salaryToPay.id}/pay`,
        "PUT",
        { payment_date: paymentDate }
      );

      setSalaryToPay(null);
      setMessage("Salary paid successfully");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(key) {
    const common = {
      style: styles.input,
      value: form[key],
      onChange: (e) => changeField(key, e.target.value),
    };

    if (key === "project_id") {
      let projects = options.projects;

      if (section === "invoices") {
        projects = projects.filter((project) =>
          options.client_projects.some(
            (item) =>
              item.project_id === project.id &&
              item.client_id === Number(form.client_id)
          )
        );
      }

      if (section === "budgets" && editingId === null) {
        projects = projects.filter(
          (project) =>
            !budgets.some(
              (budget) => budget.project_id === project.id
            )
        );
      }

      return (
        <select
          {...common}
          required={section !== "transactions"}
          disabled={editingId !== null}
        >
          <option value="">
            {section === "transactions"
              ? "General / Organization Expense or Income"
              : "Select Project"}
          </option>

          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      );
    }

    if (key === "client_id") {
      return (
        <select {...common} required>
          <option value="">Select Client</option>

          {options.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company_name}
            </option>
          ))}
        </select>
      );
    }

    if (key === "employee_id") {
      return (
        <select {...common} required>
          <option value="">Select Employee</option>

          {options.employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.employee_code} - {employee.full_name}
            </option>
          ))}
        </select>
      );
    }

    if (key === "invoice_id") {
      return (
        <select {...common} required>
          <option value="">Select Invoice</option>

          {invoices
            .filter((invoice) => Number(invoice.balance_amount) > 0)
            .map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} - {invoice.client_name}
                {" - Balance: "}
                {currency(invoice.balance_amount)}
              </option>
            ))}
        </select>
      );
    }

    if (key === "transaction_type") {
      return (
        <select {...common} required>
          <option>Income</option>
          <option>Expense</option>
        </select>
      );
    }

    if (key === "payment_method") {
      return (
        <select {...common} required>
          {["Cash", "Bank Transfer", "UPI", "Cheque"].map(
            (method) => (
              <option key={method}>{method}</option>
            )
          )}
        </select>
      );
    }

    if (key === "month") {
      return (
        <select {...common} required>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2026, i, 1).toLocaleString("en", {
                month: "long",
              })}
            </option>
          ))}
        </select>
      );
    }

    if (key === "year") {
      return (
        <input
          {...common}
          type="number"
          min="2000"
          max="2100"
          required
        />
      );
    }

    if (moneyFields.includes(key)) {
      const allowZero = ["allowances", "deductions"].includes(key);

      const selectedInvoice = invoices.find(
        (invoice) => invoice.id === Number(form.invoice_id)
      );

      return (
        <input
          {...common}
          type="number"
          min={allowZero ? "0" : "0.01"}
          max={
            section === "payments" && selectedInvoice
              ? selectedInvoice.balance_amount
              : "9999999999.99"
          }
          step="0.01"
          required
        />
      );
    }

    if (key.endsWith("_date")) {
      return (
        <input
          {...common}
          type="date"
          max={
            ["transaction_date", "payment_date"].includes(key)
              ? today()
              : undefined
          }
          required
        />
      );
    }

    if (key === "description") {
      return <textarea {...common} rows={3} />;
    }

    return (
      <input
        {...common}
        maxLength={key === "category" ? 100 : 150}
        required={key !== "reference"}
      />
    );
  }

  function printInvoice(invoice) {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Allow browser pop-ups to print the invoice.");
      return;
    }

    const doc = printWindow.document;

    doc.title = invoice.invoice_number;
    doc.body.style.fontFamily = "Arial, sans-serif";
    doc.body.style.padding = "40px";

    function addText(tag, value) {
      const element = doc.createElement(tag);
      element.textContent = value;
      doc.body.appendChild(element);
    }

    addText("h1", "Studio Lite ERP");
    addText("h2", "Invoice");
    addText("p", `Invoice Number: ${invoice.invoice_number}`);
    addText("p", `Client: ${invoice.client_name}`);
    addText("p", `Project: ${invoice.project_name}`);
    addText("p", `Invoice Date: ${invoice.invoice_date}`);
    addText("p", `Due Date: ${invoice.due_date}`);
    addText("p", `Description: ${invoice.description || "-"}`);

    doc.body.appendChild(doc.createElement("hr"));

    addText("h3", `Total Amount: ${currency(invoice.amount)}`);
    addText("p", `Paid Amount: ${currency(invoice.paid_amount)}`);
    addText("p", `Balance: ${currency(invoice.balance_amount)}`);
    addText("p", `Status: ${invoice.status}`);

    printWindow.focus();
    printWindow.print();
  }

  function renderReports() {
    if (!report) return <p>No report available.</p>;

    const metrics = [
      ["Total Income", report.total_income],
      ["Total Expenses", report.total_expenses],
      ["Net Surplus / Deficit", report.net_surplus],
      ["Total Invoiced", report.total_invoiced],
      ["Received Payments", report.received_payments],
      ["Outstanding Payments", report.outstanding_payments],
      ["Pending Salaries", report.pending_salaries],
      ["Paid Salaries", report.paid_salaries],
    ];

    return (
      <>
        <div style={styles.reportGrid}>
          {metrics.map(([name, value]) => (
            <div key={name} style={styles.metric}>
              <p style={{ color: "#64748b" }}>{name}</p>
              <h2 style={{ color: Number(value) < 0
                ? "#dc2626" : "#172554" }}>
                {currency(value)}
              </h2>
            </div>
          ))}
        </div>

        <h3>Project Budget Report</h3>

        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {[
                  "Project", "Allocated Budget",
                  "Actual Expenses", "Remaining Budget",
                ].map((item) => (
                  <th key={item} style={styles.th}>{item}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {report.project_budgets.map((budget) => (
                <tr key={budget.id}>
                  <td style={styles.td}>{budget.project_name}</td>
                  <td style={styles.td}>
                    {currency(budget.allocated_amount)}
                  </td>
                  <td style={styles.td}>
                    {currency(budget.actual_expenses)}
                  </td>
                  <td style={{
                    ...styles.td,
                    color: Number(budget.remaining_budget) < 0
                      ? "#dc2626" : "#16a34a",
                  }}>
                    {currency(budget.remaining_budget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Finance & Accounts</h2>

      <div style={styles.tabs}>
        {Object.entries(sections).map(([key, name]) => (
          <button
            key={key}
            disabled={saving || loading}
            onClick={() => changeSection(key)}
            style={{
              ...styles.secondary,
              ...(section === key ? styles.primary : {}),
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={styles.header}>
        <h3>{sections[section]}</h3>

        {section !== "reports" && (
          <button
            style={styles.primary}
            disabled={saving || loading}
            onClick={openForm}
          >
            + Add Record
          </button>
        )}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {showForm && (
        <form style={styles.form} onSubmit={saveRecord}>
          <h3>
            {editingId !== null ? "Edit Budget" : "New Record"}
          </h3>

          {Object.keys(form).map((key) => (
            <div key={key} style={styles.field}>
              <label>{label(key)}</label>
              {renderField(key)}
            </div>
          ))}

          {section === "salaries" && (
            <strong>
              Net Salary: {currency(
                Number(form.basic_salary || 0) +
                Number(form.allowances || 0) -
                Number(form.deductions || 0)
              )}
            </strong>
          )}

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

      {salaryToPay && (
        <form style={styles.form} onSubmit={paySalary}>
          <h3>Pay Salary — {salaryToPay.employee_name}</h3>

          <strong>
            Amount: {currency(salaryToPay.net_salary)}
          </strong>

          <label>Payment Date</label>

          <input
            style={styles.input}
            type="date"
            value={paymentDate}
            max={today()}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />

          <div style={styles.actions}>
            <button style={styles.primary} disabled={saving}>
              Confirm Payment
            </button>

            <button
              type="button"
              style={styles.secondary}
              disabled={saving}
              onClick={() => setSalaryToPay(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading records...</p>
      ) : section === "reports" ? (
        renderReports()
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns[section].map((column) => (
                  <th key={column} style={styles.th}>
                    {label(column)}
                  </th>
                ))}

                {["budgets", "invoices", "salaries"].includes(
                  section
                ) && <th style={styles.th}>Action</th>}
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  {columns[section].map((column) => (
                    <td key={column} style={styles.td}>
                      {moneyFields.includes(column)
                        ? currency(record[column])
                        : column === "status" ? (
                          <span style={{
                            fontWeight: "bold",
                            color: record.status === "Paid"
                              ? "#16a34a"
                              : record.status === "Partial"
                                ? "#2563eb"
                                : "#d97706",
                          }}>
                            {record.status}
                          </span>
                        ) : (
                          record[column] ?? "-"
                        )}
                    </td>
                  ))}

                  {section === "budgets" && (
                    <td style={styles.td}>
                      <button
                        style={styles.secondary}
                        disabled={saving}
                        onClick={() => editBudget(record)}
                      >
                        Edit
                      </button>
                    </td>
                  )}

                  {section === "invoices" && (
                    <td style={styles.td}>
                      <button
                        style={styles.secondary}
                        onClick={() => printInvoice(record)}
                      >
                        Print Invoice
                      </button>
                    </td>
                  )}

                  {section === "salaries" && (
                    <td style={styles.td}>
                      {record.status === "Pending" ? (
                        <button
                          style={styles.primary}
                          disabled={saving}
                          onClick={() => {
                            setShowForm(false);
                            setSalaryToPay(record);
                            setPaymentDate(today());
                            setError("");
                            setMessage("");
                          }}
                        >
                          Pay Salary
                        </button>
                      ) : "Paid"}
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
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
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
  reportGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "15px",
    marginBottom: "30px",
  },
  metric: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "20px",
    borderRadius: "10px",
  },
};
