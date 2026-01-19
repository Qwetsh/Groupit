// ============================================================
// MODAL - AJOUTER/ÉDITER ENSEIGNANT
// ============================================================

import React, { useState, useEffect } from 'react';
import { X, Save, UserCog, MapPin, Check, AlertCircle } from 'lucide-react';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useUIStore } from '../../stores/uiStore';
import { useFieldDefinitionStore } from '../../stores/fieldDefinitionStore';
import { createGeoProvider } from '../../infrastructure/geo/geocode';
import type { FieldDefinition } from '../../domain/models';
import './Modal.css';

interface EnseignantModalProps {
  onClose: () => void;
}

const MATIERES = [
  'Français',
  'Mathématiques',
  'Histoire-Géographie',
  'SVT',
  'Physique-Chimie',
  'Anglais',
  'Espagnol',
  'Allemand',
  'Chinois',
  'Technologie',
  'Arts plastiques',
  'Éducation musicale',
  'EPS',
  'Latin',
  'Grec',
  'Documentation',
  'ULIS TFC',
];

// Composant pour rendre un champ personnalisé selon son type
function CustomFieldInput({ 
  fieldDef, 
  value, 
  onChange 
}: { 
  fieldDef: FieldDefinition; 
  value: unknown; 
  onChange: (val: unknown) => void;
}) {
  switch (fieldDef.type) {
    case 'boolean':
      return (
        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={e => onChange(e.target.checked)}
            />
            {fieldDef.label}
          </label>
        </div>
      );

    case 'select':
      return (
        <div className="form-group">
          <label>{fieldDef.label}</label>
          <select
            value={String(value || '')}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">-</option>
            {fieldDef.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'number':
      return (
        <div className="form-group">
          <label>{fieldDef.label}</label>
          <input
            type="number"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      );

    case 'date':
      return (
        <div className="form-group">
          <label>{fieldDef.label}</label>
          <input
            type="date"
            value={String(value || '')}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      );

    default:
      return (
        <div className="form-group">
          <label>{fieldDef.label}</label>
          <input
            type="text"
            value={String(value || '')}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      );
  }
}

export function EnseignantModal({ onClose }: EnseignantModalProps) {
  const enseignants = useEnseignantStore(state => state.enseignants);
  const addEnseignant = useEnseignantStore(state => state.addEnseignant);
  const updateEnseignant = useEnseignantStore(state => state.updateEnseignant);
  const modalData = useUIStore(state => state.modalData) as { enseignantId?: string } | null;
  const getFieldDefinitionsForEntity = useFieldDefinitionStore(s => s.getFieldDefinitionsForEntity);
  
  // Récupérer les définitions de champs custom pour les enseignants
  const customFieldDefinitions = getFieldDefinitionsForEntity('enseignant');
  
  // Find enseignant if editing
  const enseignant = modalData?.enseignantId 
    ? enseignants.find(e => e.id === modalData.enseignantId)
    : undefined;
  
  // Initialize form data with enseignant data if editing
  const [formData, setFormData] = useState(() => {
    if (enseignant) {
      return {
        nom: enseignant.nom || '',
        prenom: enseignant.prenom || '',
        matierePrincipale: enseignant.matierePrincipale || '',
        classesEnCharge: enseignant.classesEnCharge || [],
        estProfPrincipal: enseignant.estProfPrincipal || false,
        classePP: enseignant.classePP || '',
        adresse: enseignant.adresse || '',
        commune: enseignant.commune || '',
        capaciteBase: enseignant.capaciteBase,
        tags: enseignant.tags || [],
      };
    }
    return {
      nom: '',
      prenom: '',
      matierePrincipale: '',
      classesEnCharge: [] as string[],
      estProfPrincipal: false,
      classePP: '',
      adresse: '',
      commune: '',
      capaciteBase: undefined as number | undefined,
      tags: [] as string[],
    };
  });
  
  // État pour les champs custom
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(() => {
    return enseignant?.customFields || {};
  });
  const [classesInput, setClassesInput] = useState(() => enseignant?.classesEnCharge?.join(', ') || '');
  const [tagsInput, setTagsInput] = useState(() => enseignant?.tags?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // État pour le géocodage
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);

  const isEditing = !!enseignant;

  useEffect(() => {
    if (enseignant) {
      setFormData({
        nom: enseignant.nom || '',
        prenom: enseignant.prenom || '',
        matierePrincipale: enseignant.matierePrincipale || '',
        classesEnCharge: enseignant.classesEnCharge || [],
        estProfPrincipal: enseignant.estProfPrincipal || false,
        classePP: enseignant.classePP || '',
        adresse: enseignant.adresse || '',
        commune: enseignant.commune || '',
        capaciteBase: enseignant.capaciteBase,
        tags: enseignant.tags || [],
      });
      setClassesInput(enseignant.classesEnCharge?.join(', ') || '');
      setTagsInput(enseignant.tags?.join(', ') || '');
      setCustomValues(enseignant.customFields || {});
    } else {
      // Reset form for new enseignant
      setFormData({
        nom: '',
        prenom: '',
        matierePrincipale: '',
        classesEnCharge: [],
        estProfPrincipal: false,
        classePP: '',
        adresse: '',
        commune: '',
        capaciteBase: undefined,
        tags: [],
      });
      setClassesInput('');
      setTagsInput('');
      setCustomValues({});
    }
  }, [modalData?.enseignantId, enseignants]);

  // Auto-géocoder l'adresse complète
  const geocodeAddress = async (adresse: string, commune: string): Promise<{ lat?: number; lon?: number; geoStatus: string }> => {
    const fullAddress = [adresse, commune].filter(Boolean).join(', ');
    if (!fullAddress.trim()) {
      return { geoStatus: 'pending' };
    }

    try {
      const provider = createGeoProvider('nominatim');
      const result = await provider.geocode(fullAddress);
      
      if (result.success && result.point) {
        return {
          lat: result.point.lat,
          lon: result.point.lon,
          geoStatus: 'ok',
        };
      } else {
        return { geoStatus: 'error' };
      }
    } catch {
      return { geoStatus: 'error' };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.nom.trim()) {
      setError('Le nom est obligatoire');
      return;
    }
    if (!formData.prenom.trim()) {
      setError('Le prénom est obligatoire');
      return;
    }
    if (!formData.matierePrincipale) {
      setError('La matière principale est obligatoire');
      return;
    }

    setSaving(true);
    setIsGeocoding(true);
    setGeocodeStatus('idle');
    setGeocodeMessage(null);

    try {
      const classes = classesInput
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
      
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Auto-géocodage si adresse présente
      let geoData: { lat?: number; lon?: number; geoStatus?: string } = {};
      const hasAddress = formData.adresse?.trim() || formData.commune?.trim();
      const addressChanged = !enseignant || 
        enseignant.adresse !== formData.adresse || 
        enseignant.commune !== formData.commune;
      
      if (hasAddress && addressChanged) {
        geoData = await geocodeAddress(formData.adresse, formData.commune);
        if (geoData.geoStatus === 'ok') {
          setGeocodeStatus('success');
          setGeocodeMessage('Adresse géocodée');
        } else if (geoData.geoStatus === 'error') {
          setGeocodeStatus('error');
          setGeocodeMessage('Adresse non trouvée');
        }
      }

      const enseignantData = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        matierePrincipale: formData.matierePrincipale,
        classesEnCharge: classes,
        estProfPrincipal: formData.estProfPrincipal,
        classePP: formData.estProfPrincipal ? formData.classePP : undefined,
        adresse: formData.adresse || undefined,
        commune: formData.commune || undefined,
        capaciteBase: formData.capaciteBase,
        tags,
        // Champs personnalisés
        customFields: Object.keys(customValues).length > 0 ? customValues : undefined,
        // Données de géocodage
        ...(geoData.lat !== undefined && { lat: geoData.lat }),
        ...(geoData.lon !== undefined && { lon: geoData.lon }),
        ...(geoData.geoStatus && { geoStatus: geoData.geoStatus as 'pending' | 'ok' | 'error' | 'manual' }),
      };

      if (isEditing && enseignant) {
        await updateEnseignant(enseignant.id!, enseignantData);
      } else {
        await addEnseignant(enseignantData);
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
      setIsGeocoding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <UserCog size={20} />
            <h2>{isEditing ? 'Modifier l\'enseignant' : 'Ajouter un enseignant'}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="form-error">{error}</div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="nom">Nom *</label>
                <input
                  type="text"
                  id="nom"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="DUPONT"
                />
              </div>
              <div className="form-group">
                <label htmlFor="prenom">Prénom *</label>
                <input
                  type="text"
                  id="prenom"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  placeholder="Marie"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="matiere">Matière principale *</label>
              <select
                id="matiere"
                value={formData.matierePrincipale}
                onChange={e => setFormData({ ...formData, matierePrincipale: e.target.value })}
              >
                <option value="">Sélectionner une matière</option>
                {MATIERES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="classes">Classes en charge</label>
              <input
                type="text"
                id="classes"
                value={classesInput}
                onChange={e => setClassesInput(e.target.value)}
                placeholder="3A, 3B, 4C (séparées par des virgules)"
              />
              <span className="form-hint">Séparez les classes par des virgules</span>
            </div>

            <div className="form-row">
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.estProfPrincipal}
                    onChange={e => setFormData({ ...formData, estProfPrincipal: e.target.checked })}
                  />
                  Professeur principal
                </label>
              </div>
              {formData.estProfPrincipal && (
                <div className="form-group">
                  <label htmlFor="classePP">Classe PP</label>
                  <input
                    type="text"
                    id="classePP"
                    value={formData.classePP}
                    onChange={e => setFormData({ ...formData, classePP: e.target.value })}
                    placeholder="3A"
                  />
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="adresse">
                  Adresse
                  {enseignant?.geoStatus === 'ok' && (
                    <span className="geo-badge success" title="Géocodée">
                      <MapPin size={12} /> <Check size={10} />
                    </span>
                  )}
                  {enseignant?.geoStatus === 'error' && (
                    <span className="geo-badge error" title="Non trouvée">
                      <MapPin size={12} /> <AlertCircle size={10} />
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  id="adresse"
                  value={formData.adresse}
                  onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                  placeholder="12 rue des Lilas"
                />
              </div>
              <div className="form-group">
                <label htmlFor="commune">Commune</label>
                <input
                  type="text"
                  id="commune"
                  value={formData.commune}
                  onChange={e => setFormData({ ...formData, commune: e.target.value })}
                  placeholder="Paris"
                />
              </div>
            </div>
            
            {/* Indicateur de géocodage */}
            {(formData.adresse || formData.commune) && (
              <div className="geo-info">
                <MapPin size={14} />
                {isGeocoding ? (
                  <span className="geo-status loading">Géocodage en cours...</span>
                ) : geocodeStatus === 'success' ? (
                  <span className="geo-status success">{geocodeMessage}</span>
                ) : geocodeStatus === 'error' ? (
                  <span className="geo-status error">{geocodeMessage}</span>
                ) : (
                  <span className="geo-status pending">L'adresse sera géocodée à l'enregistrement</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="capacite">Capacité max (optionnel)</label>
              <input
                type="number"
                id="capacite"
                min="0"
                value={formData.capaciteBase ?? ''}
                onChange={e => setFormData({ 
                  ...formData, 
                  capaciteBase: e.target.value ? Number(e.target.value) : undefined 
                })}
                placeholder="Laissez vide pour calcul automatique"
              />
              <span className="form-hint">Nombre max d'élèves à superviser</span>
            </div>

            <div className="form-group">
              <label htmlFor="tags">Tags</label>
              <input
                type="text"
                id="tags"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                placeholder="Volontaire DNB, Tuteur stage (séparés par des virgules)"
              />
            </div>

            {/* Champs personnalisés */}
            {customFieldDefinitions.length > 0 && (
              <div className="custom-fields-section">
                <h4 className="section-title">Critères personnalisés</h4>
                {customFieldDefinitions.map(fd => (
                  <CustomFieldInput
                    key={fd.id}
                    fieldDef={fd}
                    value={customValues[fd.key]}
                    onChange={(val) => setCustomValues(prev => ({ ...prev, [fd.key]: val }))}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Enregistrement...' : (isEditing ? 'Enregistrer' : 'Ajouter')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
