import { useState, useEffect } from 'react';
import { supabase } from '@groupit/shared';
import type { SessionEleveRow } from '@groupit/shared';

interface StudentListScreenProps {
  juryId: string;
  slot: 'A' | 'B';
  mode: 'solo' | 'duo';
  onSelectEleve: (eleve: SessionEleveRow) => void;
  onDisconnect: () => void;
}

export function StudentListScreen({ juryId, slot, mode, onSelectEleve, onDisconnect }: StudentListScreenProps) {
  const [eleves, setEleves] = useState<SessionEleveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerConnected, setPartnerConnected] = useState(false);

  // Charger les élèves
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('session_eleves')
        .select('*')
        .eq('jury_id', juryId)
        .order('ordre_passage', { ascending: true });

      if (data) setEleves(data);
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
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [juryId]);

  // Surveiller si le 2e juré est connecté (mode duo)
  useEffect(() => {
    if (mode !== 'duo') return;

    async function checkPartner() {
      const { data } = await supabase
        .from('jury_members')
        .select('slot')
        .eq('jury_id', juryId);

      setPartnerConnected((data?.length ?? 0) >= 2);
    }
    checkPartner();

    const channel = supabase
      .channel(`members-${juryId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'jury_members',
        filter: `jury_id=eq.${juryId}`,
      }, () => {
        setPartnerConnected(true);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'jury_members',
        filter: `jury_id=eq.${juryId}`,
      }, () => {
        // Recheck partner count on delete
        checkPartner();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [juryId, mode]);

  const validated = eleves.filter(e => e.status === 'validated').length;
  const total = eleves.length;

  function getStatusStyle(status: string) {
    switch (status) {
      case 'validated': return { bg: '#c6f6d5', color: '#276749', label: '✓ Noté' };
      case 'scored': return { bg: '#fefcbf', color: '#975a16', label: '⏳ Réconciliation' };
      case 'in_progress': return { bg: '#bee3f8', color: '#2b6cb0', label: '🎤 En cours' };
      case 'lobby': return { bg: '#e9d8fd', color: '#6b46c1', label: '⏳ Attente' };
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
          <div style={styles.badge}>Juré {slot}</div>
        </div>
        <div style={styles.headerTitle}>Élèves du jury</div>
        <div style={styles.progress}>
          {validated}/{total} passé{validated > 1 ? 's' : ''}
          {mode === 'duo' && (
            <span style={{
              marginLeft: 10,
              color: partnerConnected ? '#9ae6b4' : '#feb2b2',
            }}>
              {partnerConnected ? '● Jury 2 connecté' : '○ En attente jury 2'}
            </span>
          )}
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
        {eleves.map((eleve, idx) => {
          const st = getStatusStyle(eleve.status);
          const isClickable = eleve.status === 'pending' || eleve.status === 'validated';

          return (
            <button
              key={eleve.id}
              onClick={() => isClickable && onSelectEleve(eleve)}
              disabled={!isClickable}
              style={{
                ...styles.card,
                opacity: isClickable ? 1 : 0.7,
                cursor: isClickable ? 'pointer' : 'default',
                borderLeft: `4px solid ${st.color}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
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
              </div>
            </button>
          );
        })}
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
  badge: {
    background: 'rgba(255,255,255,0.2)',
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    marginTop: 8,
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
  doneCard: {
    background: '#f0fff4',
    borderRadius: 14,
    padding: 20,
    margin: '12px 16px',
    border: '2px solid #9ae6b4',
    textAlign: 'center' as const,
  },
};
