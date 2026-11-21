
import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Connecting to backend...");

  useEffect(() => {
    const fetchBackend = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/health`
        );

        if (!response.ok) {
          throw new Error("Backend request failed");
        }

        const data = await response.json();

        setMessage(
          data.status === "healthy"
            ? "React and FastAPI connected successfully!"
            : "Unexpected backend response"
        );
      } catch (error) {
        console.error(error);
        setMessage("Failed to connect to FastAPI");
      }
    };

    fetchBackend();
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Studio Lite ERP</h1>
      <h2>{message}</h2>
    </div>
  );
}

export default App;
