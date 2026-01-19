// ============================================================
// STAGE IMPORT STEP - Étape 1: Import & édition des stages
// ============================================================

import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useStageStore } from '../../stores/stageStore';
import type { Scenario, Stage, Eleve } from '../../domain/models';
import { Upload, FileText, AlertCircle, Check, X, Edit2, Trash2, ChevronRight, AlertTriangle } from 'lucide-react';

interface StageImportStepProps {
  scenario: Scenario;
  stages: Stage[];
  eleves: Eleve[];
  onComplete: () => void;
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; message: string }>;
  duplicates: number;
  warnings?: number; // Élèves non trouvés mais stages importés quand même
}

interface ParsedStageRow {
  nom: string;
  prenom: string;
  classe?: string;
  adresse: string;
  entreprise?: string;
}

// ============================================================
// HELPERS POUR LE PARSING CSV ROBUSTE
// ============================================================

// Normalise un nom d'en-tête pour la comparaison
function normalizeHeaderName(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprimer accents
    .replace(/[^a-z0-9]/g, '')       // supprimer caractères spéciaux
    .trim();
}

// Détecte l'encodage d'un buffer
function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'utf-8-bom';
  }
  // Vérifier si c'est de l'UTF-8 valide
  let isUtf8 = true;
  let i = 0;
  while (i < Math.min(bytes.length, 1000)) {
    if (bytes[i] <= 0x7F) {
      i++;
    } else if ((bytes[i] & 0xE0) === 0xC0 && i + 1 < bytes.length && (bytes[i + 1] & 0xC0) === 0x80) {
      i += 2;
    } else if ((bytes[i] & 0xF0) === 0xE0 && i + 2 < bytes.length && (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80) {
      i += 3;
    } else if ((bytes[i] & 0xF8) === 0xF0 && i + 3 < bytes.length && (bytes[i + 1] & 0xC0) === 0x80 && (bytes[i + 2] & 0xC0) === 0x80 && (bytes[i + 3] & 0xC0) === 0x80) {
      i += 4;
    } else {
      isUtf8 = false;
      break;
    }
  }
  return isUtf8 ? 'utf-8' : 'iso-8859-1';
}

// Détecte le séparateur CSV (point-virgule prioritaire pour fichiers français)
function detectSeparator(content: string): string {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const commaCount = (firstLines.match(/,/g) || []).length;
  // Le point-virgule est prioritaire car les adresses françaises contiennent souvent des virgules
  if (semicolonCount >= 3) return ';';
  if (commaCount > semicolonCount * 2) return ',';
  return ';'; // Défaut français
}

// Nettoie une valeur de cellule
function sanitizeValue(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/[\uFEFF\u0000]/g, '')  // BOM et null
    .replace(/\u00A0/g, ' ')          // Espace insécable
    .replace(/\r/g, '')               // CR
    .trim();
}

