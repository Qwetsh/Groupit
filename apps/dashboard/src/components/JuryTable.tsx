import type { FinalScoreRow, CriteriaConfig } from '@groupit/shared';
import type { JuryWithEleves } from '../hooks/useSessionData';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface JuryTableProps {
  jurys: JuryWithEleves[];
  criteriaConfig: CriteriaConfig;
  maxTotal: number;
  maxByCategory: Record<string, number>;
}

// Mapping legacy colonnes pour fallback
const LEGACY_SCORE_KEYS: Record<string, keyof FinalScoreRow> = {
  expression: 'score_expression',
  diaporama: 'score_diaporama',
  reactivite: 'score_reactivite',
  contenu: 'score_contenu',
  structure: 'score_structure',
  engagement: 'score_engagement',
};

function getScoreValue(fs: FinalScoreRow, criterionId: string): number | null {
  if (fs.scores && typeof fs.scores === 'object' && criterionId in fs.scores) {
    return (fs.scores as Record<string, number>)[criterionId]!;
  }
  const legacyKey = LEGACY_SCORE_KEYS[criterionId];
  if (legacyKey) {
    const val = fs[legacyKey];
    return typeof val === 'number' ? val : null;
  }
  return null;
}

function getCategoryTotal(fs: FinalScoreRow, categoryId: string, config: CriteriaConfig): number {
  return config.criteria
    .filter(c => c.categoryId === categoryId)
    .reduce((sum, c) => sum + (getScoreValue(fs, c.id) ?? 0), 0);
}

function getScoreColor(total: number, maxTotal: number): string {
  const pct = total / maxTotal;
  if (pct >= 0.8) return '#276749';
  if (pct >= 0.7) return '#2c7a7b';
  if (pct >= 0.5) return '#2b6cb0';
  return '#c53030';
}

function getScoreBg(total: number, maxTotal: number): string {
  const pct = total / maxTotal;
  if (pct >= 0.8) return '#c6f6d5';
  if (pct >= 0.7) return '#b2f5ea';
  if (pct >= 0.5) return '#ebf4ff';
  return '#fed7d7';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'validated': return { label: '✓', bg: '#c6f6d5', color: '#276749' };
    case 'scored': return { label: '⏳', bg: '#fefcbf', color: '#975a16' };
    case 'in_progress': return { label: '📌', bg: '#bee3f8', color: '#2b6cb0' };
    case 'absent': return { label: 'ABS', bg: '#fed7d7', color: '#9b2c2c' };
    case 'lobby': return { label: '…', bg: '#e9d8fd', color: '#6b46c1' };
    default: return { label: '—', bg: '#f1f5f9', color: '#94a3b8' };
  }
}

