import { useAppContext } from "../state/AppContext";

export default function SqlHistory() {
  const { state, clearHistory } = useAppContext();

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">查询历史</h3>
          <p className="muted" style={{ margin: 0 }}>记录最近执行的 SQL 语句。</p>
        </div>
        {state.history.length > 0 && (
          <button 
            className="btn btn-sm btn-ghost text-danger" 
            onClick={() => {
              if (window.confirm("确定要清空所有查询历史吗？")) {
                clearHistory();
              }
            }}
          >
            清空历史
          </button>
        )}
      </div>
      <div className="card-body" style={{ padding: state.history.length === 0 ? '24px' : '0' }}>
        {state.history.length === 0 && <p className="muted" style={{ textAlign: 'center', margin: 0 }}>暂无历史记录</p>}
        {state.history.length > 0 && (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '200px' }}>标题</th>
                  <th style={{ width: '180px' }}>时间</th>
                  <th>SQL</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td style={{ fontSize: '12px', color: '#86868b' }}>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>
                      <pre style={{ 
                        margin: 0, 
                        whiteSpace: 'pre-wrap', 
                        wordBreak: 'break-all',
                        fontSize: '12px',
                        background: '#f5f5f7',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        color: '#48484a',
                        border: '1px solid rgba(0,0,0,0.02)'
                      }}>{item.sql}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
