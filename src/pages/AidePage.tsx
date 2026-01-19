import React from 'react';
import { HelpCircle, BookOpen, Mail } from 'lucide-react';
import './InfoPage.css';

export const AidePage: React.FC = () => {
  return (
    <div className="info-page">
      <h1>Aide</h1>
      <p className="lead">Ressources pour prendre en main Groupit et comprendre les affectations.</p>

      <div className="info-card">
        <div className="card-title">
          <HelpCircle size={18} />
          <span>Guides</span>
        </div>
        <ul>
          <li>Importer vos élèves et enseignants</li>
          <li>Créer un scénario et lancer l'affectation</li>
          <li>Comprendre le score et les conflits</li>
        </ul>
        <span className="info-badge">Documentation à venir</span>
      </div>

      <div className="info-card">
        <div className="card-title">
          <BookOpen size={18} />
          <span>FAQ rapide</span>
        </div>
        <p className="info-note">Les questions fréquentes seront regroupées ici (formats CSV, matières orales, capacités jurys...).</p>
      </div>

      <div className="info-card">
        <div className="card-title">
          <Mail size={18} />
          <span>Support</span>
        </div>
        <p className="info-note">En attendant, signalez tout bug ou besoin depuis votre canal habituel.</p>
      </div>
    </div>
  );
};
