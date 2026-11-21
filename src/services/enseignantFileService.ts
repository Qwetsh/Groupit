// ============================================================
// FICHIER D'ENSEIGNANTS - export / import
// ============================================================
//
// La liste des enseignants (adresses, indisponibilités) est une donnée
// personnelle : elle ne vit ni dans le code ni dans le site déployé.
// L'établissement la conserve dans un fichier privé, qu'il exporte depuis
// un navigateur et réimporte dans un autre.

import type { Enseignant } from '../domain/models';

export type EnseignantFileRecord = Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>;

export const ENSEIGNANT_FILE_FORMAT = 'locanda-enseignants';
export const ENSEIGNANT_FILE_VERSION = 1;

interface EnseignantFile {
  format: typeof ENSEIGNANT_FILE_FORMAT;
  version: number;
  exportedAt: string;
  enseignants: EnseignantFileRecord[];
}

const GEO_STATUSES = ['pending', 'ok', 'error', 'manual', 'not_found'] as const;

/** Clé de comparaison : même nom et même prénom, sans tenir compte de la casse ni des accents. */
export function enseignantKey(e: { nom: string; prenom: string }): string {
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  return `${normalize(e.nom)}|${normalize(e.prenom)}`;
}

/** Produit le contenu du fichier : les identifiants internes et les dates n'en font pas partie. */
export function serializeEnseignants(enseignants: Enseignant[], now: Date = new Date()): string {
  const file: EnseignantFile = {
    format: ENSEIGNANT_FILE_FORMAT,
    version: ENSEIGNANT_FILE_VERSION,
    exportedAt: now.toISOString(),
    enseignants: enseignants.map(e => {
      const record: Partial<Enseignant> = { ...e };
      delete record.id;
      delete record.createdAt;
      delete record.updatedAt;
      return record as EnseignantFileRecord;
    }),
  };
  return JSON.stringify(file, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toRecord(raw: unknown, index: number): EnseignantFileRecord {
  if (!isRecord(raw)) {
    throw new Error(`Ligne ${index + 1} : enregistrement invalide.`);
  }
  const nom = optionalString(raw.nom)?.trim();
  const prenom = optionalString(raw.prenom)?.trim();
  if (!nom || !prenom) {
    throw new Error(`Ligne ${index + 1} : le nom et le prénom sont obligatoires.`);
  }

  const geoStatus = GEO_STATUSES.find(s => s === raw.geoStatus);
  const stageExclusions = Array.isArray(raw.stageExclusions)
    ? (raw.stageExclusions.filter(
        x => isRecord(x) && typeof x.type === 'string' && typeof x.value === 'string'
      ) as Enseignant['stageExclusions'])
    : undefined;

  const record: EnseignantFileRecord = {
    nom,
    prenom,
    matierePrincipale: optionalString(raw.matierePrincipale)?.trim() ?? '',
    classesEnCharge: stringArray(raw.classesEnCharge),
    estProfPrincipal: raw.estProfPrincipal === true,
    tags: stringArray(raw.tags),
  };

  // Champs facultatifs : recopiés seulement s'ils sont présents et bien typés.
  const optional: Partial<EnseignantFileRecord> = {
    matiereSecondaire: Array.isArray(raw.matiereSecondaire) ? stringArray(raw.matiereSecondaire) : undefined,
    classePP: optionalString(raw.classePP),
    adresse: optionalString(raw.adresse),
    commune: optionalString(raw.commune),
    lat: optionalNumber(raw.lat),
    lon: optionalNumber(raw.lon),
    geoStatus,
    heuresParNiveau: isRecord(raw.heuresParNiveau)
      ? {
          '6e': optionalNumber(raw.heuresParNiveau['6e']) ?? 0,
          '5e': optionalNumber(raw.heuresParNiveau['5e']) ?? 0,
          '4e': optionalNumber(raw.heuresParNiveau['4e']) ?? 0,
          '3e': optionalNumber(raw.heuresParNiveau['3e']) ?? 0,
        }
      : undefined,
    capaciteBase: optionalNumber(raw.capaciteBase),
    capaciteStage: optionalNumber(raw.capaciteStage),
    heures3eReelles: optionalNumber(raw.heures3eReelles),
    stageExclusions,
    indisponibilites: Array.isArray(raw.indisponibilites) ? stringArray(raw.indisponibilites) : undefined,
    customFields: isRecord(raw.customFields) ? raw.customFields : undefined,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      (record as Record<string, unknown>)[key] = value;
    }
  }
  return record;
}

/**
 * Lit un fichier d'enseignants. Accepte le format exporté par l'application
 * (`{ format, version, enseignants }`) et un simple tableau d'enseignants.
 * Lève une erreur lisible si le fichier n'est pas exploitable.
 */
export function parseEnseignantsFile(text: string): EnseignantFileRecord[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un fichier JSON valide.");
  }

  const list = Array.isArray(data) ? data : isRecord(data) ? data.enseignants : undefined;
  if (!Array.isArray(list)) {
    throw new Error("Ce fichier ne contient pas de liste d'enseignants.");
  }
  if (list.length === 0) {
    throw new Error('Ce fichier ne contient aucun enseignant.');
  }
  return list.map(toRecord);
}

/**
 * Sépare les enseignants à ajouter de ceux déjà présents (même nom et prénom),
 * y compris les doublons à l'intérieur du fichier lui-même.
 */
export function splitNewEnseignants(
  incoming: EnseignantFileRecord[],
  existing: Array<{ nom: string; prenom: string }>
): { toAdd: EnseignantFileRecord[]; skipped: number } {
  const known = new Set(existing.map(enseignantKey));
  const toAdd: EnseignantFileRecord[] = [];
  for (const record of incoming) {
    const key = enseignantKey(record);
    if (known.has(key)) continue;
    known.add(key);
    toAdd.push(record);
  }
  return { toAdd, skipped: incoming.length - toAdd.length };
}
