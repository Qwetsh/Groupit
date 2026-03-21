import type { GlobalStats } from '../hooks/useStats';

interface StatsCardsProps {
  stats: GlobalStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div style={styles.grid}>
      <Card label="Élèves évalués" value={`${stats.totalEvalues}/${stats.totalEleves}`}
        sub={`${stats.pourcentageEvalue}%`} color="#2b6cb0" />
      <Card label="Moyenne générale" value={`${stats.moyenne}/20`}
        sub={`Médiane : ${stats.mediane}`} color={stats.moyenne >= 10 ? '#276749' : '#c53030'} />
      <Card label="Sous la moyenne" value={`${stats.nbSousMoyenne}`}
        sub={`${stats.pourcentageSousMoyenne}%`} color="#c53030" />
      <Card label="Note min / max" value={`${stats.noteMin} — ${stats.noteMax}`}
        sub={`Écart-type : ${stats.ecartType}`} color="#744210" />
      <Card label="Moyenne Oral" value={`${stats.moyenneOral}/8`}
        sub="Présentation" color="#2b6cb0" />
      <Card label="Moyenne Sujet" value={`${stats.moyenneSujet}/12`}
        sub="Maîtrise" color="#276749" />
      <Card label="Bien (14-15)" value={`${stats.nbBien}`}
        sub={stats.totalEvalues > 0 ? `${Math.round((stats.nbBien / stats.totalEvalues) * 100)}%` : '—'} color="#2c7a7b" />
      <Card label="Très bien (16+)" value={`${stats.nbTresBien}`}
        sub={stats.totalEvalues > 0 ? `${Math.round((stats.nbTresBien / stats.totalEvalues) * 100)}%` : '—'} color="#276749" />
    </div>
  );
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={styles.card}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '16px 20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
};
