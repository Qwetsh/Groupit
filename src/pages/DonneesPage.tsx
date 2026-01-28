// ============================================================
// DONNÉES PAGE - Tableur éditable avec colonnes dynamiques
// ============================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useEleveStore } from '../stores/eleveStore';
import { useEnseignantStore } from '../stores/enseignantStore';
import { useFieldDefinitionStore } from '../stores/fieldDefinitionStore';
import type { Eleve, Enseignant, FieldType, EntityType } from '../domain/models';
import { calculateCapacitesStage } from '../domain/models';
import {
  X,
  Users,
  GraduationCap,
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
  MapPin,
} from 'lucide-react';
import { geocodeAddressWithFallback } from '../infrastructure/geo/stageGeoWorkflow';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useConfirm } from '../hooks/useConfirm';
import './DonneesPage.css';

// ============================================================
// TYPES
// ============================================================

type TabType = 'eleves' | 'enseignants';

interface ColumnDef {
  key: string;
  label: string;
  type: FieldType;
  isCore: boolean;
  options?: string[];
  width?: number;
  editable?: boolean;
  fieldDefId?: string;
}

// ============================================================
// COLONNES CORE (fixes)
// ============================================================

const ELEVE_CORE_COLUMNS: ColumnDef[] = [
  { key: 'nom', label: 'Nom', type: 'text', isCore: true, editable: true },
  { key: 'prenom', label: 'Prénom', type: 'text', isCore: true, editable: true },
  { key: 'classe', label: 'Classe', type: 'text', isCore: true, editable: true },
  { key: 'dateNaissance', label: 'Date naissance', type: 'date', isCore: true, editable: true },
  { key: 'sexe', label: 'Sexe', type: 'select', isCore: true, options: ['M', 'F', 'Autre'], editable: true },
  { key: 'email', label: 'Email', type: 'text', isCore: true, editable: true },
  { key: 'regime', label: 'Régime', type: 'text', isCore: true, editable: true },
];

const ENSEIGNANT_CORE_COLUMNS: ColumnDef[] = [
  { key: 'nom', label: 'Nom', type: 'text', isCore: true, editable: true },
  { key: 'prenom', label: 'Prénom', type: 'text', isCore: true, editable: true },
  { key: 'matierePrincipale', label: 'Matière', type: 'text', isCore: true, editable: true },
  { key: 'estProfPrincipal', label: 'Prof Principal', type: 'boolean', isCore: true, editable: true },
  { key: 'classePP', label: 'Classe PP', type: 'text', isCore: true, editable: true },
  { key: 'adresse', label: 'Adresse', type: 'text', isCore: true, editable: true },
  { key: 'commune', label: 'Commune', type: 'text', isCore: true, editable: true },
  { key: 'capaciteStage', label: 'Capacité stage', type: 'number', isCore: true, editable: false },
];

// ============================================================
// ADD FIELD MODAL
// ============================================================

interface AddFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (field: { 
    label: string; 
    entityType: EntityType; 
    type: FieldType; 
    options?: string[];
    defaultValue?: unknown;
  }) => void;
  defaultEntityType: EntityType;
}

