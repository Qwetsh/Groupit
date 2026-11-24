// ============================================================
// ACCUEIL : les façons d'utiliser Locanda
// ============================================================
// Deux usages principaux (oral du DNB, stages) en grandes cartes,
// deux outils complémentaires en cartes compactes, et la reprise
// d'une session sauvegardée. Une carte « en cours » propose de reprendre.

import React from 'react';
import {
  Mic, Briefcase, Sliders, MousePointerClick, FolderOpen, ArrowRight, Check, RotateCcw, Play,
} from 'lucide-react';

export interface UsagePrincipal {
  id: 'oral' | 'stages';
  titre: string;
  description: string;
  points: string[];
  enCours: string | null;
  commencer: () => void;
  reprendre: () => void;
}

export interface UsageSecondaire {
  id: 'perso' | 'libre';
  titre: string;
  description: string;
  enCours: boolean;
  ouvrir: () => void;
}

interface Props {
  principaux: UsagePrincipal[];
  secondaires: UsageSecondaire[];
  reprendreSession: () => void;
}

const ICONES = {
  oral: <Mic size={28} />,
  stages: <Briefcase size={28} />,
  perso: <Sliders size={22} />,
  libre: <MousePointerClick size={22} />,
};

export const AccueilModes: React.FC<Props> = ({ principaux, secondaires, reprendreSession }) => (
  <div className="accueil-modes">
    <header className="am-entete">
      <span className="am-marque" aria-hidden="true">L</span>
      <div>
        <h1>Que voulez-vous préparer ?</h1>
        <p>Choisissez une façon de répartir vos élèves. L'assistant vous guide ensuite étape par étape.</p>
      </div>
    </header>

    <div className="am-principaux">
      {principaux.map(u => (
        <article key={u.id} className={`am-carte ${u.id} ${u.enCours ? 'en-cours' : ''}`} aria-labelledby={`am-${u.id}`}>
          <div className="am-bandeau">
            <span className="am-icone" aria-hidden="true">{ICONES[u.id]}</span>
            {u.enCours && (
              <span className="am-encours"><Play size={12} aria-hidden="true" /> En cours</span>
            )}
          </div>
          <div className="am-corps">
            <h2 id={`am-${u.id}`}>{u.titre}</h2>
            <p className="am-description">{u.enCours ?? u.description}</p>
            <ul className="am-points">
              {u.points.map(p => (
                <li key={p}><Check size={15} strokeWidth={2.5} aria-hidden="true" />{p}</li>
              ))}
            </ul>
          </div>
          <div className="am-actions">
            {u.enCours ? (
              <>
                <button className="am-btn primaire" onClick={u.reprendre}>
                  Reprendre <ArrowRight size={17} aria-hidden="true" />
                </button>
                <button className="am-btn" onClick={u.commencer}>
                  <RotateCcw size={15} aria-hidden="true" /> Recommencer
                </button>
              </>
            ) : (
              <button className="am-btn primaire" onClick={u.commencer}>
                Commencer <ArrowRight size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        </article>
      ))}
    </div>

    <div className="am-secondaires">
      {secondaires.map(u => (
        <button key={u.id} className={`am-compacte ${u.id}`} onClick={u.ouvrir}>
          <span className="am-icone petite" aria-hidden="true">{ICONES[u.id]}</span>
          <span className="am-compacte-texte">
            <strong>{u.titre}{u.enCours && <span className="am-encours discret">En cours</span>}</strong>
            <span>{u.description}</span>
          </span>
          <ArrowRight size={18} className="am-fleche" aria-hidden="true" />
        </button>
      ))}
    </div>

    <button className="am-session" onClick={reprendreSession}>
      <FolderOpen size={16} aria-hidden="true" />
      Reprendre une session sauvegardée
    </button>
  </div>
);