export function JuryTable({ jurys, criteriaConfig, maxTotal, maxByCategory }: JuryTableProps) {
  return (
    <div>
      {jurys.map(jury => {
        const evalues = jury.eleves.filter(e => jury.finalScores.has(e.id)).length;
        return (
          <div key={jury.id} style={styles.juryBlock}>
            <div style={styles.juryHeader}>
              <div>
                <span style={styles.juryName}>{jury.jury_name}</span>
                {jury.salle && <span style={styles.jurySalle}>Salle {jury.salle}</span>}
              </div>
              <div style={styles.juryMeta}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: jury.connected ? '#c6f6d5' : '#f1f5f9',
                  color: jury.connected ? '#276749' : '#94a3b8',
                }}>
                  {jury.connected ? '● Connecté' : '○ Hors ligne'}
                </span>
                <span style={{ fontSize: 13, color: '#64748b' }}>
                  {evalues}/{jury.eleves.length} évalué{evalues > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Élève</th>
                  <th style={styles.th}>Classe</th>
                  <th style={styles.th}>Parcours</th>
                  <th style={styles.th}>Statut</th>
                  {criteriaConfig.criteria.map(c => (
                    <th key={c.id} style={{ ...styles.th, ...styles.thSmall }} title={c.label}>
                      {c.label.split(' ')[0]?.slice(0, 4)}
                    </th>
                  ))}
                  {criteriaConfig.categories.map(cat => (
                    <th key={cat.id} style={{ ...styles.th, textAlign: 'center' as const }}>
                      {cat.emoji || ''} /{maxByCategory[cat.id] ?? 0}
                    </th>
                  ))}
                  <th style={{ ...styles.th, textAlign: 'center' as const, fontWeight: 800 }}>Total</th>
                  <th style={{ ...styles.th, textAlign: 'center' as const }}>Durée</th>
                </tr>
              </thead>
              <tbody>
                {jury.eleves.map(eleve => {
                  const fs = jury.finalScores.get(eleve.id);
                  const badge = getStatusBadge(eleve.status);
                  const hasGroupe = eleve.groupe_oral_id != null;
                  // Detect group size by counting members with same groupe_oral_id
                  const groupSize = hasGroupe
                    ? jury.eleves.filter(e => e.groupe_oral_id === eleve.groupe_oral_id).length
                    : 0;
                  const groupLabel = groupSize === 3 ? 'Trinome' : 'Binome';
                  return (
                    <tr key={eleve.id} style={{
                      ...styles.tr,
                      ...(hasGroupe ? { borderLeft: '3px solid #6b46c1' } : {}),
                    }}>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 600 }}>{eleve.display_name}</span>
                        {hasGroupe && <span style={styles.binomeBadge}>{groupLabel}</span>}
                        {eleve.langue && <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#2b6cb0',
                          background: '#ebf4ff',
                          padding: '1px 5px',
                          borderRadius: 4,
                          marginLeft: 6,
                          verticalAlign: 'middle',
                        }}>🌐 {eleve.langue}</span>}
                      </td>
                      <td style={styles.td}>{eleve.classe}</td>
                      <td style={styles.td}>
                        <span style={styles.parcoursBadge}>{eleve.parcours || '—'}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 600,
                          background: badge.bg,
                          color: badge.color,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      {criteriaConfig.criteria.map(c => (
                        <td key={c.id} style={{ ...styles.td, textAlign: 'center' as const, fontSize: 12 }}>
                          {fs ? `${getScoreValue(fs, c.id) ?? '—'}` : '—'}
                        </td>
                      ))}
                      {criteriaConfig.categories.map(cat => (
                        <td key={cat.id} style={{ ...styles.td, textAlign: 'center' as const, fontWeight: 600, color: '#2b6cb0' }}>
                          {fs ? `${getCategoryTotal(fs, cat.id, criteriaConfig)}` : '—'}
                        </td>
                      ))}
                      <td style={{
                        ...styles.td,
                        textAlign: 'center' as const,
                        fontWeight: 800,
                        fontSize: 15,
                        color: fs ? getScoreColor(fs.total, maxTotal) : '#94a3b8',
                        background: fs ? getScoreBg(fs.total, maxTotal) : 'transparent',
                        borderRadius: 6,
                      }}>
                        {fs ? `${fs.total}` : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' as const, fontSize: 12, color: '#64748b' }}>
                        {formatDuration(eleve.duree_passage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Observations */}
            {jury.eleves.some(e => {
              const fs = jury.finalScores.get(e.id);
              return fs && (fs.points_forts || fs.axes_amelioration);
            }) && (
              <details style={styles.details}>
                <summary style={styles.summary}>Observations détaillées</summary>
                {jury.eleves.map(eleve => {
                  const fs = jury.finalScores.get(eleve.id);
                  if (!fs || (!fs.points_forts && !fs.axes_amelioration)) return null;
                  return (
                    <div key={eleve.id} style={styles.observation}>
                      <span style={{ fontWeight: 600 }}>{eleve.display_name}</span>
                      {fs.points_forts && <span style={styles.obsPF}>✅ {fs.points_forts}</span>}
                      {fs.axes_amelioration && <span style={styles.obsAA}>📌 {fs.axes_amelioration}</span>}
                    </div>
                  );
                })}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  juryBlock: {
    background: '#fff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  juryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  juryName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
  },
  jurySalle: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 8,
  },
  juryMeta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left' as const,
    borderBottom: '2px solid #e2e8f0',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    whiteSpace: 'nowrap' as const,
  },
  thSmall: {
    textAlign: 'center' as const,
    padding: '8px 4px',
    maxWidth: 50,
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
  },
  td: {
    padding: '8px 10px',
    verticalAlign: 'middle' as const,
  },
  binomeBadge: {
    fontSize: 9,
    fontWeight: 700,
    color: '#6b46c1',
    background: '#e9d8fd',
    padding: '1px 5px',
    borderRadius: 4,
    marginLeft: 6,
    verticalAlign: 'middle',
  },
  parcoursBadge: {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    background: '#f1f5f9',
    color: '#475569',
  },
  details: {
    padding: '0 20px 12px',
  },
  summary: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748b',
    cursor: 'pointer',
    padding: '8px 0',
  },
  observation: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    padding: '6px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 12,
  },
  obsPF: {
    color: '#276749',
  },
  obsAA: {
    color: '#975a16',
  },
};
