type Props = {
  logs: string[]
}

export function SimLog({ logs }: Props) {
  return (
    <section className="panel log-panel">
      <div className="log-header">
        <h2>模擬紀錄</h2>
        <span>共 {logs.length} 筆</span>
      </div>
      <pre className="log-output">{logs.join('\n')}</pre>
    </section>
  )
}
