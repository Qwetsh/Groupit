// ============================================================
// TEMPLATE EXCEL - Oral DNB (sujets élèves)
// Génère un fichier Excel pré-rempli avec listes déroulantes
// ============================================================

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { Eleve } from '../../domain/models';
import { PARCOURS_ORAL_DNB, MATIERES_HEURES_3E } from '../../domain/models';

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
  const headerRow = ws.addRow(['Nom', 'Prénom', 'Classe', 'Parcours / Thème', 'Sujet', 'Matière 1', 'Matière 2']);
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
          const getCol = (candidates: string[]) => {
            const key = keys.find(k => candidates.some(c => k.toLowerCase().includes(c)));
            return key ? String(row[key] || '').trim() : '';
          };

          const nom = getCol(['nom']);
          const prenom = getCol(['prénom', 'prenom']);
          const classe = getCol(['classe']);
          const parcours = getCol(['parcours', 'thème', 'theme']);
          const sujet = getCol(['sujet']);
          const matiere1 = getCol(['matière 1', 'matiere 1']);
          const matiere2 = getCol(['matière 2', 'matiere 2']);

          if (!nom) continue;

          const matieres = [matiere1, matiere2].filter(Boolean);

          result.push({ nom, prenom, classe, parcours, sujet, matieres });
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
