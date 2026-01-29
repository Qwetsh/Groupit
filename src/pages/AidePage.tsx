// ============================================================
// AIDE PAGE - Documentation et tutoriels interactifs
// ============================================================

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  Rocket,
  Layout,
  HelpCircle,
  BookOpen,
  Mail,
  Play,
  RotateCcw,
  CheckCircle,
  Download,
  Info,
  GraduationCap,
  FileText,
  Plus,
  Briefcase,
  Mic,
  Users,
  Save,
  Settings
} from 'lucide-react';
import './AidePage.css';

// ============================================================
// TYPES
// ============================================================

interface AccordionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

interface FAQItemProps {
  question: string;
  answer: string;
}

interface TooltipPosition {
  top: number;
  left: number;
}

// ============================================================
// ACCORDION COMPONENT
// ============================================================

function Accordion({ icon, title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`aide-accordion ${isOpen ? 'open' : ''}`}>
      <button className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="icon">{icon}</span>
        <span>{title}</span>
        <ChevronDown size={18} className="chevron" />
      </button>
      <div className="accordion-content">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// FAQ ITEM COMPONENT
// ============================================================

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`faq-item ${isOpen ? 'open' : ''}`}>
      <button className="faq-question" onClick={() => setIsOpen(!isOpen)}>
        <span>{question}</span>
        <ChevronDown size={16} className="chevron" />
      </button>
      <div className="faq-answer">{answer}</div>
    </div>
  );
}

// ============================================================
// SCHEMA HOTSPOT WITH PORTAL TOOLTIP
// ============================================================

