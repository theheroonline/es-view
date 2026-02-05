import { useTranslation } from "react-i18next";
import { NavLink, Route, Routes } from "react-router-dom";
import Connections from "./pages/Connections";
import DataBrowser from "./pages/DataBrowser";
import IndexManager from "./pages/IndexManager";
import RestConsole from "./pages/RestConsole";
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
  const { t, i18n } = useTranslation();
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

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(newLang);
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
            <div className="sidebar-label">{t('sidebar.connection')}</div>
            <select
              className="form-control sidebar-select"
              value={state.lastConnectionId ?? ""}
              onChange={(event) => handleConnectionChange(event.target.value)}
            >
              <option value="">{t('sidebar.connectionPlaceholder')}</option>
              {state.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">{t('sidebar.menu')}</div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <NavLink to="/data" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>📑</span> {t('sidebar.dataBrowser')}
              </NavLink>
              <NavLink to="/sql" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>⌨️</span> {t('sidebar.sqlQuery')}
              </NavLink>
              <NavLink to="/rest" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>🧩</span> {t('sidebar.restConsole')}
              </NavLink>
              <NavLink to="/indices" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>🗂️</span> {t('sidebar.indexManager')}
              </NavLink>
              <NavLink to="/connections" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <span>⚙️</span> {t('sidebar.connections')}
              </NavLink>
            </nav>
          </div>
        </div>

        <div className="sidebar-user">
           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
             <button
               className="btn btn-sm"
               onClick={toggleLanguage}
               title={t('app.switchLanguageTitle', {
                 language: i18n.language === 'zh' ? t('common.english') : t('common.chinese')
               })}
               style={{
                 fontSize: '11px',
                 padding: '4px 10px',
                 color: '#f4f4f5',
                 background: 'rgba(255, 255, 255, 0.08)',
                 border: '1px solid rgba(255, 255, 255, 0.1)',
                 borderRadius: '8px',
                 fontWeight: '500',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '6px',
                 cursor: 'pointer',
                 transition: 'all 0.2s'
               }}
             >
               <span style={{ fontSize: '14px' }}>🌐</span>
               {t('app.switchLanguage', {
                 language: i18n.language === 'zh' ? t('common.english') : t('common.chinese')
               })}
             </button>
           </div>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Connections />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/sql" element={<SqlQuery />} />
          <Route path="/data" element={<DataBrowser />} />
          <Route path="/indices" element={<IndexManager />} />
          <Route path="/rest" element={<RestConsole />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
