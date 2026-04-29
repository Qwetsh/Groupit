// ============================================================
// TEMPLATE EXCEL - Oral DNB (sujets élèves)
// Génère un fichier Excel pré-rempli avec listes déroulantes
// ============================================================

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { Eleve } from '../../domain/models';
import { PARCOURS_ORAL_DNB, MATIERES_HEURES_3E, LANGUES_ETRANGERES } from '../../domain/models';

const MATIERES_LIST = MATIERES_HEURES_3E.map(m => m.matiere);

/**
 * Génère et télécharge un template Excel pré-rempli avec les élèves
 * et des listes déroulantes pour Parcours et Matières.
 */
export async function generateTemplateOralDNB(eleves: Eleve[]): Promise<void> {
  const wb = new ExcelJS.Workbook();

  // === Feuille principale ===
  const ws = wb.addWorksheet('Sujets Oral DNB');

  // Headers
  const headerRow = ws.addRow(['Nom', 'Prénom', 'Classe', 'Parcours / Thème', 'Sujet', 'Matière 1', 'Matière 2', 'Langue Étrangère', 'Tiers Temps']);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A5568' } };
    cell.alignment = { horizontal: 'center' };
  });

  // Trier élèves par classe puis nom
  const sorted = [...eleves].sort((a, b) => {
    const c = a.classe.localeCompare(b.classe);
    if (c !== 0) return c;
    return a.nom.localeCompare(b.nom);
  });

  // Données élèves
  for (const e of sorted) {
    const row = ws.addRow([
      e.nom,
      e.prenom,
      e.classe,
      e.parcoursOral || '',
      e.sujetOral || '',
      e.matieresOral?.[0] || '',
      e.matieresOral?.[1] || '',
      e.langueEtrangere || '',
      e.tiersTemps ? 'Oui' : '',
    ]);

    // Colonnes Nom/Prénom/Classe en gris clair (lecture seule visuelle)
    for (let i = 1; i <= 3; i++) {
      row.getCell(i).fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      row.getCell(i).font = { color: { argb: 'FF64748B' } };
    }
  }

  // Largeurs de colonnes
  ws.columns = [
    { width: 22 },  // Nom
    { width: 18 },  // Prénom
    { width: 8 },   // Classe
    { width: 26 },  // Parcours
    { width: 42 },  // Sujet
    { width: 22 },  // Matière 1
    { width: 22 },  // Matière 2
    { width: 20 },  // Langue Étrangère
    { width: 12 },  // Tiers Temps
  ];

  // Listes déroulantes (data validation)
  const lastRow = sorted.length + 1; // +1 pour le header
  const parcoursFormula = `"${PARCOURS_ORAL_DNB.join(',')}"`;
  const matieresFormula = `"${MATIERES_LIST.join(',')}"`;

  for (let r = 2; r <= lastRow; r++) {
    // Parcours (colonne D)
    ws.getCell(`D${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [parcoursFormula],
      showErrorMessage: true,
      errorTitle: 'Parcours invalide',
      error: 'Veuillez choisir un parcours dans la liste.',
    };

    // Matière 1 (colonne F)
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [matieresFormula],
      showErrorMessage: true,
      errorTitle: 'Matière invalide',
      error: 'Veuillez choisir une matière dans la liste.',
    };

    // Matière 2 (colonne G)
    ws.getCell(`G${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [matieresFormula],
      showErrorMessage: true,
      errorTitle: 'Matière invalide',
      error: 'Veuillez choisir une matière dans la liste.',
    };

    // Langue Étrangère (colonne H)
    ws.getCell(`H${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${LANGUES_ETRANGERES.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Langue invalide',
      error: 'Veuillez choisir une langue dans la liste.',
    };

    // Tiers Temps (colonne I)
    ws.getCell(`I${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Oui,Non"'],
      showErrorMessage: true,
      errorTitle: 'Valeur invalide',
      error: 'Veuillez choisir Oui ou Non.',
    };
  }

  // Figer la première ligne (header)
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Générer et télécharger
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_oral_dnb.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse un fichier Excel/CSV de sujets oral DNB et retourne les données.
 */
export interface OralDNBImportRow {
  nom: string;
  prenom: string;
  classe: string;
  parcours: string;
  sujet: string;
  matieres: string[];
  langue: string;
  tiersTemps: boolean;
}

// Aliases pour normaliser les matières importées
const MATIERE_NORMALIZE: Record<string, string> = {
  'francais': 'Français',
  'français': 'Français',
  'maths': 'Mathématiques',
  'math': 'Mathématiques',
  'mathematiques': 'Mathématiques',
  'mathématiques': 'Mathématiques',
  'histoire': 'Histoire-Géographie-EMC',
  'histoire-geo': 'Histoire-Géographie-EMC',
  'histoire-géo': 'Histoire-Géographie-EMC',
  'histoire géographie emc': 'Histoire-Géographie-EMC',
  'hg': 'Histoire-Géographie-EMC',
  'hgemc': 'Histoire-Géographie-EMC',
  'svt': 'SVT',
  'sciences de la vie': 'SVT',
  'physique': 'Physique-Chimie',
  'physique-chimie': 'Physique-Chimie',
  'pc': 'Physique-Chimie',
  'technologie': 'Technologie',
  'techno': 'Technologie',
  'anglais': 'Anglais LV1',
  'espagnol': 'Espagnol LV2',
  'allemand': 'Allemand LV2',
  'eps': 'EPS',
  'sport': 'EPS',
  'musique': 'Éducation Musicale',
  'education musicale': 'Éducation Musicale',
  'éducation musicale': 'Éducation Musicale',
  'arts plastiques': 'Arts Plastiques',
  'art plastique': 'Arts Plastiques',
  'arts': 'Arts Plastiques',
  'dessin': 'Arts Plastiques',
  'latin': 'Latin (option)',
  'grec': 'Grec (option)',
};

// Aliases pour normaliser les parcours importés
const PARCOURS_NORMALIZE: Record<string, string> = {
  'epi': 'EPI',
  'parcours avenir': 'Parcours Avenir',
  'avenir': 'Parcours Avenir',
  'p. avenir': 'Parcours Avenir',
  'p.avenir': 'Parcours Avenir',
  'parcours citoyen': 'Parcours Citoyen',
  'citoyen': 'Parcours Citoyen',
  'p. citoyen': 'Parcours Citoyen',
  'p.citoyen': 'Parcours Citoyen',
  'parcours santé': 'Parcours Santé',
  'parcours sante': 'Parcours Santé',
  'santé': 'Parcours Santé',
  'sante': 'Parcours Santé',
  'p. santé': 'Parcours Santé',
  'p.santé': 'Parcours Santé',
  'parcours éducatif de santé': 'Parcours Santé',
  'parcours educatif de sante': 'Parcours Santé',
  'parcours artistique': 'Parcours Artistique',
  'artistique': 'Parcours Artistique',
  'p. artistique': 'Parcours Artistique',
  'p.artistique': 'Parcours Artistique',
  'peac': 'Parcours Artistique',
  "parcours d'éducation artistique et culturelle": 'Parcours Artistique',
  'parcours education artistique et culturelle': 'Parcours Artistique',
  'parcours artistique et culturel': 'Parcours Artistique',
  'histoire des sciences': 'Histoire des Sciences',
  'hda': 'Histoire des Sciences',
  'histoire des arts': 'Histoire des Sciences',
};

function normalizeParcours(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim();
  const lower = cleaned.toLowerCase();
  if (PARCOURS_NORMALIZE[lower]) return PARCOURS_NORMALIZE[lower];
  // Correspondance exacte insensible à la casse avec les parcours connus
  const found = PARCOURS_ORAL_DNB.find(p => p.toLowerCase() === lower);
  if (found) return found;
  // Correspondance partielle
  const partial = PARCOURS_ORAL_DNB.find(
    p => p.toLowerCase().includes(lower) || lower.includes(p.toLowerCase())
  );
  if (partial) return partial;
  return cleaned; // Retourner la valeur nettoyée telle quelle
}

function normalizeMatiere(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase();
  if (MATIERE_NORMALIZE[cleaned]) return MATIERE_NORMALIZE[cleaned];
  // Correspondance exacte insensible à la casse avec les matières connues
  const found = MATIERES_HEURES_3E.find(m => m.matiere.toLowerCase() === cleaned);
  if (found) return found.matiere;
  // Correspondance partielle
  const partial = MATIERES_HEURES_3E.find(
    m => m.matiere.toLowerCase().includes(cleaned) || cleaned.includes(m.matiere.toLowerCase())
  );
  if (partial) return partial.matiere;
  return raw.trim();
}

export async function parseOralDNBFile(file: File): Promise<OralDNBImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        // Chercher la feuille "Sujets Oral DNB" ou prendre la première
        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('sujets')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

        const result: OralDNBImportRow[] = [];

        for (const row of rows) {
          const keys = Object.keys(row);
          // Recherche de colonne : essaie d'abord une correspondance exacte (startsWith), puis includes
          const getCol = (candidates: string[], excludeKeys?: string[]) => {
            const lowerKeys = keys.filter(k => !excludeKeys?.includes(k));
            // Priorité 1: le nom de colonne commence par un candidat
            let key = lowerKeys.find(k => candidates.some(c => k.toLowerCase().startsWith(c)));
            // Priorité 2: le nom de colonne contient un candidat
            if (!key) key = lowerKeys.find(k => candidates.some(c => k.toLowerCase().includes(c)));
            return key ? { key, value: String(row[key] || '').trim() } : { key: '', value: '' };
          };

          const nomResult = getCol(['nom']);
          const nom = nomResult.value;
          const prenom = getCol(['prénom', 'prenom'], [nomResult.key]).value;
          const classe = getCol(['classe']).value;
          const parcours = normalizeParcours(getCol(['parcours', 'thème', 'theme']).value);
          const sujet = getCol(['sujet']).value;
          const matiere1 = normalizeMatiere(getCol(['matière 1', 'matiere 1']).value);
          const matiere2 = normalizeMatiere(getCol(['matière 2', 'matiere 2']).value);
          const langue = getCol(['langue', 'langue étrangère', 'langue etrangere']).value;
          const tiersTempsRaw = getCol(['tiers temps', 'tiers-temps', 'tierstemps', 'tiers t']).value;
          const tiersTemps = ['oui', 'yes', 'x', '1', 'true'].includes(tiersTempsRaw.toLowerCase());

          if (!nom) continue;

          const matieres = [matiere1, matiere2].filter(Boolean);

          result.push({ nom, prenom, classe, parcours, sujet, matieres, langue, tiersTemps });
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.readAsArrayBuffer(file);
  });
}
