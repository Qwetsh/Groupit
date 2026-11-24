// ============================================================
// ACCUEIL : la préparation de l'année en un coup d'œil
// ============================================================
// 1. La prochaine étape, seule action principale de la page.
// 2. Les données (élèves, enseignants, stages), chacune avec son état.
// 3. Les deux chantiers et leurs étapes.
// 4. Les autres outils, en liste discrète.
// Base vide : trois étapes numérotées pour démarrer.

import React from 'react';
import {
  ArrowRight, Users, GraduationCap, Briefcase, Mic, Check, Circle, AlertTriangle,
  Sliders, MousePointerClick, FolderOpen, ChevronRight, RotateCcw, CalendarClock,
} from 'lucide-react';
import {
  prochaineEtape, etapesOral, etapesStages, avancement, anneeScolaire, joursAvant, echeance,
  type EtatPreparation, type ActionAccueil, type EtapeChantier,
} from '../../services/accueilService';

export interface ActionsAccueil {
  lancer: (action: ActionAccueil) => void;
  ouvrir: (chemin: string) => void;
  recommencerOral: () => void;
  recommencerStages: () => void;
  reprendreStages: () => void;
  reprendreSession: () => void;
}

interface Props {
  etat: EtatPreparation;
  actions: ActionsAccueil;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function ListeEtapes({ etapes }: { etapes: EtapeChantier[] }) {
  return (
    <ul className="acc-etapes">
      {etapes.map(e => (
        <li key={e.libelle} className={e.faite ? 'faite' : ''}>
          <span className="acc-etape-marque" aria-hidden="true">
            {e.faite ? <Check size={12} strokeWidth={3} /> : <Circle size={8} />}
          </span>
          <span>{e.libelle}</span>
          <span className="sr-only">{e.faite ? ' (fait)' : ' (à faire)'}</span>
        </li>
      ))}
    </ul>
  );
}

function Progression({ etapes }: { etapes: EtapeChantier[] }) {
  const faites = etapes.filter(e => e.faite).length;
  const pct = Math.round((faites / etapes.length) * 100);
  return (
    <div className="acc-progression" role="img" aria-label={`${faites} étapes sur ${etapes.length}`}>
      <div className="acc-progression-barre"><span style={{ width: `${pct}%` }} /></div>
      <span className="acc-progression-texte">{faites}/{etapes.length}</span>
    </div>
  );
}

export const AccueilPreparation: React.FC<Props> = ({ etat, actions }) => {
  const etape = prochaineEtape(etat);
  const premiereFois = etat.nbEleves === 0;
  const jours = etat.debutStages ? joursAvant(etat.debutStages, etat.aujourdhui) : null;
  const dateStages = etat.debutStages?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  if (premiereFois) {
    const demarrage = [
      {
        num: 1, titre: 'Importer vos élèves', texte: "L'export CSV de Pronote, une ou plusieurs classes.",
        fait: false, bouton: 'Importer', action: () => actions.lancer('importer-eleves'),
      },
      {
        num: 2, titre: 'Importer vos enseignants',
        texte: etat.nbEnseignants > 0 ? `${pluriel(etat.nbEnseignants, 'enseignant')} déjà enregistrés.` : 'Avec leur adresse, pour les distances de stage.',
        fait: etat.nbEnseignants > 0, bouton: 'Importer', action: () => actions.lancer('importer-enseignants'),
      },
      {
        num: 3, titre: 'Choisir votre chantier', texte: "Oral du DNB ou stages : l'assistant vous guide ensuite.",
        fait: false, bouton: null, action: null,
      },
    ];
    return (
      <div className="accueil">
        <header className="acc-entete">
          <p className="acc-surtitre">Année {anneeScolaire(etat.aujourdhui)}</p>
          <h1>Bienvenue dans Locanda</h1>
          <p className="acc-intro">
            Répartissez vos élèves de 3e entre les jurys de l'oral et les tuteurs de stage.
            Trois étapes pour démarrer.
          </p>
        </header>

        <ol className="acc-demarrage">
          {demarrage.map((d, i) => {
            const active = !d.fait && demarrage.slice(0, i).every(p => p.fait || p.num === 2);
            return (
              <li key={d.num} className={`${d.fait ? 'fait' : ''} ${active && d.num === 1 ? 'active' : ''}`}>
                <span className="acc-num" aria-hidden="true">{d.fait ? <Check size={16} strokeWidth={3} /> : d.num}</span>
                <div className="acc-demarrage-texte">
                  <h2>{d.titre}</h2>
                  <p>{d.texte}</p>
                </div>
                {d.bouton && d.action && !d.fait && (
                  <button className={`acc-btn ${d.num === 1 ? 'primaire' : ''}`} onClick={d.action}>
                    {d.bouton}
                    {d.num === 1 && <ArrowRight size={16} aria-hidden="true" />}
                  </button>
                )}
                {d.fait && <span className="acc-badge ok">Fait</span>}
              </li>
            );
          })}
        </ol>

        {/* Ce que l'outil va produire, pour donner envie d'aller au bout */}
        <section aria-labelledby="acc-apercu">
          <h2 className="acc-section" id="acc-apercu">Ce que Locanda prépare pour vous</h2>
          <div className="acc-chantiers">
            <article className="acc-chantier oral apercu">
              <div className="acc-chantier-tete">
                <span className="acc-chantier-icone" aria-hidden="true"><Mic size={20} /></span>
                <h3>Oral du DNB</h3>
              </div>
              <ul className="acc-apercu-liste">
                <li>Des jurys équilibrés, au plus près des matières choisies</li>
                <li>Les horaires de passage, salle par salle</li>
                <li>Convocations en PDF et notes saisies en ligne par les jurys</li>
              </ul>
            </article>
            <article className="acc-chantier stage apercu">
              <div className="acc-chantier-tete">
                <span className="acc-chantier-icone" aria-hidden="true"><Briefcase size={20} /></span>
                <h3>Stages de 3e</h3>
              </div>
              <ul className="acc-apercu-liste">
                <li>Un tuteur pour chaque élève, au plus près de son lieu de stage</li>
                <li>La carte des trajets de chaque enseignant</li>
                <li>Une charge équilibrée entre les tuteurs</li>
              </ul>
            </article>
          </div>
        </section>

        <button className="acc-lien-discret" onClick={actions.reprendreSession}>
          <FolderOpen size={16} aria-hidden="true" />
          Reprendre une session sauvegardée
        </button>
      </div>
    );
  }

  const oral = etapesOral(etat);
  const stages = etapesStages(etat);
  const pct = avancement(etat);

  return (
    <div className="accueil">
      <header className="acc-entete acc-entete-ligne">
        <div>
          <p className="acc-surtitre">Année {anneeScolaire(etat.aujourdhui)} · 3e</p>
          <h1>Préparation de l'année</h1>
        </div>
        <div className="acc-avancement" aria-label={`Préparation avancée à ${pct} %`}>
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" className="fond" />
            <circle cx="18" cy="18" r="15.5" className="valeur" pathLength={100} strokeDasharray={`${pct} 100`} />
          </svg>
          <span><strong>{pct} %</strong> prêt</span>
        </div>
      </header>

      {/* 1. La prochaine étape */}
      <section className="acc-prochaine" aria-labelledby="acc-prochaine-titre">
        <div className="acc-prochaine-icone" aria-hidden="true">
          {etape.action.includes('oral') ? <Mic size={24} /> : etape.action.includes('stage') || etape.action.includes('tuteur') ? <Briefcase size={24} /> : <Users size={24} />}
        </div>
        <div className="acc-prochaine-texte">
          <p className="acc-etiquette">Prochaine étape</p>
          <h2 id="acc-prochaine-titre">{etape.titre}</h2>
          <p>{etape.detail}</p>
        </div>
        <button className="acc-btn primaire grand" onClick={() => actions.lancer(etape.action)}>
          {etape.bouton}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>

      {/* 2. Les données */}
      <section aria-labelledby="acc-donnees">
        <h2 className="acc-section" id="acc-donnees">Vos données</h2>
        <div className="acc-donnees">
          <button className="acc-tuile" onClick={() => actions.ouvrir('/eleves')}>
            <span className="acc-tuile-tete"><Users size={18} aria-hidden="true" /> Élèves</span>
            <span className="acc-chiffre">{etat.nbEleves}</span>
            <span className="acc-statut ok"><Check size={14} aria-hidden="true" /> {pluriel(etat.nbClasses, 'classe')}</span>
          </button>
          <button className="acc-tuile" onClick={() => actions.ouvrir('/enseignants')}>
            <span className="acc-tuile-tete"><GraduationCap size={18} aria-hidden="true" /> Enseignants</span>
            <span className="acc-chiffre">{etat.nbEnseignants}</span>
            {etat.nbEnseignantsSansAdresse > 0 ? (
              <span className="acc-statut alerte"><AlertTriangle size={14} aria-hidden="true" /> {etat.nbEnseignantsSansAdresse} sans adresse · Compléter</span>
            ) : (
              <span className="acc-statut ok"><Check size={14} aria-hidden="true" /> Adresses complètes</span>
            )}
          </button>
          <button className="acc-tuile" onClick={() => (etat.nbStages > 0 ? actions.ouvrir('/suivi-stages') : actions.lancer('importer-stages'))}>
            <span className="acc-tuile-tete"><Briefcase size={18} aria-hidden="true" /> Stages</span>
            <span className="acc-chiffre">{etat.nbStages}<small> / {etat.nbEleves}</small></span>
            {etat.nbStages === 0 ? (
              <span className="acc-statut a-faire"><Circle size={10} aria-hidden="true" /> À importer</span>
            ) : etat.nbStages < etat.nbEleves ? (
              <span className="acc-statut alerte"><AlertTriangle size={14} aria-hidden="true" /> {etat.nbEleves - etat.nbStages} manquants</span>
            ) : (
              <span className="acc-statut ok"><Check size={14} aria-hidden="true" /> Tous importés</span>
            )}
          </button>
        </div>
      </section>

      {/* 3. Les chantiers */}
      <section aria-labelledby="acc-chantiers">
        <h2 className="acc-section" id="acc-chantiers">Vos chantiers</h2>
        <div className="acc-chantiers">
          <article className="acc-chantier oral">
            <div className="acc-chantier-tete">
              <span className="acc-chantier-icone" aria-hidden="true"><Mic size={20} /></span>
              <h3>Oral du DNB</h3>
              <span className={`acc-badge ${etat.oral.enCours ? 'encours' : 'neutre'}`}>{etat.oral.enCours ? 'En cours' : 'À préparer'}</span>
            </div>
            <Progression etapes={oral} />
            <ListeEtapes etapes={oral} />
            <div className="acc-chantier-actions">
              <button className="acc-btn" onClick={() => actions.lancer(etat.oral.enCours ? 'reprendre-oral' : 'preparer-oral')}>
                {etat.oral.enCours ? 'Reprendre' : 'Commencer'}
              </button>
              {etat.oral.enCours && (
                <button className="acc-btn discret" onClick={actions.recommencerOral}>
                  <RotateCcw size={14} aria-hidden="true" /> Recommencer
                </button>
              )}
            </div>
          </article>

          <article className="acc-chantier stage">
            <div className="acc-chantier-tete">
              <span className="acc-chantier-icone" aria-hidden="true"><Briefcase size={20} /></span>
              <h3>Stages de 3e</h3>
              {jours !== null && jours >= 0 ? (
                <span className={`acc-badge ${jours <= 30 ? 'urgent' : 'neutre'}`}>
                  <CalendarClock size={13} aria-hidden="true" /> {echeance(jours)}
                </span>
              ) : (
                <span className={`acc-badge ${etat.stages.enCours ? 'encours' : 'neutre'}`}>{etat.stages.enCours ? 'En cours' : 'À préparer'}</span>
              )}
            </div>
            <Progression etapes={stages} />
            <ListeEtapes etapes={stages} />
            {dateStages && <p className="acc-note">Début des stages le {dateStages}.</p>}
            <div className="acc-chantier-actions">
              {etat.stages.enCours ? (
                <>
                  <button className="acc-btn" onClick={actions.reprendreStages}>Reprendre</button>
                  <button className="acc-btn discret" onClick={actions.recommencerStages}>
                    <RotateCcw size={14} aria-hidden="true" /> Recommencer
                  </button>
                </>
              ) : (
                <button className="acc-btn" onClick={() => actions.lancer(etat.nbStages > 0 ? 'attribuer-tuteurs' : 'importer-stages')}>
                  {etat.nbStages > 0 ? 'Attribuer les tuteurs' : 'Importer les stages'}
                </button>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* 4. Les autres outils */}
      <section aria-labelledby="acc-outils">
        <h2 className="acc-section" id="acc-outils">Autres outils</h2>
        <div className="acc-outils">
          <button onClick={() => actions.ouvrir('personnalise')}>
            <Sliders size={18} aria-hidden="true" />
            <span><strong>Mode personnalisé</strong> Groupes selon vos propres critères</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button onClick={() => actions.ouvrir('/libre')}>
            <MousePointerClick size={18} aria-hidden="true" />
            <span><strong>Mode libre</strong> Composer les groupes à la main</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button onClick={actions.reprendreSession}>
            <FolderOpen size={18} aria-hidden="true" />
            <span><strong>Reprendre une session</strong> À partir d'un fichier sauvegardé</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};
