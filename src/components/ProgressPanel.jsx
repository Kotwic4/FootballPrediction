import { tournament } from '../data/tournament.js';

function Row({ label, done, total }) {
  const complete = done >= total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <li className={complete ? 'progress-row complete' : 'progress-row'}>
      <span className="progress-label">{label}</span>
      <span className="progress-bar">
        <span className="progress-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="progress-num">
        {done}/{total} {complete ? '✓' : ''}
      </span>
    </li>
  );
}

export default function ProgressPanel({ predictions }) {
  const groupDone = Object.keys(predictions.groups).length;
  const groupTotal = tournament.matches.length;

  const rounds = tournament.rounds.map((r) => ({
    id: r.id,
    label: r.label,
    done: predictions.knockout[r.id]?.length ?? 0,
    total: r.count,
  }));

  const allDone =
    groupDone + rounds.reduce((s, r) => s + r.done, 0);
  const allTotal =
    groupTotal + rounds.reduce((s, r) => s + r.total, 0);

  return (
    <details className="progress" open>
      <summary>
        <span className="progress-summary-title">Postęp typów</span>
        <span className="progress-summary-num">{allDone}/{allTotal}</span>
      </summary>
      <ul className="progress-list">
        <Row label="Faza grupowa" done={groupDone} total={groupTotal} />
        {rounds.map((r) => (
          <Row key={r.id} label={r.label} done={r.done} total={r.total} />
        ))}
      </ul>
    </details>
  );
}