function AddFieldModal({ isOpen, onClose, onSubmit, defaultEntityType }: AddFieldModalProps) {
  const [label, setLabel] = useState('');
  const [entityType, setEntityType] = useState<EntityType>(defaultEntityType);
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [defaultValue, setDefaultValue] = useState('');

  useEffect(() => {
    setEntityType(defaultEntityType);
  }, [defaultEntityType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const options = fieldType === 'select' || fieldType === 'multiselect'
      ? optionsText.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

    let parsedDefault: unknown = defaultValue || undefined;
    if (fieldType === 'boolean') parsedDefault = defaultValue === 'true';
    if (fieldType === 'number') parsedDefault = defaultValue ? Number(defaultValue) : undefined;

    onSubmit({ label: label.trim(), entityType, type: fieldType, options, defaultValue: parsedDefault });
    
    // Reset
    setLabel('');
    setFieldType('text');
    setOptionsText('');
    setDefaultValue('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="add-field-modal" onClick={onClose}>
      <div className="add-field-content" onClick={e => e.stopPropagation()}>
        <div className="add-field-header">
          <h3>Ajouter un critère</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="add-field-body">
            <div className="form-group">
              <label>Nom du critère *</label>
              <input 
                type="text" 
                value={label} 
                onChange={e => setLabel(e.target.value)}
                placeholder="Ex: Mange à la cantine"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>S'applique à</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value as EntityType)}>
                <option value="eleve">Élèves uniquement</option>
                <option value="enseignant">Enseignants uniquement</option>
                <option value="both">Les deux</option>
              </select>
            </div>

            <div className="form-group">
              <label>Type de valeur</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value as FieldType)}>
                <option value="text">Texte</option>
                <option value="number">Nombre</option>
                <option value="boolean">Oui/Non (checkbox)</option>
                <option value="select">Liste déroulante</option>
                <option value="multiselect">Sélection multiple</option>
                <option value="date">Date</option>
              </select>
            </div>

            {(fieldType === 'select' || fieldType === 'multiselect') && (
              <div className="form-group">
                <label>Options (séparées par des virgules)</label>
                <input 
                  type="text" 
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                />
                <span className="hint">Ex: Oui, Non, Parfois</span>
              </div>
            )}

            <div className="form-group">
              <label>Valeur par défaut (optionnel)</label>
              {fieldType === 'boolean' ? (
                <select value={defaultValue} onChange={e => setDefaultValue(e.target.value)}>
                  <option value="">Aucune</option>
                  <option value="true">Oui</option>
                  <option value="false">Non</option>
                </select>
              ) : (
                <input 
                  type={fieldType === 'number' ? 'number' : 'text'}
                  value={defaultValue}
                  onChange={e => setDefaultValue(e.target.value)}
                  placeholder="Valeur par défaut"
                />
              )}
            </div>
          </div>
          <div className="add-field-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-submit" disabled={!label.trim()}>
              Ajouter le critère
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// CELL EDITOR
// ============================================================

interface CellEditorProps {
  value: unknown;
  type: FieldType;
  options?: string[];
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

function CellEditor({ value, type, options, onSave, onCancel }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState<unknown>(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(localValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave(localValue);
  };

  switch (type) {
    case 'boolean':
      return (
        <div className="cell-checkbox">
          <input 
            type="checkbox" 
            checked={Boolean(localValue)} 
            onChange={e => { onSave(e.target.checked); }}
          />
        </div>
      );

    case 'select':
      return (
        <div className="cell-editor-wrapper">
          <select 
            className="cell-select"
            value={String(localValue || '')}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          >
            <option value="">-</option>
            {options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button className="cell-save-btn" onClick={handleSaveClick} title="Valider (Entrée)">
            <Check size={12} />
          </button>
        </div>
      );

    case 'number':
      return (
        <div className="cell-editor-wrapper">
          <input 
            ref={inputRef}
            type="number"
            className="cell-input"
            value={localValue === null || localValue === undefined ? '' : String(localValue)}
            onChange={e => setLocalValue(e.target.value ? Number(e.target.value) : null)}
            onKeyDown={handleKeyDown}
          />
          <button className="cell-save-btn" onClick={handleSaveClick} title="Valider (Entrée)">
            <Check size={12} />
          </button>
        </div>
      );

    case 'date':
      return (
        <div className="cell-editor-wrapper">
          <input 
            ref={inputRef}
            type="date"
            className="cell-input"
            value={String(localValue || '')}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="cell-save-btn" onClick={handleSaveClick} title="Valider (Entrée)">
            <Check size={12} />
          </button>
        </div>
      );

    default:
      return (
        <div className="cell-editor-wrapper">
          <input 
            ref={inputRef}
            type="text"
            className="cell-input"
            value={String(localValue || '')}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="cell-save-btn" onClick={handleSaveClick} title="Valider (Entrée)">
            <Check size={12} />
          </button>
        </div>
      );
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DonneesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('eleves');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClasse, setFilterClasse] = useState('');
  const [filterMatiere, setFilterMatiere] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('nom');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });

  // Confirm modal
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

  // Stores
  const eleves = useEleveStore(s => s.eleves);
  const loadEleves = useEleveStore(s => s.loadEleves);
  const updateEleve = useEleveStore(s => s.updateEleve);
  const deleteEleve = useEleveStore(s => s.deleteEleve);

  const enseignants = useEnseignantStore(s => s.enseignants);
  const loadEnseignants = useEnseignantStore(s => s.loadEnseignants);
  const updateEnseignant = useEnseignantStore(s => s.updateEnseignant);
  const deleteEnseignant = useEnseignantStore(s => s.deleteEnseignant);

  const fieldDefinitions = useFieldDefinitionStore(s => s.fieldDefinitions);
  const loadFieldDefinitions = useFieldDefinitionStore(s => s.loadFieldDefinitions);
  const addFieldDefinition = useFieldDefinitionStore(s => s.addFieldDefinition);
  const getFieldDefinitionsForEntity = useFieldDefinitionStore(s => s.getFieldDefinitionsForEntity);

  // Load data
  useEffect(() => {
    loadEleves();
    loadEnseignants();
    loadFieldDefinitions();
  }, [loadEleves, loadEnseignants, loadFieldDefinitions]);

  // Build columns
  const columns = useMemo(() => {
    const coreColumns = activeTab === 'eleves' ? ELEVE_CORE_COLUMNS : ENSEIGNANT_CORE_COLUMNS;
    const customFields = getFieldDefinitionsForEntity(activeTab === 'eleves' ? 'eleve' : 'enseignant');
    
    const customColumns: ColumnDef[] = customFields.map(fd => ({
      key: `custom_${fd.key}`,
      label: fd.label,
      type: fd.type,
      isCore: false,
      options: fd.options,
      editable: true,
      fieldDefId: fd.id,
    }));

    const actionColumn: ColumnDef = {
      key: '__actions',
      label: 'Actions',
      type: 'text',
      isCore: true,
      editable: false,
      width: 90,
    };

    return [...coreColumns, ...customColumns, actionColumn];
  }, [activeTab, getFieldDefinitionsForEntity, fieldDefinitions]);

  // Get unique classes and matieres for filters
  const distinctClasses = useMemo(() => {
    const classes = new Set(eleves.map(e => e.classe).filter(Boolean));
    return Array.from(classes).sort();
  }, [eleves]);

  const distinctMatieres = useMemo(() => {
    const matieres = new Set(enseignants.map(e => e.matierePrincipale).filter(Boolean));
    return Array.from(matieres).sort();
  }, [enseignants]);

  // Capacités stage calculées (heures × nb classes 3e)
  const capacitesStageCalculees = useMemo(() => {
    return calculateCapacitesStage(enseignants, eleves);
  }, [enseignants, eleves]);

  // Get cell value (core or custom) - must be defined before filteredData useMemo
  const getCellValue = useCallback((item: Eleve | Enseignant, key: string): unknown => {
    if (key.startsWith('custom_')) {
      const customKey = key.replace('custom_', '');
      return item.customFields?.[customKey];
    }
    // Capacité stage calculée automatiquement pour les enseignants
    if (key === 'capaciteStage' && 'matierePrincipale' in item) {
      return capacitesStageCalculees.get(item.id!) ?? 0;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (item as any)[key];
  }, [capacitesStageCalculees]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data: (Eleve | Enseignant)[] = activeTab === 'eleves' ? eleves : enseignants;

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item => 
        item.nom.toLowerCase().includes(query) ||
        item.prenom.toLowerCase().includes(query) ||
        ('classe' in item && item.classe?.toLowerCase().includes(query)) ||
        ('matierePrincipale' in item && item.matierePrincipale?.toLowerCase().includes(query))
      );
    }

    // Filter by classe (eleves)
    if (activeTab === 'eleves' && filterClasse) {
      data = (data as Eleve[]).filter(e => e.classe === filterClasse);
    }

    // Filter by matiere (enseignants)
    if (activeTab === 'enseignants' && filterMatiere) {
      data = (data as Enseignant[]).filter(e => e.matierePrincipale === filterMatiere);
    }

    // Sort
    data = [...data].sort((a, b) => {
      const aVal = getCellValue(a, sortColumn);
      const bVal = getCellValue(b, sortColumn);
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = String(aVal).localeCompare(String(bVal), 'fr', { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [activeTab, eleves, enseignants, searchQuery, filterClasse, filterMatiere, sortColumn, sortDirection, getCellValue]);

  // Save a single cell change immediately
  const saveCellChange = useCallback(async (id: string, key: string, value: unknown) => {
    setIsSaving(true);
    try {
      let updates: Partial<Eleve | Enseignant>;
      
      if (key.startsWith('custom_')) {
        const customKey = key.replace('custom_', '');
        if (activeTab === 'eleves') {
          const eleve = eleves.find(e => e.id === id);
          updates = { customFields: { ...eleve?.customFields, [customKey]: value } };
        } else {
          const enseignant = enseignants.find(e => e.id === id);
          updates = { customFields: { ...enseignant?.customFields, [customKey]: value } };
        }
      } else {
        updates = { [key]: value };
      }

      if (activeTab === 'eleves') {
        await updateEleve(id, updates as Partial<Eleve>);
      } else {
        await updateEnseignant(id, updates as Partial<Enseignant>);
        
        // Si on modifie l'adresse ou la commune, lancer le géocodage
        if (key === 'adresse' || key === 'commune') {
          const enseignant = enseignants.find(e => e.id === id);
          const adresse = key === 'adresse' ? String(value) : enseignant?.adresse;
          const commune = key === 'commune' ? String(value) : enseignant?.commune;
          
          if (adresse && commune) {
            const fullAddress = `${adresse}, ${commune}`;
            console.log(`🔍 Géocodage de: ${fullAddress}`);
            
            const result = await geocodeAddressWithFallback(fullAddress);
            
            if (result.point) {
              await updateEnseignant(id, {
                lat: result.point.lat,
                lon: result.point.lon,
                geoStatus: result.status,
                geoErrorMessage: undefined,
              });
              console.log(`✅ Géocodé: ${fullAddress} → (${result.point.lat}, ${result.point.lon}) [${result.precision}]`);
            } else {
              await updateEnseignant(id, {
                geoStatus: 'error',
                geoErrorMessage: result.errorMessage || 'Adresse non trouvée',
              });
              console.log(`❌ Échec géocodage: ${fullAddress} - ${result.errorMessage}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
      setEditingCell(null);
    }
  }, [activeTab, eleves, enseignants, updateEleve, updateEnseignant]);

  // Handle sort
  const handleSort = (columnKey: string) => {
    if (columnKey === '__actions') return; // Pas de tri sur la colonne actions
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Handle delete row
  const handleDeleteRow = useCallback(async (item: Eleve | Enseignant) => {
    const isEleve = activeTab === 'eleves';
    const label = `${item.prenom} ${item.nom}`;
    const confirmed = await confirm({
      title: 'Confirmer la suppression',
      message: `Supprimer ${isEleve ? "l'élève" : "l'enseignant"} "${label}" ?\n\nCette action est irréversible.`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
    });
    if (!confirmed) return;

    setIsSaving(true);
    try {
      if (isEleve) {
        await deleteEleve(item.id);
      } else {
        await deleteEnseignant(item.id);
      }
    } catch (err) {
      console.error('Erreur suppression:', err);
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, deleteEleve, deleteEnseignant, confirm]);

  // Handle add field
  const handleAddField = async (field: {
    label: string;
    entityType: EntityType;
    type: FieldType;
    options?: string[];
    defaultValue?: unknown;
  }) => {
    await addFieldDefinition(field);
  };

  // Géocoder toutes les adresses des enseignants
  const handleGeocodeAllEnseignants = useCallback(async () => {
    const toGeocode = enseignants.filter(e =>
      e.adresse && e.commune &&
      (e.geoStatus === 'pending' || e.geoStatus === 'error' || e.geoStatus === 'not_found' || !e.geoStatus)
    );

    if (toGeocode.length === 0) {
      alert('Tous les enseignants sont déjà géocodés !');
      return;
    }

    setIsGeocoding(true);
    setGeocodeProgress({ current: 0, total: toGeocode.length });

    try {
      for (let i = 0; i < toGeocode.length; i++) {
        const enseignant = toGeocode[i];
        setGeocodeProgress({ current: i + 1, total: toGeocode.length });

        const fullAddress = `${enseignant.adresse}, ${enseignant.commune}`;
        console.log(`🔍 [${i + 1}/${toGeocode.length}] Géocodage: ${fullAddress}`);

        try {
          const result = await geocodeAddressWithFallback(fullAddress);

          if (result.point) {
            await updateEnseignant(enseignant.id, {
              lat: result.point.lat,
              lon: result.point.lon,
              geoStatus: result.status,
              geoErrorMessage: undefined,
            });
            console.log(`✅ Géocodé: ${enseignant.nom} → (${result.point.lat}, ${result.point.lon}) [${result.precision}]`);
          } else {
            await updateEnseignant(enseignant.id, {
              geoStatus: 'error',
              geoErrorMessage: result.errorMessage || 'Adresse non trouvée',
            });
            console.log(`❌ Échec: ${enseignant.nom} - ${result.errorMessage}`);
          }
        } catch (err) {
          await updateEnseignant(enseignant.id, {
            geoStatus: 'error',
            geoErrorMessage: String(err),
          });
        }

        // Petit délai pour UI (rate limit géré par le provider hybride)
        await new Promise(r => setTimeout(r, 100));
      }

      alert(`Géocodage terminé ! ${toGeocode.length} adresses traitées.`);
    } catch (error) {
      console.error('Erreur géocodage:', error);
      alert('Erreur lors du géocodage: ' + String(error));
    } finally {
      setIsGeocoding(false);
      setGeocodeProgress({ current: 0, total: 0 });
    }
  }, [enseignants, updateEnseignant]);

  // Render cell value
  const renderCellValue = (item: Eleve | Enseignant, column: ColumnDef) => {
    const value = getCellValue(item, column.key);
    const isEditing = editingCell?.id === item.id && editingCell?.key === column.key;

    if (column.key === '__actions') {
      return (
        <div className="cell-actions">
          <button
            className="btn-delete-row"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteRow(item);
            }}
            title="Supprimer"
          >
            <X size={14} />
            Supprimer
          </button>
        </div>
      );
    }

    if (isEditing && column.editable) {
      return (
        <CellEditor
          value={value}
          type={column.type}
          options={column.options}
          onSave={(newVal) => saveCellChange(item.id, column.key, newVal)}
          onCancel={() => setEditingCell(null)}
        />
      );
    }

    // Display mode
    switch (column.type) {
      case 'boolean':
        return (
          <div className="cell-checkbox">
            <input 
              type="checkbox" 
              checked={Boolean(value)} 
              onChange={e => saveCellChange(item.id, column.key, e.target.checked)}
            />
          </div>
        );

      case 'multiselect':
        const tags = Array.isArray(value) ? value : [];
        return (
          <div className="cell-tags">
            {tags.map((tag, i) => (
              <span key={i} className="cell-tag">{tag}</span>
            ))}
          </div>
        );

      default:
        return (
          <div 
            className="cell-editable"
            onClick={() => column.editable && setEditingCell({ id: item.id, key: column.key })}
          >
            {value === null || value === undefined ? '-' : String(value)}
          </div>
        );
    }
  };

  return (
    <div className="donnees-page">
      <div className="donnees-header">
        <h1>Données</h1>
        {isSaving && (
          <div className="autosave-indicator">
            <Loader2 size={14} className="spinner" />
            <span>Sauvegarde...</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="donnees-tabs">
        <button 
          className={`donnees-tab ${activeTab === 'eleves' ? 'active' : ''}`}
          onClick={() => setActiveTab('eleves')}
        >
          <Users size={16} />
          Élèves
          <span className="tab-count">{eleves.length}</span>
        </button>
        <button 
          className={`donnees-tab ${activeTab === 'enseignants' ? 'active' : ''}`}
          onClick={() => setActiveTab('enseignants')}
        >
          <GraduationCap size={16} />
          Enseignants
          <span className="tab-count">{enseignants.length}</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="donnees-toolbar">
        <div className="donnees-search">
          <Search size={16} className="search-icon" />
          <input 
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === 'eleves' && (
          <div className="donnees-filter">
            <select value={filterClasse} onChange={e => setFilterClasse(e.target.value)}>
              <option value="">Toutes les classes</option>
              {distinctClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'enseignants' && (
          <div className="donnees-filter">
            <select value={filterMatiere} onChange={e => setFilterMatiere(e.target.value)}>
              <option value="">Toutes les matières</option>
              {distinctMatieres.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'enseignants' && (
          <button
            className="btn-geocode"
            onClick={handleGeocodeAllEnseignants}
            disabled={isGeocoding || isSaving}
            title="Géocoder toutes les adresses des enseignants"
          >
            {isGeocoding ? (
              <>
                <Loader2 size={16} className="spinner" />
                {geocodeProgress.current}/{geocodeProgress.total}
              </>
            ) : (
              <>
                <MapPin size={16} />
                Géocoder adresses
              </>
            )}
          </button>
        )}

        <button className="btn-add-field" onClick={() => setShowAddFieldModal(true)}>
          <Plus size={16} />
          Ajouter un critère
        </button>
      </div>

      {/* Table */}
      <div className="donnees-table-container">
        {filteredData.length === 0 ? (
          <div className="donnees-empty">
            <Users size={48} />
            <p>Aucune donnée à afficher</p>
          </div>
        ) : (
          <table className="donnees-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th 
                    key={col.key}
                    className={`sortable ${sortColumn === col.key ? 'sorted' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="column-header">
                      <span>{col.label}</span>
                      {!col.isCore && <span className="custom-badge">custom</span>}
                      {sortColumn === col.key && (
                        <span className="sort-icon">
                          {sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => (
                <tr key={item.id} className={editingCell?.id === item.id ? 'editing' : ''}>
                  {columns.map(col => (
                    <td key={col.key}>
                      {renderCellValue(item, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Field Modal */}
      <AddFieldModal
        isOpen={showAddFieldModal}
        onClose={() => setShowAddFieldModal(false)}
        onSubmit={handleAddField}
        defaultEntityType={activeTab === 'eleves' ? 'eleve' : 'enseignant'}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};
