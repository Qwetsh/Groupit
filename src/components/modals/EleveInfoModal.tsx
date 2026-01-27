// ============================================================
// MODAL - INFO ÉLÈVE
// ============================================================

import { X, User, Calendar, BookOpen, Tag, AlertTriangle, Users, Clock, FileText, Settings, Building2, MapPin, Phone, Mail, UserCircle } from 'lucide-react';
import type { Eleve, Affectation, Enseignant, Stage } from '../../domain/models';
import { useFieldDefinitionStore } from '../../stores/fieldDefinitionStore';
import './Modal.css';
import './EleveInfoModal.css';

interface EleveInfoModalProps {
  eleve: Eleve;
  affectation?: Affectation;
  enseignant?: Enseignant;
  stage?: Stage;
  onClose: () => void;
}

export function EleveInfoModal({ eleve, affectation, enseignant, stage, onClose }: EleveInfoModalProps) {
  // Calculer l'âge si date de naissance disponible
  const age = eleve.dateNaissance 
    ? Math.floor((new Date().getTime() - new Date(eleve.dateNaissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  // Récupérer les champs custom définis pour les élèves
  const getFieldDefinitionsForEntity = useFieldDefinitionStore(s => s.getFieldDefinitionsForEntity);
  const customFieldDefinitions = getFieldDefinitionsForEntity('eleve');

  // Formatter une valeur custom pour l'affichage
  const formatCustomValue = (value: unknown, type: string): string => {
    if (value === null || value === undefined) return '-';
    if (type === 'boolean') return value ? 'Oui' : 'Non';
    if (type === 'date' && value) {
      try {
        return new Date(String(value)).toLocaleDateString('fr-FR');
      } catch {
        return String(value);
      }
    }
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content eleve-info-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <User size={20} />
            <h2>Fiche élève</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* En-tête avec avatar et nom */}
          <div className="eleve-info-header">
            <div className="eleve-avatar large">
              <span>{eleve.prenom[0]}{eleve.nom[0]}</span>
            </div>
            <div className="eleve-identity">
              <h3>{eleve.prenom} {eleve.nom}</h3>
              <span className="eleve-classe-badge">{eleve.classe}</span>
              {eleve.sexe && (
                <span className={`eleve-sexe ${eleve.sexe === 'M' ? 'male' : 'female'}`}>
                  {eleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                </span>
              )}
            </div>
          </div>

          {/* Informations personnelles */}
          <div className="info-section">
            <h4><Calendar size={16} /> Informations personnelles</h4>
            <div className="info-grid">
              {eleve.dateNaissance && (
                <div className="info-item">
                  <span className="info-label">Date de naissance</span>
                  <span className="info-value">
                    {new Date(eleve.dateNaissance).toLocaleDateString('fr-FR')}
                    {age && ` (${age} ans)`}
                  </span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Classe</span>
                <span className="info-value">{eleve.classe}</span>
              </div>
              {eleve.sexe && (
                <div className="info-item">
                  <span className="info-label">Sexe</span>
                  <span className="info-value">{eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</span>
                </div>
              )}
              {eleve.regime && (
                <div className="info-item">
                  <span className="info-label">Régime</span>
                  <span className="info-value">{eleve.regime}</span>
                </div>
              )}
              {eleve.email && (
                <div className="info-item">
                  <span className="info-label">Email</span>
                  <span className="info-value">{eleve.email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Options et LV */}
          {eleve.options && eleve.options.length > 0 && (
            <div className="info-section">
              <h4><BookOpen size={16} /> Options & Langues</h4>
              <div className="tags-container">
                {eleve.options.map((opt, i) => (
                  <span key={i} className="tag option-tag">{opt}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {eleve.tags && eleve.tags.length > 0 && (
            <div className="info-section">
              <h4><Tag size={16} /> Tags</h4>
              <div className="tags-container">
                {eleve.tags.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Encouragement/Valorisation */}
          {eleve.encouragementValorisation && (
            <div className="info-section">
              <h4><FileText size={16} /> Encouragements</h4>
              <p className="info-text">{eleve.encouragementValorisation}</p>
            </div>
          )}

          {/* Contraintes */}
          {eleve.contraintes && eleve.contraintes.length > 0 && (
            <div className="info-section">
              <h4><AlertTriangle size={16} /> Contraintes</h4>
              <div className="contraintes-list">
                {eleve.contraintes.map((c, i) => (
                  <div key={i} className={`contrainte-item ${c.type}`}>
                    <span className="contrainte-type">
                      {c.type === 'doit_etre_avec' ? '✓ Doit être avec' : '✗ Ne doit pas être avec'}
                    </span>
                    <span className="contrainte-cible">{c.cibleId}</span>
                    {c.raison && <span className="contrainte-raison">{c.raison}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Informations de stage */}
          {stage && (
            <div className="info-section stage-section">
              <h4><Building2 size={16} /> Stage</h4>
              <div className="info-grid">
                {stage.nomEntreprise && (
                  <div className="info-item full-width">
                    <span className="info-label">Entreprise</span>
                    <span className="info-value highlight">{stage.nomEntreprise}</span>
                  </div>
                )}
                {stage.secteurActivite && (
                  <div className="info-item">
                    <span className="info-label">Secteur d'activité</span>
                    <span className="info-value">{stage.secteurActivite}</span>
                  </div>
                )}
                {(stage.adresse || stage.ville || stage.codePostal) && (
                  <div className="info-item full-width">
                    <span className="info-label"><MapPin size={12} /> Adresse</span>
                    <span className="info-value">
                      {stage.adresse && <>{stage.adresse}<br /></>}
                      {stage.codePostal && stage.ville
                        ? `${stage.codePostal} ${stage.ville}`
                        : stage.ville || stage.codePostal || ''}
                    </span>
                  </div>
                )}
                {stage.tuteur && (
                  <div className="info-item">
                    <span className="info-label"><UserCircle size={12} /> Tuteur</span>
                    <span className="info-value">{stage.tuteur}</span>
                  </div>
                )}
                {stage.tuteurTel && (
                  <div className="info-item">
                    <span className="info-label"><Phone size={12} /> Téléphone</span>
                    <span className="info-value">
                      <a href={`tel:${stage.tuteurTel.replace(/\s/g, '')}`} className="link-phone">
                        {stage.tuteurTel}
                      </a>
                    </span>
                  </div>
                )}
                {stage.tuteurEmail && (
                  <div className="info-item">
                    <span className="info-label"><Mail size={12} /> Email</span>
                    <span className="info-value">
                      <a href={`mailto:${stage.tuteurEmail}`} className="link-email">
                        {stage.tuteurEmail}
                      </a>
                    </span>
                  </div>
                )}
                {(stage.dateDebut || stage.dateFin) && (
                  <div className="info-item">
                    <span className="info-label"><Calendar size={12} /> Dates</span>
                    <span className="info-value">
                      {stage.dateDebut && new Date(stage.dateDebut).toLocaleDateString('fr-FR')}
                      {stage.dateDebut && stage.dateFin && ' → '}
                      {stage.dateFin && new Date(stage.dateFin).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
                {/* Géolocalisation info */}
                {stage.lat && stage.lon && (
                  <div className="info-item">
                    <span className="info-label">Géolocalisation</span>
                    <span className="info-value geo-status">
                      {stage.geoPrecision === 'FULL' && <span className="geo-badge geo-full">✓ Précise</span>}
                      {stage.geoPrecision === 'CITY' && <span className="geo-badge geo-city">~ Ville</span>}
                      {stage.geoPrecision === 'TOWNHALL' && <span className="geo-badge geo-townhall">~ Mairie</span>}
                      {!stage.geoPrecision && <span className="geo-badge">Géocodé</span>}
                    </span>
                  </div>
                )}
                {!stage.lat && !stage.lon && stage.adresse && (
                  <div className="info-item">
                    <span className="info-label">Géolocalisation</span>
                    <span className="info-value geo-status">
                      <span className="geo-badge geo-error">✗ Non géocodé</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Champs personnalisés */}
          {customFieldDefinitions.length > 0 && (
            <div className="info-section">
              <h4><Settings size={16} /> Critères personnalisés</h4>
              <div className="info-grid">
                {customFieldDefinitions.map(fd => (
                  <div key={fd.id} className="info-item">
                    <span className="info-label">{fd.label}</span>
                    <span className="info-value">
                      {formatCustomValue(eleve.customFields?.[fd.key], fd.type)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affectation actuelle */}
          {affectation && enseignant && (
            <div className="info-section affectation-section">
              <h4><Users size={16} /> Affectation actuelle</h4>
              <div className="affectation-info">
                <div className="enseignant-badge">
                  <span className="enseignant-name">{enseignant.prenom} {enseignant.nom}</span>
                  <span className="enseignant-matiere">{enseignant.matierePrincipale}</span>
                </div>
                {affectation.type && (
                  <span className="affectation-type">{affectation.type}</span>
                )}
              </div>
            </div>
          )}

          {/* Métadonnées */}
          <div className="info-section metadata-section">
            <div className="metadata">
              <Clock size={12} />
              {eleve.createdAt && (
                <span>Créé le {new Date(eleve.createdAt).toLocaleDateString('fr-FR')}</span>
              )}
              {eleve.updatedAt && (
                <span>• Modifié le {new Date(eleve.updatedAt).toLocaleDateString('fr-FR')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
