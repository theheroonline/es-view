import { useAppContext } from "../state/AppContext";

export default function SqlHistory() {
  const { state } = useAppContext();

  return (
    <div className="card">
      <h3>查询历史</h3>
      {state.history.length === 0 && <p className="muted">暂无历史记录</p>}
      {state.history.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>时间</th>
              <th>SQL</th>
            </tr>
          </thead>
          <tbody>
            {state.history.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{new Date(item.createdAt).toLocaleString()}</td>
                <td>
                  <pre>{item.sql}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
