
import { useEffect,useState } from "react";
import Resources from "./Resources";
import CompanyProfile from "./CompanyProfile";
import Departments from "./Departments";
import Teams from "./Teams";
import AuditLogs from "./AuditLogs";
import Employees from "./Employees";
import Attendance from "./Attendance";
import LeaveManagement from "./LeaveManagement";
import Performance from "./Performance";
import Projects from "./Projects";
import Milestones from "./Milestones";
import Tasks from "./Tasks";

export default function Dashboard({ onLogout }) {
  const [activePage, setActivePage] = useState("Dashboard");

const [role, setRole] = useState("");
const [authError, setAuthError] = useState("");

useEffect(() => {
  const API =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  fetch(`${API}/auth/me`, {
    headers: {
      Authorization: `Bearer ${sessionStorage.getItem("token")}`,
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Unable to load user");
      return res.json();
    })
    .then((data) => {
      if (!data.role_name) throw new Error("Role not found");
      setRole(data.role_name);
    })
    .catch((err) => setAuthError(err.message));
}, []);

const canManageTasks = ["Admin", "Project Manager"].includes(role);

  const allMenuItems = [
    "Dashboard",
    "Company Profile",
    "Departments",
    "Teams",
    "Projects",
    "Milestones",
    "Resources",
    "Tasks",
    "Employees",
    "Attendance",
    "Leave Management",
    "Performance",
    "Audit Logs",
  ];

  const menuItems =
  role === "Employee"
    ? ["Dashboard", "Tasks"]
    : allMenuItems;

if (authError) return <p>{authError}</p>;
if (!role) return <p>Loading...</p>;

  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <h2 style={styles.logo}>Studio Lite ERP</h2>

        <nav style={styles.navigation}>
          {menuItems.map((item) => (
            <button
              key={item}
              onClick={() => setActivePage(item)}
              style={{
                ...styles.menuButton,
                ...(activePage === item ? styles.activeMenu : {}),
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <button onClick={onLogout} style={styles.logout}>
          Logout
        </button>
      </aside>

      <main style={styles.main}>
        <header style={styles.header}>
          <h2>{activePage}</h2>
          <span style={styles.adminBadge}>{role} Panel</span>
        </header>

        <section style={styles.content}>
          {activePage === "Dashboard" ? (
            <>
              <h2>Welcome to Studio Lite ERP</h2>
              <p>Manage your organization from one place.</p>
            </>
          ) : activePage === "Company Profile" ? (
            <CompanyProfile />
          ) : activePage === "Departments" ? (
            <Departments />
          ) : activePage === "Teams" ? (
            <Teams />
          ) : activePage === "Projects" ? (
  <Projects />
          ) : activePage === "Milestones" ? (
  <Milestones />
          ) : activePage === "Resources" ? (
  <Resources />
          ) : activePage === "Tasks" ? (
  <Tasks canManageTasks={canManageTasks} />
  
          ) : activePage === "Employees" ? (
            <Employees />
          ) : activePage === "Attendance" ? (
            <Attendance />
           ) : activePage === "Leave Management" ? (
    <LeaveManagement />
          ) : activePage === "Performance" ? (
    <Performance />
          ) : activePage === "Audit Logs" ? (
            <AuditLogs />
          ) : (
            <div style={styles.placeholder}>
              <h3>{activePage}</h3>
              <p>This page will be connected next.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif",
    background: "#f3f6fb",
  },
  sidebar: {
    width: "240px",
    background: "#172554",
    color: "white",
    padding: "25px 15px",
    display: "flex",
    flexDirection: "column",
  },
  logo: {
    fontSize: "21px",
    marginBottom: "35px",
    paddingLeft: "10px",
  },
  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  menuButton: {
    padding: "13px",
    border: "none",
    borderRadius: "7px",
    textAlign: "left",
    cursor: "pointer",
    background: "transparent",
    color: "white",
    fontSize: "15px",
  },
  activeMenu: {
    background: "#2563eb",
    fontWeight: "bold",
  },
  logout: {
    marginTop: "auto",
    padding: "12px",
    border: "none",
    borderRadius: "7px",
    background: "#dc2626",
    color: "white",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    padding: "20px 30px",
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adminBadge: {
    background: "#dbeafe",
    color: "#1d4ed8",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "13px",
  },
  content: {
    padding: "30px",
  },
  placeholder: {
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
};