// Corrige les problèmes d'encodage courants (UTF-8 mal interprété en Latin-1)
function fixEncodingIssues(text: string): string {
  // Remplacements courants pour UTF-8 mal décodé
  const replacements: [RegExp, string][] = [
    [/â€™/g, "'"],           // apostrophe typographique
    [/â€"/g, "–"],           // tiret demi-cadratin
    [/â€œ/g, '"'],           // guillemet ouvrant
    [/â€\u009d/g, '"'],      // guillemet fermant
    [/Ã©/g, 'é'],
    [/Ã¨/g, 'è'],
    [/Ã /g, 'à'],
    [/Ã¢/g, 'â'],
    [/Ã´/g, 'ô'],
    [/Ã®/g, 'î'],
    [/Ã»/g, 'û'],
    [/Ã§/g, 'ç'],
    [/Ã«/g, 'ë'],
    [/Ã¯/g, 'ï'],
    [/Ã¼/g, 'ü'],
    [/Å"/g, 'œ'],
    [/Ã‰/g, 'É'],
    [/Ã€/g, 'À'],
    [/Ã‡/g, 'Ç'],
    [/Â°/g, '°'],
    [/Â /g, ' '],
  ];
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function StageImportStep({ scenario, stages, eleves, onComplete }: StageImportStepProps) {
  const { updateStage, deleteStage, bulkAddStages } = useStageStore();
  
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ adresse: '', entreprise: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normaliser une chaîne pour comparaison (accents, espaces, tirets)
  const normalize = (str: string): string => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[-_']/g, ' ')          // Remplacer tirets et apostrophes par espaces
      .replace(/\s+/g, ' ')            // Normaliser les espaces multiples
      .trim()
      .toLowerCase();
  };

  // Trouver l'élève correspondant par nom/prénom/classe (permissif)
  const findEleve = useCallback((nom: string, prenom: string, classe?: string): Eleve | undefined => {
    const csvNom = normalize(nom);
    const csvPrenom = normalize(prenom);
    const csvClasse = classe?.trim();
    
    // Stratégie 1: Match exact nom + prénom + classe
    let found = eleves.find(e => {
      const eleveNom = normalize(e.nom);
      const elevePrenom = normalize(e.prenom);
      return eleveNom === csvNom && 
             elevePrenom === csvPrenom && 
             (!csvClasse || e.classe === csvClasse);
    });
    if (found) return found;
    
    // Stratégie 2: Match nom + prénom (ignorer classe)
    found = eleves.find(e => {
      const eleveNom = normalize(e.nom);
      const elevePrenom = normalize(e.prenom);
      return eleveNom === csvNom && elevePrenom === csvPrenom;
    });
    if (found) return found;
    
    // Stratégie 3: Match partiel (le nom CSV contient le nom élève ou vice versa)
    // Utile pour "ELDEB Mohamed" (CSV) vs "ELDEB" (base)
    found = eleves.find(e => {
      const eleveNom = normalize(e.nom);
      const elevePrenom = normalize(e.prenom);
      const nomMatch = csvNom.includes(eleveNom) || eleveNom.includes(csvNom);
      const prenomMatch = csvPrenom.includes(elevePrenom) || elevePrenom.includes(csvPrenom);
      return nomMatch && prenomMatch && (!csvClasse || e.classe === csvClasse);
    });
    if (found) return found;
    
    // Stratégie 4: Nom composé dans le CSV peut être "NOM PRENOM2" avec prénom = "PRENOM1"
    // Ex: CSV nom="ELDEB Mohamed" prenom="Isam" -> chercher nom="ELDEB" prenom="Mohamed Isam" ou "Isam Mohamed"
    const csvNomParts = csvNom.split(' ');
    if (csvNomParts.length > 1) {
      const realNom = csvNomParts[0];
      const prenomExtra = csvNomParts.slice(1).join(' ');
      const fullPrenom1 = `${prenomExtra} ${csvPrenom}`;
      const fullPrenom2 = `${csvPrenom} ${prenomExtra}`;
      
      found = eleves.find(e => {
        const eleveNom = normalize(e.nom);
        const elevePrenom = normalize(e.prenom);
        return eleveNom === realNom && 
               (elevePrenom === fullPrenom1 || elevePrenom === fullPrenom2 || 
                elevePrenom.includes(csvPrenom));
      });
      if (found) return found;
    }
    
    // Stratégie 5: Recherche floue - même initiales + classe
    if (csvClasse) {
      found = eleves.find(e => {
        const eleveNom = normalize(e.nom);
        const elevePrenom = normalize(e.prenom);
        return e.classe === csvClasse &&
               eleveNom[0] === csvNom[0] && 
               elevePrenom[0] === csvPrenom[0] &&
               Math.abs(eleveNom.length - csvNom.length) <= 2;
      });
      if (found) return found;
    }
    
    return undefined;
  }, [eleves]);

  // Parser le CSV avec PapaParse (robuste)
  const parseCSV = useCallback(async (file: File): Promise<{ rows: ParsedStageRow[]; errors: Array<{ row: number; message: string }> }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const encoding = detectEncoding(buffer);
          
          // Décoder le buffer
          let content: string;
          if (encoding === 'utf-8-bom') {
            content = new TextDecoder('utf-8').decode(buffer.slice(3));
          } else {
            content = new TextDecoder(encoding).decode(buffer);
          }
          
          // Corriger les problèmes d'encodage
          content = fixEncodingIssues(content);
          
          // Normaliser les fins de ligne
          content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          
          // Détecter le séparateur
          const separator = detectSeparator(content);
          
          console.log('[CSV Import] Encodage détecté:', encoding);
          console.log('[CSV Import] Séparateur détecté:', separator);
          console.log('[CSV Import] Premières lignes:', content.split('\n').slice(0, 3));
          
          // Parser avec PapaParse
          const result = Papa.parse<Record<string, string>>(content, {
            header: true,
            delimiter: separator,
            skipEmptyLines: 'greedy',
            dynamicTyping: false,
            transformHeader: (header) => sanitizeValue(header),
            transform: (value) => sanitizeValue(value),
          });
          
          console.log('[CSV Import] En-têtes trouvés:', result.meta.fields);
          console.log('[CSV Import] Nombre de lignes:', result.data.length);
          if (result.data.length > 0) {
            console.log('[CSV Import] Première ligne de données:', result.data[0]);
          }
          
          // Mapper les en-têtes vers nos champs
          const headers = result.meta.fields || [];
          const headerMap: Record<string, string> = {};
          
          for (const header of headers) {
            const normalized = normalizeHeaderName(header);
            if (normalized === 'nom' || normalized === 'nomeleve' || normalized === 'nom_eleve') {
              headerMap['nom'] = header;
            } else if (normalized === 'prenom' || normalized === 'prenomeleve' || normalized === 'prenom_eleve') {
              headerMap['prenom'] = header;
            } else if (normalized === 'classe') {
              headerMap['classe'] = header;
            } else if (normalized === 'adresse' || normalized === 'adressestage' || normalized === 'adresse_stage') {
              headerMap['adresse'] = header;
            } else if (normalized === 'entreprise' || normalized === 'nomentreprise' || normalized === 'societe' || normalized === 'nom_entreprise') {
              headerMap['entreprise'] = header;
            }
          }
          
          console.log('[CSV Import] Mapping colonnes:', headerMap);
          
          // Vérifier les colonnes obligatoires
          const errors: Array<{ row: number; message: string }> = [];
          const missingCols: string[] = [];
          if (!headerMap['nom']) missingCols.push('nom');
          if (!headerMap['prenom']) missingCols.push('prenom');
          if (!headerMap['adresse']) missingCols.push('adresse');
          
          if (missingCols.length > 0) {
            resolve({
              rows: [],
              errors: [{ row: 1, message: `Colonnes obligatoires manquantes: ${missingCols.join(', ')}. Colonnes trouvées: ${headers.join(', ')}` }]
            });
            return;
          }
          
          // Extraire les données
          const rows: ParsedStageRow[] = [];
          
          result.data.forEach((rawRow, index) => {
            const nom = rawRow[headerMap['nom']] || '';
            const prenom = rawRow[headerMap['prenom']] || '';
            const adresse = rawRow[headerMap['adresse']] || '';
            const classe = headerMap['classe'] ? rawRow[headerMap['classe']] || '' : '';
            const entreprise = headerMap['entreprise'] ? rawRow[headerMap['entreprise']] || '' : '';
            
            // Validation
            if (!nom.trim()) {
              errors.push({ row: index + 2, message: 'Nom manquant' });
              return;
            }
            if (!prenom.trim()) {
              errors.push({ row: index + 2, message: 'Prénom manquant' });
              return;
            }
            if (!adresse.trim()) {
              errors.push({ row: index + 2, message: 'Adresse manquante' });
              return;
            }
            
            rows.push({
              nom: nom.trim(),
              prenom: prenom.trim(),
              classe: classe.trim() || undefined,
              adresse: adresse.trim(),
              entreprise: entreprise.trim() || undefined,
            });
          });
          
          console.log('[CSV Import] Lignes valides:', rows.length);
          console.log('[CSV Import] Erreurs:', errors.length);
          
          resolve({ rows, errors });
        } catch (err) {
          console.error('[CSV Import] Erreur:', err);
          resolve({
            rows: [],
            errors: [{ row: 0, message: `Erreur de lecture: ${err instanceof Error ? err.message : 'Erreur inconnue'}` }]
          });
        }
      };
      
      reader.onerror = () => {
        resolve({
          rows: [],
          errors: [{ row: 0, message: 'Impossible de lire le fichier' }]
        });
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, []);

  // Importer le fichier
  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    setImportResult(null);
    
    try {
      // Parser le CSV avec la nouvelle méthode robuste
      const { rows, errors: parseErrors } = await parseCSV(file);
      
      if (rows.length === 0 && parseErrors.length === 0) {
        setImportResult({ success: 0, errors: [{ row: 0, message: 'Aucune donnée valide trouvée' }], duplicates: 0, warnings: 0 });
        return;
      }
      
      if (rows.length === 0 && parseErrors.length > 0) {
        setImportResult({ success: 0, errors: parseErrors, duplicates: 0, warnings: 0 });
        return;
      }
      
      const result: ImportResult = { success: 0, errors: [...parseErrors], duplicates: 0, warnings: 0 };
      const stagesToAdd: Array<Omit<Stage, 'id' | 'createdAt' | 'updatedAt'>> = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const eleve = findEleve(row.nom, row.prenom, row.classe);
        
        // Vérifier si un stage existe déjà pour cet élève (si trouvé) ou ces infos
        if (eleve) {
          const existingStage = stages.find(s => s.eleveId === eleve.id);
          if (existingStage) {
            result.duplicates++;
            continue;
          }
        } else {
          // Vérifier par nom/prénom/classe si pas d'élève trouvé
          const existingByName = stages.find(s => 
            s.eleveNom?.toUpperCase() === row.nom.toUpperCase() &&
            s.elevePrenom?.toLowerCase() === row.prenom.toLowerCase() &&
            (!row.classe || s.eleveClasse === row.classe)
          );
          if (existingByName) {
            result.duplicates++;
            continue;
          }
          // Compter comme avertissement si élève non trouvé
          result.warnings = (result.warnings || 0) + 1;
        }
        
        stagesToAdd.push({
          eleveId: eleve?.id, // Peut être undefined
          eleveNom: row.nom,
          elevePrenom: row.prenom,
          eleveClasse: row.classe,
          scenarioId: scenario.id!,
          adresse: row.adresse,
          nomEntreprise: row.entreprise,
          geoStatus: 'pending',
        });
        result.success++;
      }
      
      // Ajouter tous les stages en une fois
      if (stagesToAdd.length > 0) {
        await bulkAddStages(stagesToAdd);
      }
      
      setImportResult(result);
    } catch (error) {
      setImportResult({ 
        success: 0, 
        errors: [{ row: 0, message: error instanceof Error ? error.message : 'Erreur inconnue' }],
        duplicates: 0
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [scenario.id, stages, findEleve, parseCSV, bulkAddStages]);

  // Éditer un stage
  const handleStartEdit = (stage: Stage) => {
    setEditingStageId(stage.id);
    setEditValue({
      adresse: stage.adresse || '',
      entreprise: stage.nomEntreprise || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStageId) return;
    
    await updateStage(editingStageId, {
      adresse: editValue.adresse,
      nomEntreprise: editValue.entreprise,
      geoStatus: 'pending', // Reset le géocodage si l'adresse change
    });
    setEditingStageId(null);
  };

  const handleCancelEdit = () => {
    setEditingStageId(null);
  };

  const handleDeleteStage = async (stageId: string) => {
    if (confirm('Supprimer ce stage ?')) {
      await deleteStage(stageId);
    }
  };

  // Trouver l'élève pour un stage
  const getEleveForStage = (stage: Stage): Eleve | undefined => {
    return eleves.find(e => e.id === stage.eleveId);
  };

  // Élèves sans stage
  const elevesWithoutStage = eleves.filter(e => !stages.some(s => s.eleveId === e.id));

  return (
    <div className="stage-import-step">
      {/* Zone d'import */}
      <div className="step-section">
        <div className="step-section-header">
          <h4>
            <Upload size={18} />
            Importer les stages (CSV)
          </h4>
        </div>
        
        <div className="import-zone">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="stage-import-input"
          />
          <label htmlFor="stage-import-input" className="import-dropzone">
            <FileText size={32} />
            <span className="import-title">
              {isImporting ? 'Import en cours...' : 'Cliquez pour importer un fichier CSV'}
            </span>
            <span className="import-hint">
              Colonnes attendues : nom, prenom, adresse (obligatoires) + classe, entreprise (optionnels)
            </span>
          </label>
        </div>

        {/* Résultat de l'import */}
        {importResult && (
          <div className={`import-result ${importResult.errors.length > 0 ? 'has-errors' : importResult.warnings ? 'has-warnings' : ''}`}>
            <div className="import-result-summary">
              <span className="success">
                <Check size={16} /> {importResult.success} importé(s)
              </span>
              {(importResult.warnings ?? 0) > 0 && (
                <span className="warning">
                  <AlertTriangle size={16} /> {importResult.warnings} sans correspondance élève
                </span>
              )}
              {importResult.duplicates > 0 && (
                <span className="info">
                  <AlertCircle size={16} /> {importResult.duplicates} doublon(s) ignoré(s)
                </span>
              )}
              {importResult.errors.length > 0 && (
                <span className="error">
                  <X size={16} /> {importResult.errors.length} erreur(s)
                </span>
              )}
            </div>
            {(importResult.warnings ?? 0) > 0 && (
              <div className="import-warning-info">
                <AlertTriangle size={14} />
                <span>
                  Certains élèves n'ont pas été trouvés dans la base. Les stages ont été importés avec les informations du CSV.
                  Pour les lier automatiquement, importez d'abord les élèves dans la page "Élèves".
                </span>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className="import-errors">
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="import-error-item">
                    <span className="row">Ligne {err.row}:</span> {err.message}
                  </div>
                ))}
                {importResult.errors.length > 5 && (
                  <div className="import-error-more">
                    + {importResult.errors.length - 5} autres erreurs
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Liste des stages importés */}
      <div className="step-section">
        <div className="step-section-header">
          <h4>Stages importés ({stages.length})</h4>
          {elevesWithoutStage.length > 0 && (
            <span className="section-warning">
              <AlertCircle size={14} />
              {elevesWithoutStage.length} élève(s) sans stage
            </span>
          )}
        </div>

        {stages.length === 0 ? (
          <div className="step-empty-state">
            <div className="empty-icon">📋</div>
            <h4>Aucun stage importé</h4>
            <p>Importez un fichier CSV contenant les adresses de stage des élèves.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="stage-data-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Classe</th>
                  <th>Entreprise</th>
                  <th>Adresse</th>
                  <th>Géocodage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stages.map(stage => {
                  const eleve = getEleveForStage(stage);
                  const isEditing = editingStageId === stage.id;
                  const eleveName = eleve 
                    ? `${eleve.prenom} ${eleve.nom}` 
                    : stage.elevePrenom && stage.eleveNom 
                      ? `${stage.elevePrenom} ${stage.eleveNom}` 
                      : null;
                  const eleveClasse = eleve?.classe || stage.eleveClasse;
                  const isOrphan = !eleve && (stage.eleveNom || stage.elevePrenom);
                  
                  return (
                    <tr key={stage.id} className={isOrphan ? 'orphan-row' : ''}>
                      <td>
                        {eleveName ? (
                          <>
                            {eleveName}
                            {isOrphan && (
                              <span className="orphan-badge" title="Élève non trouvé dans la base">
                                <AlertTriangle size={12} />
                              </span>
                            )}
                          </>
                        ) : (
                          <em className="unknown">Élève inconnu</em>
                        )}
                      </td>
                      <td>{eleveClasse || '-'}</td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue.entreprise}
                            onChange={e => setEditValue(v => ({ ...v, entreprise: e.target.value }))}
                            placeholder="Nom entreprise"
                            className="inline-edit"
                          />
                        ) : (
                          stage.nomEntreprise || '-'
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue.adresse}
                            onChange={e => setEditValue(v => ({ ...v, adresse: e.target.value }))}
                            placeholder="Adresse complète"
                            className="inline-edit wide"
                          />
                        ) : (
                          stage.adresse
                        )}
                      </td>
                      <td>
                        <span className={`geo-status-badge ${stage.geoStatus}`}>
                          {stage.geoStatus === 'ok' && '✓ OK'}
                          {stage.geoStatus === 'pending' && '⏳ En attente'}
                          {stage.geoStatus === 'error' && '✗ Erreur'}
                          {stage.geoStatus === 'manual' && '📍 Manuel'}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div className="inline-actions">
                            <button className="btn-icon success" onClick={handleSaveEdit} title="Enregistrer">
                              <Check size={14} />
                            </button>
                            <button className="btn-icon" onClick={handleCancelEdit} title="Annuler">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-actions">
                            <button className="btn-icon" onClick={() => handleStartEdit(stage)} title="Modifier">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn-icon danger" onClick={() => handleDeleteStage(stage.id)} title="Supprimer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button
          className="btn-step primary"
          onClick={onComplete}
          disabled={stages.length === 0}
        >
          Continuer vers le géocodage
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
