import { CRITERIA } from '@groupit/shared';
import type { FinalScoreRow } from '@groupit/shared';
import type { JuryWithEleves } from '../hooks/useSessionData';

interface ExportButtonProps {
  jurys: JuryWithEleves[];
  scenarioName: string;
}

export function ExportButton({ jurys, scenarioName }: ExportButtonProps) {
  // Sanitize CSV cell to prevent formula injection (=, +, -, @, tab, CR)
  function csvSafe(value: string): string {
    const escaped = value.replace(/"/g, '""');
    // Prefix dangerous characters with a single quote to prevent formula execution
    if (/^[=+\-@\t\r]/.test(escaped)) {
      return `"'${escaped}"`;
    }
    return `"${escaped}"`;
  }

  function handleExport() {
    const headers = [
      'Jury', 'Salle', 'Élève', 'Classe', 'Parcours', 'Sujet',
      ...CRITERIA.map(c => c.label),
      'Oral /8', 'Sujet /12', 'Total /20',
      'Points forts', "Axes d'amélioration",
    ];

    const scoreKey: Record<string, keyof FinalScoreRow> = {
      expression: 'score_expression',
      diaporama: 'score_diaporama',
      reactivite: 'score_reactivite',
      contenu: 'score_contenu',
      structure: 'score_structure',
      engagement: 'score_engagement',
    };

    const rows: string[][] = [];
    for (const jury of jurys) {
      for (const eleve of jury.eleves) {
        const fs = jury.finalScores.get(eleve.id);
        rows.push([
          csvSafe(jury.jury_name),
          csvSafe(jury.salle || ''),
          csvSafe(eleve.display_name),
          csvSafe(eleve.classe || ''),
          csvSafe(eleve.parcours || ''),
          csvSafe(eleve.sujet || ''),
          ...CRITERIA.map(c => fs ? `${fs[scoreKey[c.id]!]}` : ''),
          fs ? `${fs.total_oral}` : '',
          fs ? `${fs.total_sujet}` : '',
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
      📥 Exporter CSV
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
