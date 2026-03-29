import { computeMaxByCategory, computeMaxTotal } from '@groupit/shared';
import type { FinalScoreRow, CriteriaConfig } from '@groupit/shared';
import type { JuryWithEleves } from '../hooks/useSessionData';

interface ExportButtonProps {
  jurys: JuryWithEleves[];
  scenarioName: string;
  criteriaConfig: CriteriaConfig;
}

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

export function ExportButton({ jurys, scenarioName, criteriaConfig }: ExportButtonProps) {
  const maxByCategory = computeMaxByCategory(criteriaConfig);
  const maxTotal = computeMaxTotal(criteriaConfig);

  function csvSafe(value: string): string {
    const escaped = value.replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(escaped)) {
      return `"'${escaped}"`;
    }
    return `"${escaped}"`;
  }

  function handleExport() {
    const headers = [
      '\u00c9l\u00e8ve', 'Jury', 'Salle', 'Classe', 'Parcours', 'Sujet',
      ...criteriaConfig.criteria.map(c => c.label),
      ...criteriaConfig.categories.map(cat => `${cat.label} /${maxByCategory[cat.id] ?? 0}`),
      `Total /${maxTotal}`,
      'Points forts', "Axes d'am\u00e9lioration",
    ];

    const rows: string[][] = [];
    for (const jury of jurys) {
      for (const eleve of jury.eleves) {
        const fs = jury.finalScores.get(eleve.id);
        rows.push([
          csvSafe(eleve.display_name),
          csvSafe(jury.jury_name),
          csvSafe(jury.salle || ''),
          csvSafe(eleve.classe || ''),
          csvSafe(eleve.parcours || ''),
          csvSafe(eleve.sujet || ''),
          ...criteriaConfig.criteria.map(c => fs ? `${getScoreValue(fs, c.id) ?? ''}` : ''),
          ...criteriaConfig.categories.map(cat => fs ? `${getCategoryTotal(fs, cat.id, criteriaConfig)}` : ''),
          fs ? `${fs.total}` : '',
          csvSafe(fs?.points_forts || ''),
          csvSafe(fs?.axes_amelioration || ''),
        ]);
      }
    }

    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Notes_DNB_${scenarioName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleExport} style={styles.btn}>
      \uD83D\uDCE5 Exporter CSV
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  btn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '2px solid #2b6cb0',
    background: '#fff',
    color: '#2b6cb0',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
