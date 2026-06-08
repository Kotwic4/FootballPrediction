// Position → visual status. 1–2 advance, 3 plays for a best-third spot.
function rowClass(position) {
  if (position <= 2) return 'standings-row advance';
  if (position === 3) return 'standings-row third';
  return 'standings-row out';
}

export function GroupTable({ ranked, complete, group }) {
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>#</th>
          <th className="ta-left">{group ? `Grupa ${group}` : 'Drużyna'}</th>
          <th title="Mecze">M</th>
          <th title="Zwycięstwa">Z</th>
          <th title="Remisy">R</th>
          <th title="Porażki">P</th>
          <th title="Punkty">Pkt</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r) => (
          <tr key={r.team} className={rowClass(r.position)}>
            <td>{r.position}</td>
            <td className="ta-left">
              {r.team}
              {r.tied && <span className="tie-flag" title="Remis nierozstrzygnięty (brak bramek)"> ⚖︎</span>}
            </td>
            <td>{r.played}</td>
            <td>{r.w}</td>
            <td>{r.d}</td>
            <td>{r.l}</td>
            <td className="pts">{r.pts}</td>
          </tr>
        ))}
      </tbody>
      {!complete && (
        <tfoot>
          <tr>
            <td colSpan={7} className="standings-note">
              Grupa niekompletna — uzupełnij wszystkie mecze.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function BestThirdsTable({ thirds, cutoffTied, title = 'Najlepsze trzecie miejsca' }) {
  return (
    <section className="best-thirds">
      <h3>{title}</h3>
      <p className="legend">
        Awansuje <strong>8 najlepszych</strong> drużyn z trzecich miejsc (z 12 grup).
        Ranking wg punktów — bez bramek nie da się rozstrzygnąć wszystkich remisów.
      </p>
      <table className="standings thirds-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="ta-left">Drużyna</th>
            <th>Grupa</th>
            <th>Pkt</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((t) => (
            <tr key={t.team} className={t.advances ? 'standings-row advance' : 'standings-row out'}>
              <td>{t.rank}</td>
              <td className="ta-left">
                {t.team}
                {t.tied && <span className="tie-flag" title="Remis punktowy"> ⚖︎</span>}
              </td>
              <td>{t.group}</td>
              <td className="pts">{t.pts}</td>
              <td>{t.advances ? 'awans' : 'odpada'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cutoffTied && (
        <p className="warn">
          ⚠︎ Remis punktowy na granicy awansu (8./9. miejsce) — wynik nierozstrzygnięty bez bramek.
        </p>
      )}
    </section>
  );
}
