import { NavLink, Route, Routes } from "react-router-dom";
import Connections from "./pages/Connections";
import DataBrowser from "./pages/DataBrowser";
import IndexManager from "./pages/IndexManager";
import SqlQuery from "./pages/SqlQuery";
import { AppProvider, useAppContext } from "./state/AppContext";

function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

function AppLayout() {
  const {
    state,
    setActiveConnection,
    getConnectionById,
    setSelectedIndex,
    refreshIndices
  } = useAppContext();

  const handleConnectionChange = async (value: string) => {
    await setActiveConnection(value);
    await setSelectedIndex(undefined);
    const connection = getConnectionById(value);
    await refreshIndices(connection);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span style={{ color: '#38bdf8', fontSize: '24px' }}>⚡</span> 
          <span>ES View</span>
        </div>
        
        <div className="sidebar-content">
          <div className="sidebar-section">
            <div className="sidebar-label">Connection</div>
            <select
              className="form-control sidebar-select"
              value={state.lastConnectionId ?? ""}
              onChange={(event) => handleConnectionChange(event.target.value)}
            >
              <option value="">选择连接环境...</option>
              {state.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Menu</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <NavLink to="/data" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>📑</span> 数据浏览
              </NavLink>
              <NavLink to="/sql" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>⌨️</span> 简易SQL操作
              </NavLink>
              <NavLink to="/indices" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>🗂️</span> 索引管理
              </NavLink>
              <NavLink to="/connections" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>⚙️</span> 连接配置
              </NavLink>
            </nav>
          </div>
        </div>

        <div className="sidebar-user">
           {/* Bottom area for version or user info */}
           <div style={{ fontSize: '12px', color: '#64748b' }}>v1.0.0</div>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Connections />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/sql" element={<SqlQuery />} />
          <Route path="/data" element={<DataBrowser />} />
          <Route path="/indices" element={<IndexManager />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
