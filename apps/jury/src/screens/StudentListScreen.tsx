import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@groupit/shared';
import type { SessionEleveRow, FinalScoreRow } from '@groupit/shared';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentListScreenProps {
  juryId: string;
  onSelectEleve: (eleve: SessionEleveRow) => void;
  onSelectBinome: (eleves: [SessionEleveRow, SessionEleveRow]) => void;
  onDisconnect: () => void;
}

export function StudentListScreen({ juryId, onSelectEleve, onSelectBinome, onDisconnect }: StudentListScreenProps) {
  const [eleves, setEleves] = useState<SessionEleveRow[]>([]);
  const [scoreMap, setScoreMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Charger les élèves + scores
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('session_eleves')
        .select('*')
        .eq('jury_id', juryId)
        .order('ordre_passage', { ascending: true });

      if (data) {
        setEleves(data);
        const ids = data.map(e => e.id);
        if (ids.length > 0) {
          const { data: scores } = await supabase
            .from('final_scores')
            .select('eleve_id, total')
            .in('eleve_id', ids);
          if (scores) setScoreMap(new Map(scores.map(s => [s.eleve_id, s.total])));
        }
      }
      setLoading(false);
    }
    load();
  }, [juryId]);

  // Écouter les changements de status en temps réel
  useEffect(() => {
    const channel = supabase
      .channel(`eleves-${juryId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'session_eleves',
        filter: `jury_id=eq.${juryId}`,
      }, (payload) => {
        setEleves(prev => prev.map(e =>
          e.id === payload.new.id ? { ...e, ...payload.new } as SessionEleveRow : e
        ));
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'final_scores',
      }, (payload) => {
        const row = payload.new as { eleve_id?: string; total?: number };
        if (row.eleve_id && row.total != null) {
          setScoreMap(prev => new Map(prev).set(row.eleve_id!, row.total!));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [juryId]);

  const validated = eleves.filter(e => e.status === 'validated').length;
  const total = eleves.length;

  const handleToggleAbsent = useCallback(async (eleve: SessionEleveRow) => {
    const isAbsent = eleve.status === 'absent';
    const msg = isAbsent
      ? `Remettre ${eleve.display_name} comme "À passer" ?`
      : `Marquer ${eleve.display_name} comme absent ?`;
    if (!window.confirm(msg)) return;
    const newStatus = isAbsent ? 'pending' : 'absent';
    await supabase.from('session_eleves').update({ status: newStatus }).eq('id', eleve.id);
  }, []);

  const fetchScores = useCallback(async () => {
    const { data } = await supabase
      .from('final_scores')
      .select('*')
      .in('eleve_id', eleves.map(e => e.id));
    return new Map((data || []).map(s => [s.eleve_id, s as FinalScoreRow]));
  }, [eleves]);

  const statusLabel = (s: string) =>
    s === 'validated' ? 'Noté' : s === 'absent' ? 'Absent' : 'En attente';

  const buildRows = (scoreMap: Map<string, FinalScoreRow>) =>
    eleves.map(e => {
      const fs = scoreMap.get(e.id);
      return {
        'Élève': e.display_name,
        'Classe': e.classe || '',
        'Parcours': e.parcours || '',
        'Sujet': e.sujet || '',
        'Note /20': fs ? fs.total : '',
        'Oral /8': fs ? fs.total_oral : '',
        'Sujet /12': fs ? fs.total_sujet : '',
        'Points forts': fs?.points_forts || '',
        "Axes d'amélioration": fs?.axes_amelioration || '',
        'Statut': statusLabel(e.status),
      };
    });

  const handleExportExcel = useCallback(async () => {
    const scoreMap = await fetchScores();
    const rows = buildRows(scoreMap);
    const ws = XLSX.utils.json_to_sheet(rows);

    // Largeurs de colonnes
    ws['!cols'] = [
      { wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 20 },
      { wch: 8 }, { wch: 8 }, { wch: 9 },
      { wch: 30 }, { wch: 30 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Notes');
    XLSX.writeFile(wb, 'notes-jury.xlsx');
  }, [fetchScores, eleves]);

  const handleExportPDF = useCallback(async () => {
    const scoreMap = await fetchScores();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // === Calcul des stats du jury ===
    const scores = eleves
      .map(e => scoreMap.get(e.id))
      .filter((fs): fs is FinalScoreRow => fs != null);
    const totals = scores.map(s => s.total);
    const nbAbsents = eleves.filter(e => e.status === 'absent').length;
    const nbEvalues = scores.length;
    const nbEnAttente = total - nbEvalues - nbAbsents;

    const moyenne = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const sorted = [...totals].sort((a, b) => a - b);
    const mediane = sorted.length > 0
      ? sorted.length % 2 !== 0 ? sorted[Math.floor(sorted.length / 2)]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : 0;
    const ecartType = totals.length > 0
      ? Math.sqrt(totals.reduce((s, v) => s + (v - moyenne) ** 2, 0) / totals.length)
      : 0;
    const noteMin = totals.length > 0 ? Math.min(...totals) : 0;
    const noteMax = totals.length > 0 ? Math.max(...totals) : 0;
    const nbSousMoyenne = totals.filter(t => t < 10).length;
    const nbBien = totals.filter(t => t >= 14 && t < 16).length;
    const nbTresBien = totals.filter(t => t >= 16).length;
    const moyOral = scores.length > 0 ? scores.reduce((s, f) => s + f.total_oral, 0) / scores.length : 0;
    const moySujet = scores.length > 0 ? scores.reduce((s, f) => s + f.total_sujet, 0) / scores.length : 0;

    const durations = eleves.map(e => e.duree_passage).filter((d): d is number => d != null && d > 0);
    const dureeMoy = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const fmtDur = (sec: number) => { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };

    // Distribution
    const distBuckets = [
      { range: '0-4', min: 0, max: 4, count: 0 },
      { range: '5-7', min: 5, max: 7, count: 0 },
      { range: '8-9', min: 8, max: 9, count: 0 },
      { range: '10-11', min: 10, max: 11, count: 0 },
      { range: '12-13', min: 12, max: 13, count: 0 },
      { range: '14-15', min: 14, max: 15, count: 0 },
      { range: '16-17', min: 16, max: 17, count: 0 },
      { range: '18-20', min: 18, max: 20, count: 0 },
    ];
    for (const t of totals) {
      const b = distBuckets.find(b => t >= b.min && t <= b.max);
      if (b) b.count++;
    }

    // === PAGE 1 : Rapport statistique ===
    const blue = [26, 54, 93] as const;

    // Titre
    doc.setFillColor(...blue);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text('Rapport du jury', 14, 13);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), pageW - 14, 13, { align: 'right' });

    let y = 30;
    doc.setTextColor(30);
    doc.setFontSize(11);
    doc.text('Statistiques générales', 14, y);
    y += 8;

    // Carte de stats en grille
    const statsCards = [
      { label: 'Élèves évalués', value: `${nbEvalues}/${total}`, sub: `${nbEnAttente} en attente` },
      { label: 'Moyenne générale', value: `${Math.round(moyenne * 100) / 100}/20`, sub: `Médiane : ${Math.round(mediane * 100) / 100}` },
      { label: 'Écart-type', value: `${Math.round(ecartType * 100) / 100}`, sub: `Min ${noteMin} — Max ${noteMax}` },
      { label: 'Sous la moyenne', value: `${nbSousMoyenne}`, sub: nbEvalues > 0 ? `${Math.round((nbSousMoyenne / nbEvalues) * 100)}%` : '—' },
      { label: 'Bien (14-15)', value: `${nbBien}`, sub: nbEvalues > 0 ? `${Math.round((nbBien / nbEvalues) * 100)}%` : '—' },
      { label: 'Très bien (16+)', value: `${nbTresBien}`, sub: nbEvalues > 0 ? `${Math.round((nbTresBien / nbEvalues) * 100)}%` : '—' },
      { label: 'Moyenne Oral', value: `${Math.round(moyOral * 100) / 100}/8`, sub: 'Présentation' },
      { label: 'Moyenne Sujet', value: `${Math.round(moySujet * 100) / 100}/12`, sub: 'Maîtrise' },
    ];
    if (nbAbsents > 0) statsCards.splice(1, 0, { label: 'Absents', value: `${nbAbsents}`, sub: `sur ${total}` });
    if (durations.length > 0) statsCards.push({
      label: 'Durée moyenne', value: fmtDur(dureeMoy),
      sub: `Min ${fmtDur(Math.min(...durations))} — Max ${fmtDur(Math.max(...durations))}`,
    });

    const cardW = 58;
    const cardH = 18;
    const cols = 4;
    const gap = 6;
    const startX = 14;

    for (let i = 0; i < statsCards.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (cardW + gap);
      const cy = y + row * (cardH + gap);

      doc.setDrawColor(200);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(statsCards[i]!.label.toUpperCase(), cx + 3, cy + 5);

      doc.setFontSize(12);
      doc.setTextColor(30);
      doc.text(statsCards[i]!.value, cx + 3, cy + 12);

      doc.setFontSize(7);
      doc.setTextColor(130);
      doc.text(statsCards[i]!.sub, cx + 3, cy + 16);
    }

    const statsRows = Math.ceil(statsCards.length / cols);
    y += statsRows * (cardH + gap) + 6;

    // Distribution des notes (tableau compact)
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text('Distribution des notes', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [distBuckets.map(b => b.range)],
      body: [distBuckets.map(b => String(b.count))],
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      tableWidth: pageW - 28,
      margin: { left: 14 },
    });

    // === PAGE 2 : Tableau détaillé ===
    doc.addPage();

    doc.setFillColor(...blue);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255);
    doc.text('Détail des notes', 14, 13);

    const head = [['#', 'Élève', 'Classe', 'Parcours', 'Note', 'Oral', 'Sujet', 'Points forts', 'Axes amélioration', 'Statut']];
    const tableBody = eleves.map((e, i) => {
      const fs = scoreMap.get(e.id);
      return [
        String(i + 1),
        e.display_name,
        e.classe || '',
        e.parcours || '',
        fs ? `${fs.total}/20` : '—',
        fs ? `${fs.total_oral}/8` : '—',
        fs ? `${fs.total_sujet}/12` : '—',
        fs?.points_forts || '',
        fs?.axes_amelioration || '',
        statusLabel(e.status),
      ];
    });

    autoTable(doc, {
      startY: 26,
      head,
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [...blue], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        9: { cellWidth: 16, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save('notes-jury.pdf');
  }, [fetchScores, eleves, validated, total]);

  function getStatusStyle(status: string, eleveId: string) {
    switch (status) {
      case 'validated': {
        const note = scoreMap.get(eleveId);
        return { bg: '#c6f6d5', color: '#276749', label: note != null ? `${note}/20` : '✓' };
      }
      case 'in_progress': return { bg: '#bee3f8', color: '#2b6cb0', label: '🎤 En cours' };
      case 'absent': return { bg: '#fed7d7', color: '#9b2c2c', label: 'Abs' };
      default: return { bg: '#f1f5f9', color: '#64748b', label: 'À passer' };
    }
  }

  if (loading) {
    return <div style={styles.loading}>Chargement...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onDisconnect} style={styles.backBtn}>← Quitter</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={styles.headerTitle}>Élèves du jury</div>
          {validated > 0 && (<>
            <button onClick={handleExportExcel} style={styles.exportBtn}>⬇ Excel</button>
            <button onClick={handleExportPDF} style={styles.exportBtn}>⬇ PDF</button>
          </>)}
        </div>
        <div style={styles.progress}>
          {validated}/{total} passé{validated > 1 ? 's' : ''}
        </div>
        {/* Barre de progression */}
        <div style={styles.progressBar}>
          <div style={{
            ...styles.progressFill,
            width: total > 0 ? `${(validated / total) * 100}%` : '0%',
          }} />
        </div>
      </div>

      <div style={styles.list}>
        {(() => {
          // Regrouper les binômes : on skip un élève si son binôme a déjà été rendu
          const rendered = new Set<string>();

          return eleves.map((eleve, idx) => {
            if (rendered.has(eleve.id)) return null;
            rendered.add(eleve.id);

            // Vérifier si c'est un binôme
            const partner = eleve.binome_id ? eleves.find(e => e.id === eleve.binome_id) : null;
            if (partner) rendered.add(partner.id);

            if (partner) {
              // --- Rendu binôme ---
              const pair: [SessionEleveRow, SessionEleveRow] = [eleve, partner];
              const stA = getStatusStyle(eleve.status, eleve.id);
              const stB = getStatusStyle(partner.status, partner.id);
              const isClickable = pair.some(e => e.status === 'pending' || e.status === 'validated');

              return (
                <div
                  key={eleve.id}
                  onClick={() => isClickable && onSelectBinome(pair)}
                  style={{
                    ...styles.card,
                    borderLeft: '4px solid #6b46c1',
                    cursor: isClickable ? 'pointer' : 'default',
                    opacity: isClickable ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={styles.binomeBadge}>BINÔME</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>#{idx + 1}</span>
                  </div>
                  {pair.map(e => {
                    const st = e === eleve ? stA : stB;
                    return (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a202c' }}>{e.display_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {e.classe}{e.parcours && ` · ${e.parcours}`}
                          </div>
                        </div>
                        {e.status === 'absent' ? (
                          <button onClick={(ev) => { ev.stopPropagation(); handleToggleAbsent(e); }} style={styles.absBadge}>{st.label}</button>
                        ) : (
                          <div style={{ padding: '3px 8px', borderRadius: 6, background: st.bg, color: st.color, fontSize: 11, fontWeight: 700 }}>{st.label}</div>
                        )}
                      </div>
                    );
                  })}
                  {eleve.sujet && (
                    <div style={{ ...styles.eleveSujet, marginTop: 4 }}>{eleve.sujet}</div>
                  )}
                  {eleve.heure_passage && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{eleve.heure_passage}</div>
                  )}
                </div>
              );
            }

            // --- Rendu solo ---
            const st = getStatusStyle(eleve.status, eleve.id);
            const isAbsent = eleve.status === 'absent';
            const isClickable = eleve.status === 'pending' || eleve.status === 'validated';

            return (
              <div
                key={eleve.id}
                style={{
                  ...styles.card,
                  opacity: (isClickable || isAbsent) ? 1 : 0.7,
                  borderLeft: `4px solid ${st.color}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div
                    onClick={() => isClickable && onSelectEleve(eleve)}
                    style={{ flex: 1, cursor: isClickable ? 'pointer' : 'default' }}
                  >
                    <div style={styles.eleveNum}>#{idx + 1}</div>
                    <div style={styles.eleveName}>{eleve.display_name}</div>
                    <div style={styles.eleveInfo}>
                      {eleve.classe}
                      {eleve.parcours && ` · ${eleve.parcours}`}
                      {eleve.heure_passage && ` · ${eleve.heure_passage}`}
                    </div>
                    {eleve.sujet && (
                      <div style={styles.eleveSujet}>{eleve.sujet}</div>
                    )}
                  </div>
                  {isAbsent ? (
                    <button
                      onClick={() => handleToggleAbsent(eleve)}
                      style={styles.absBadge}
                    >
                      {st.label}
                    </button>
                  ) : (
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: st.bg,
                      color: st.color,
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}>
                      {st.label}
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {validated === total && total > 0 && (
        <div style={styles.doneCard}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#276749' }}>
            ✓ Tous les élèves ont été évalués
          </div>
          <div style={{ fontSize: 13, color: '#4a5568', marginTop: 4 }}>
            Les résultats sont disponibles sur le tableau de bord.
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    minHeight: '100vh',
    background: '#f0f4f8',
    paddingBottom: 32,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    color: '#64748b',
    fontSize: 16,
  },
  header: {
    background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
    color: '#fff',
    padding: '20px 20px 16px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 2px 12px rgba(26,54,93,0.15)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: '#fff',
    fontSize: 14,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
  },
  exportBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    cursor: 'pointer',
  },
  progress: {
    fontSize: 13,
    opacity: 0.85,
    marginTop: 4,
  },
  progressBar: {
    marginTop: 8,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    background: '#9ae6b4',
    transition: 'width 0.3s ease',
  },
  list: {
    padding: '8px 16px',
  },
  card: {
    width: '100%',
    background: '#ffffff',
    borderRadius: 12,
    padding: '14px 16px',
    marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    textAlign: 'left' as const,
    transition: 'transform 0.1s',
  },
  eleveNum: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
  },
  eleveName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a202c',
    marginTop: 2,
  },
  eleveInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  eleveSujet: {
    fontSize: 12,
    color: '#4a5568',
    fontStyle: 'italic',
    marginTop: 4,
  },
  binomeBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: '#6b46c1',
    background: '#e9d8fd',
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  absBadge: {
    padding: '4px 10px',
    borderRadius: 8,
    background: '#fed7d7',
    color: '#9b2c2c',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
    border: '1.5px dashed #fc8181',
    cursor: 'pointer',
  },
  doneCard: {
    background: '#f0fff4',
    borderRadius: 14,
    padding: 20,
    margin: '12px 16px',
    border: '2px solid #9ae6b4',
    textAlign: 'center' as const,
  },
};
