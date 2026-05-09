import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

export default function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect bare engine paths to their default pages
  useEffect(() => {
    if (location.pathname === "/mysql") {
      navigate("/mysql/tables", { replace: true });
    } else if (location.pathname === "/redis") {
      navigate("/redis/browser", { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/mysql" element={<Navigate to="/mysql/tables" replace />} />
      <Route path="/redis" element={<Navigate to="/redis/browser" replace />} />
      <Route path="*" element={null} />
    </Routes>
  );
}