function SchemaHotspot({
  children,
  tooltipTitle,
  tooltipContent,
  className = ''
}: {
  children: React.ReactNode;
  tooltipTitle: string;
  tooltipContent: React.ReactNode;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const tooltipWidth = 250;
      const tooltipHeight = 120;
      const padding = 12;

      // Calculer la position optimale
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      let top = rect.bottom + padding;

      // Ajuster si dépasse à droite
      if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }
      // Ajuster si dépasse à gauche
      if (left < padding) {
        left = padding;
      }
      // Si dépasse en bas, afficher au-dessus
      if (top + tooltipHeight > window.innerHeight - padding) {
        top = rect.top - tooltipHeight - padding;
      }

      setPosition({ top, left });
    }
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <div
      ref={ref}
      className={`schema-hotspot ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && createPortal(
        <div
          className="schema-tooltip visible"
          style={{ top: position.top, left: position.left }}
        >
          <div className="schema-tooltip-title">{tooltipTitle}</div>
          {tooltipContent}
        </div>,
        document.body
      )}
    </div>
  );
}

// ============================================================
// SCHÉMA INTERACTIF - BOARD
// ============================================================

function BoardSchema() {
  return (
    <div className="schema-container">
      <div className="schema-board">
        {/* Toolbar */}
        <SchemaHotspot
          className="schema-toolbar"
          tooltipTitle="Barre d'outils"
          tooltipContent={
            <>
              <strong>Lancer</strong> : lance l'algorithme d'affectation automatique.<br />
              <strong>Reset</strong> : supprime toutes les affectations.<br />
              <strong>Valider</strong> : archive le scénario une fois satisfait.<br />
              <strong>Export</strong> : sauvegarde la session en fichier JSON.
            </>
          }
        >
          <div className="schema-toolbar-btn primary">
            <Play size={10} /> Lancer
          </div>
          <div className="schema-toolbar-btn">
            <RotateCcw size={10} /> Reset
          </div>
          <div className="schema-toolbar-btn success">
            <CheckCircle size={10} /> Valider
          </div>
          <div className="schema-toolbar-btn">
            <Download size={10} /> Export
          </div>
        </SchemaHotspot>

        {/* Messages */}
        <SchemaHotspot
          className="schema-messages"
          tooltipTitle="Messages"
          tooltipContent="Affiche les informations importantes : nombre de stages géocodés, résultats du matching, erreurs éventuelles, et succès de validation."
        >
          <Info size={12} />
          <span>Zone d'informations et alertes</span>
        </SchemaHotspot>

        {/* Colonnes */}
        <div className="schema-columns">
          {/* Colonne élèves */}
          <SchemaHotspot
            className="schema-column"
            tooltipTitle="Élèves non affectés"
            tooltipContent={
              <>
                Liste des élèves en attente d'affectation.
                <strong> Glissez-déposez</strong> un élève vers un enseignant pour l'affecter manuellement,
                ou utilisez le bouton "Lancer" pour une affectation automatique.
              </>
            }
          >
            <div className="schema-column-header">
              <span className="schema-column-title">Élèves à affecter</span>
              <span className="schema-badge">12</span>
            </div>
            <div className="schema-eleves-wrapper">
              <div className="schema-eleves">
                <div className="schema-eleve">
                  <span className="schema-eleve-dot"></span>
                  Martin Lucas
                </div>
                <div className="schema-eleve">
                  <span className="schema-eleve-dot"></span>
                  Dupont Marie
                </div>
                <div className="schema-eleve">
                  <span className="schema-eleve-dot"></span>
                  Bernard Julie
                </div>
              </div>
              <span className="schema-drag-arrow">→</span>
            </div>
          </SchemaHotspot>

          {/* Colonne résultats */}
          <SchemaHotspot
            className="schema-column"
            tooltipTitle="Enseignants et affectations"
            tooltipContent={
              <>
                Chaque carte représente un enseignant avec ses élèves affectés.
                <strong> Cliquez</strong> sur une carte pour voir les trajets sur la carte.
                <strong> Clic droit</strong> sur un élève pour le désaffecter ou voir ses infos.
              </>
            }
          >
            <div className="schema-column-header">
              <span className="schema-column-title">Résultats</span>
              <span className="schema-badge">8 affectations</span>
            </div>
            <div className="schema-results-grid">
              <div className="schema-enseignant">
                <div className="schema-enseignant-header">
                  <span className="schema-enseignant-icon"><GraduationCap size={8} /></span>
                  Mme Petit
                </div>
                <div className="schema-enseignant-eleves">
                  <div className="schema-affecte">
                    <span className="schema-affecte-dot"></span>
                    Durand Paul
                  </div>
                  <div className="schema-affecte">
                    <span className="schema-affecte-dot"></span>
                    Moreau Léa
                  </div>
                </div>
              </div>
              <div className="schema-enseignant">
                <div className="schema-enseignant-header">
                  <span className="schema-enseignant-icon"><GraduationCap size={8} /></span>
                  M. Grand
                </div>
                <div className="schema-enseignant-eleves">
                  <div className="schema-affecte">
                    <span className="schema-affecte-dot"></span>
                    Simon Emma
                  </div>
                </div>
              </div>
            </div>
          </SchemaHotspot>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SCHÉMA INTERACTIF - SCÉNARIO
// ============================================================

function ScenarioSchema() {
  return (
    <div className="schema-container">
      <div className="schema-scenario">
        {/* Header modal */}
        <div className="schema-modal-header">
          <div className="schema-modal-title">
            <Plus size={12} />
            <span>Nouveau scénario</span>
          </div>
          <div className="schema-modal-close">×</div>
        </div>

        {/* Contenu modal */}
        <div className="schema-modal-body">
          {/* Étape 1: Type */}
          <SchemaHotspot
            className="schema-section"
            tooltipTitle="1. Choisir le type"
            tooltipContent={
              <>
                <strong>Suivi de stage</strong> : affecte les élèves stagiaires aux enseignants tuteurs selon la distance géographique.<br /><br />
                <strong>Oral du DNB</strong> : répartit les élèves dans des jurys selon leurs matières choisies.
              </>
            }
          >
            <div className="schema-section-title">
              <span className="schema-step-num">1</span>
              Type de scénario
            </div>
            <div className="schema-type-cards">
              <div className="schema-type-card">
                <Briefcase size={16} />
                <span>Suivi de stage</span>
              </div>
              <div className="schema-type-card selected">
                <Mic size={16} />
                <span>Oral du DNB</span>
              </div>
            </div>
          </SchemaHotspot>

          {/* Étape 2: Nom */}
          <SchemaHotspot
            className="schema-section"
            tooltipTitle="2. Nommer le scénario"
            tooltipContent="Donnez un nom explicite à votre scénario (ex: 'Oral DNB 2025', 'Stage 3e Janvier'). Vous pouvez aussi ajouter une description optionnelle."
          >
            <div className="schema-section-title">
              <span className="schema-step-num">2</span>
              Informations
            </div>
            <div className="schema-form-field">
              <div className="schema-input">Oral DNB 2025</div>
            </div>
          </SchemaHotspot>

          {/* Étape 3: Filtres */}
          <SchemaHotspot
            className="schema-section"
            tooltipTitle="3. Filtrer les participants"
            tooltipContent={
              <>
                <strong>Filtres élèves</strong> : sélectionnez les niveaux (3e, 4e...) ou classes spécifiques à inclure.<br /><br />
                <strong>Filtres enseignants</strong> : filtrez par matière, classes en charge, ou sélectionnez uniquement les professeurs principaux.
              </>
            }
          >
            <div className="schema-section-title">
              <span className="schema-step-num">3</span>
              Filtres
            </div>
            <div className="schema-filters-row">
              <div className="schema-filter-box">
                <Users size={12} />
                <span>Élèves: 3e</span>
                <span className="schema-filter-count">124</span>
              </div>
              <div className="schema-filter-box">
                <GraduationCap size={12} />
                <span>Enseignants: Tous</span>
                <span className="schema-filter-count">45</span>
              </div>
            </div>
          </SchemaHotspot>

          {/* Étape 4: Critères */}
          <SchemaHotspot
            className="schema-section"
            tooltipTitle="4. Configurer les critères"
            tooltipContent={
              <>
                Les critères déterminent comment l'algorithme affecte les élèves :<br /><br />
                <strong>Distance</strong> : minimise les trajets enseignant-stage<br />
                <strong>Équilibrage</strong> : répartit équitablement la charge<br />
                <strong>Matière</strong> : privilégie la correspondance de matière<br /><br />
                Choisissez la priorité : <strong>Désactivé</strong>, <strong>Faible</strong>, <strong>Normal</strong> ou <strong>Élevé</strong>.
              </>
            }
          >
            <div className="schema-section-title">
              <span className="schema-step-num">4</span>
              Critères de scoring
            </div>
            <div className="schema-criteres-list">
              {/* Critère Distance */}
              <div className="schema-critere-card">
                <div className="schema-critere-info">
                  <span className="schema-critere-name">Distance</span>
                </div>
                <div className="schema-priority-group">
                  <span className="schema-priority-btn">Dés.</span>
                  <span className="schema-priority-btn">Faible</span>
                  <span className="schema-priority-btn">Normal</span>
                  <span className="schema-priority-btn active" data-priority="high">Élevé</span>
                </div>
              </div>
              {/* Critère Équilibrage */}
              <div className="schema-critere-card">
                <div className="schema-critere-info">
                  <span className="schema-critere-name">Équilibrage</span>
                </div>
                <div className="schema-priority-group">
                  <span className="schema-priority-btn">Dés.</span>
                  <span className="schema-priority-btn">Faible</span>
                  <span className="schema-priority-btn active" data-priority="normal">Normal</span>
                  <span className="schema-priority-btn">Élevé</span>
                </div>
              </div>
              {/* Critère Matière */}
              <div className="schema-critere-card">
                <div className="schema-critere-info">
                  <span className="schema-critere-name">Matière</span>
                </div>
                <div className="schema-priority-group">
                  <span className="schema-priority-btn">Dés.</span>
                  <span className="schema-priority-btn active" data-priority="low">Faible</span>
                  <span className="schema-priority-btn">Normal</span>
                  <span className="schema-priority-btn">Élevé</span>
                </div>
              </div>
            </div>
          </SchemaHotspot>

          {/* Étape 5: Capacité */}
          <SchemaHotspot
            className="schema-section"
            tooltipTitle="5. Définir la capacité"
            tooltipContent={
              <>
                La <strong>capacité</strong> définit le nombre maximum d'élèves par enseignant.<br /><br />
                Pour le suivi de stage, vous pouvez activer le <strong>calcul automatique</strong> basé sur les heures de cours de chaque enseignant.
              </>
            }
          >
            <div className="schema-section-title">
              <span className="schema-step-num">5</span>
              Capacité
            </div>
            <div className="schema-capacity">
              <Settings size={12} />
              <span>Max élèves/enseignant :</span>
              <span className="schema-capacity-value">8</span>
            </div>
          </SchemaHotspot>
        </div>

        {/* Footer modal */}
        <SchemaHotspot
          className="schema-modal-footer"
          tooltipTitle="Enregistrer"
          tooltipContent="Cliquez sur 'Créer' pour sauvegarder votre scénario. Vous pourrez le modifier à tout moment depuis la page Scénarios."
        >
          <div className="schema-btn-cancel">Annuler</div>
          <div className="schema-btn-save">
            <Save size={10} />
            Créer le scénario
          </div>
        </SchemaHotspot>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AidePage: React.FC = () => {
  return (
    <div className="aide-page">
      <h1>Aide</h1>
      <p className="lead">
        Guides et ressources pour prendre en main Groupit et optimiser vos affectations.
      </p>

      {/* Guide de démarrage */}
      <Accordion
        icon={<Rocket size={18} />}
        title="Guide de démarrage rapide"
        defaultOpen={true}
      >
        <p>Suivez ces 5 étapes pour réaliser votre première affectation :</p>
        <div className="guide-steps">
          <div className="guide-step">
            <span className="step-number">1</span>
            <div className="step-content">
              <div className="step-title">Importer les élèves</div>
              <div className="step-desc">
                Allez dans <strong>Élèves</strong> et importez votre fichier CSV.
                Les colonnes attendues : Nom, Prénom, Classe, et éventuellement les informations de stage.
              </div>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">2</span>
            <div className="step-content">
              <div className="step-title">Importer les enseignants</div>
              <div className="step-desc">
                Allez dans <strong>Enseignants</strong> et importez votre fichier CSV.
                Incluez l'adresse si vous utilisez le critère de distance.
              </div>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">3</span>
            <div className="step-content">
              <div className="step-title">Géocoder les adresses</div>
              <div className="step-desc">
                <strong>Enseignants</strong> : dans <strong>Données</strong>, lancez le géocodage pour convertir leurs adresses en coordonnées GPS.<br />
                <strong>Stages</strong> : dans <strong>Élèves → onglet Stages</strong>, le géocodage se fait automatiquement après import CSV ou saisie manuelle.
              </div>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">4</span>
            <div className="step-content">
              <div className="step-title">Créer un scénario</div>
              <div className="step-desc">
                Dans <strong>Scénarios</strong>, créez un nouveau scénario (ex: "Suivi de stage 3e").
                Configurez les critères d'affectation et les filtres d'élèves.
              </div>
            </div>
          </div>
          <div className="guide-step">
            <span className="step-number">5</span>
            <div className="step-content">
              <div className="step-title">Lancer l'affectation</div>
              <div className="step-desc">
                Dans <strong>Affectations</strong>, cliquez sur "Lancer". L'algorithme affecte
                automatiquement les élèves. Ajustez manuellement si besoin, puis validez.
              </div>
            </div>
          </div>
        </div>
      </Accordion>

      {/* Découvrir l'interface */}
      <Accordion
        icon={<Layout size={18} />}
        title="Découvrir l'interface d'affectation"
      >
        <p>
          Survolez les différentes zones du schéma ci-dessous pour comprendre leur rôle :
        </p>
        <BoardSchema />
        <p style={{ marginTop: 12 }}>
          <strong>Astuce :</strong> Le glisser-déposer vous permet d'ajuster manuellement
          les affectations après le calcul automatique. Utilisez le clic droit pour accéder
          aux options contextuelles.
        </p>
      </Accordion>

      {/* Créer un scénario */}
      <Accordion
        icon={<FileText size={18} />}
        title="Créer un scénario"
      >
        <p>
          Survolez les différentes sections pour comprendre chaque étape de la configuration :
        </p>
        <ScenarioSchema />
        <p style={{ marginTop: 12 }}>
          <strong>Conseil :</strong> Commencez avec les critères par défaut, puis ajustez
          les poids après avoir observé les premiers résultats d'affectation.
        </p>
      </Accordion>

      {/* FAQ */}
      <Accordion
        icon={<HelpCircle size={18} />}
        title="Questions fréquentes"
      >
        <div className="faq-list">
          <FAQItem
            question="Quel format pour mon fichier CSV ?"
            answer="Utilisez un fichier CSV avec séparateur point-virgule (;) ou virgule (,).
            La première ligne doit contenir les en-têtes. Pour les élèves : Nom, Prénom, Classe sont obligatoires.
            Pour les enseignants : Nom, Prénom, Matière sont recommandés. Encodage UTF-8 conseillé."
          />
          <FAQItem
            question="Pourquoi certains stages sont 'sans coordonnées' ?"
            answer="Le géocodage n'a pas pu trouver l'adresse. Vérifiez que l'adresse est complète
            (numéro, rue, code postal, ville). Vous pouvez relancer le géocodage depuis la page Données
            après avoir corrigé les adresses."
          />
          <FAQItem
            question="Comment modifier une affectation manuellement ?"
            answer="Dans la page Affectations, glissez-déposez un élève d'un enseignant vers un autre,
            ou depuis la colonne 'Élèves à affecter'. Utilisez le clic droit sur un élève affecté
            pour le désaffecter."
          />
          <FAQItem
            question="Mes données sont-elles stockées en ligne ?"
            answer="Non, Groupit fonctionne 100% en local. Toutes vos données restent sur votre
            ordinateur dans le stockage de votre navigateur. Aucune donnée n'est envoyée vers un serveur externe."
          />
          <FAQItem
            question="Comment sauvegarder mon travail ?"
            answer="Utilisez le bouton 'Export' dans la page Affectations pour télécharger un fichier JSON.
            Ce fichier contient le scénario, les affectations et les données de stage.
            Vous pourrez le réimporter plus tard avec le bouton 'Import'."
          />
          <FAQItem
            question="Que signifie le score d'affectation ?"
            answer="Le score indique la qualité de l'affectation selon vos critères (distance, matière, etc.).
            Plus le score est élevé, meilleure est la correspondance. Un score faible peut indiquer
            un compromis (ex: distance élevée mais seul enseignant disponible)."
          />
        </div>
      </Accordion>

      {/* Glossaire */}
      <Accordion
        icon={<BookOpen size={18} />}
        title="Glossaire"
      >
        <div className="glossaire-grid">
          <div className="glossaire-item">
            <div className="glossaire-term">Scénario</div>
            <div className="glossaire-def">
              Configuration d'affectation : type (stage, oral), critères, filtres d'élèves.
            </div>
          </div>
          <div className="glossaire-item">
            <div className="glossaire-term">Affectation</div>
            <div className="glossaire-def">
              Lien entre un élève et un enseignant (ou jury) pour un scénario donné.
            </div>
          </div>
          <div className="glossaire-item">
            <div className="glossaire-term">Géocodage</div>
            <div className="glossaire-def">
              Conversion d'une adresse postale en coordonnées GPS (latitude/longitude).
            </div>
          </div>
          <div className="glossaire-item">
            <div className="glossaire-term">Critère</div>
            <div className="glossaire-def">
              Règle utilisée par l'algorithme : distance, matière, charge équilibrée...
            </div>
          </div>
          <div className="glossaire-item">
            <div className="glossaire-term">Capacité</div>
            <div className="glossaire-def">
              Nombre maximum d'élèves qu'un enseignant peut suivre.
            </div>
          </div>
          <div className="glossaire-item">
            <div className="glossaire-term">Validation</div>
            <div className="glossaire-def">
              Action d'archiver un scénario terminé. Les affectations deviennent définitives.
            </div>
          </div>
        </div>
      </Accordion>

      {/* Contact */}
      <Accordion
        icon={<Mail size={18} />}
        title="Besoin d'aide ?"
      >
        <p>
          Si vous rencontrez un problème ou avez une suggestion, n'hésitez pas à nous contacter :
        </p>
        <div className="contact-card">
          <div className="contact-icon">
            <Mail size={20} />
          </div>
          <div className="contact-info">
            <div className="contact-label">Email de support</div>
            <div className="contact-value">thomas.charles@ac-nancy-metz.fr</div>
          </div>
        </div>
      </Accordion>
    </div>
  );
};
