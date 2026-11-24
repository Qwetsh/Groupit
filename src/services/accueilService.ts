// ============================================================
// ACCUEIL : où en est l'établissement, et quelle est la prochaine étape
// ============================================================
//
// Fonctions pures : elles reçoivent des comptes (aucun nom) et décident
// de ce que l'accueil met en avant. Testées dans accueilService.test.ts.

export interface EtatPreparation {
  nbEleves: number;
  nbClasses: number;
  nbEnseignants: number;
  nbEnseignantsSansAdresse: number;
  nbStages: number;
  /** Premier jour de stage connu, s'il y en a un. */
  debutStages: Date | null;
  nbSujetsRenseignes: number;
  oral: { enCours: boolean; nbJurys: number; nbRepartis: number };
  stages: { enCours: boolean; nbAttribues: number };
  aujourdhui: Date;
}

export type ActionAccueil =
  | 'importer-eleves'
  | 'importer-enseignants'
  | 'importer-stages'
  | 'attribuer-tuteurs'
  | 'reprendre-stages'
  | 'preparer-oral'
  | 'reprendre-oral';

export interface ProchaineEtape {
  action: ActionAccueil;
  titre: string;
  detail: string;
  bouton: string;
}

export interface EtapeChantier {
  libelle: string;
  faite: boolean;
}

const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

/**
 * Lit une date de stage telle qu'importée : « 14/12/2026 », « 2026-12-14 »
 * ou un numéro de série Excel. Renvoie null si elle est illisible.
 */
export function lireDateStage(valeur: string | number | undefined | null): Date | null {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  const texte = String(valeur).trim();
  let m = texte.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const annee = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(annee, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = texte.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (/^\d{5}$/.test(texte)) {
    // Numéro de série Excel (jours depuis le 30/12/1899)
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Number(texte));
    return d;
  }
  return null;
}

/** Nombre de jours entiers entre aujourd'hui et la date (négatif si passée). */
export function joursAvant(date: Date, aujourdhui: Date): number {
  const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  const fin = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((fin.getTime() - debut.getTime()) / 86_400_000);
}

/** « dans 20 jours », « demain », « aujourd'hui », « il y a 3 jours ». */
export function echeance(jours: number): string {
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return 'demain';
  if (jours > 1) return `dans ${jours} jours`;
  return jours === -1 ? 'hier' : `il y a ${-jours} jours`;
}

/** Année scolaire courante : de septembre à août. */
export function anneeScolaire(aujourdhui: Date): string {
  const annee = aujourdhui.getMonth() >= 7 ? aujourdhui.getFullYear() : aujourdhui.getFullYear() - 1;
  return `${annee}-${annee + 1}`;
}

/** Ce que l'accueil propose en premier, selon les données présentes. */
export function prochaineEtape(e: EtatPreparation): ProchaineEtape {
  if (e.nbEleves === 0) {
    return {
      action: 'importer-eleves',
      titre: 'Importer vos élèves',
      detail: "L'export CSV de Pronote, une classe ou plusieurs à la fois.",
      bouton: 'Importer les élèves',
    };
  }
  if (e.nbEnseignants === 0) {
    return {
      action: 'importer-enseignants',
      titre: 'Importer vos enseignants',
      detail: 'Avec leur adresse, pour calculer les distances jusqu’aux lieux de stage.',
      bouton: 'Importer les enseignants',
    };
  }

  const jours = e.debutStages ? joursAvant(e.debutStages, e.aujourdhui) : null;
  const quand = jours !== null && jours >= 0 ? ` Les stages commencent ${echeance(jours)}.` : '';

  if (!e.stages.enCours) {
    if (e.nbStages === 0) {
      return {
        action: 'importer-stages',
        titre: `Importer les stages des ${e.nbEleves} élèves`,
        detail: 'Un tableau avec l’entreprise et l’adresse de chaque stage.',
        bouton: 'Importer les stages',
      };
    }
    if (jours === null || jours >= -7) {
      return {
        action: 'attribuer-tuteurs',
        titre: `Attribuer un tuteur aux ${pluriel(e.nbStages, 'stage')}`,
        detail: `Au plus près de chez chaque enseignant.${quand}`,
        bouton: 'Attribuer les tuteurs',
      };
    }
  }

  if (!e.oral.enCours) {
    const reste = e.nbEleves - e.nbSujetsRenseignes;
    return {
      action: 'preparer-oral',
      titre: "Préparer l'oral du DNB",
      detail: reste > 0
        ? `${e.nbSujetsRenseignes} sujets renseignés sur ${e.nbEleves}. On commence par là.`
        : 'Tous les sujets sont renseignés : place aux jurys.',
      bouton: reste > 0 ? 'Renseigner les sujets' : 'Constituer les jurys',
    };
  }

  return {
    action: 'reprendre-oral',
    titre: "Reprendre l'oral du DNB",
    detail: `${pluriel(e.oral.nbJurys, 'jury')}, ${pluriel(e.oral.nbRepartis, 'élève')} réparti${e.oral.nbRepartis > 1 ? 's' : ''}.`,
    bouton: 'Reprendre',
  };
}

export function etapesOral(e: EtatPreparation): EtapeChantier[] {
  return [
    { libelle: 'Élèves importés', faite: e.nbEleves > 0 },
    { libelle: `Sujets renseignés : ${e.nbSujetsRenseignes} / ${e.nbEleves}`, faite: e.nbEleves > 0 && e.nbSujetsRenseignes >= e.nbEleves },
    { libelle: e.oral.nbJurys > 0 ? `${pluriel(e.oral.nbJurys, 'jury')} constitué${e.oral.nbJurys > 1 ? 's' : ''}` : 'Jurys et salles', faite: e.oral.nbJurys > 0 },
    { libelle: e.oral.nbRepartis > 0 ? `${e.oral.nbRepartis} élèves répartis` : 'Élèves répartis dans les jurys', faite: e.oral.nbRepartis > 0 },
  ];
}

export function etapesStages(e: EtatPreparation): EtapeChantier[] {
  return [
    { libelle: 'Élèves importés', faite: e.nbEleves > 0 },
    { libelle: `Stages importés : ${e.nbStages} / ${e.nbEleves}`, faite: e.nbEleves > 0 && e.nbStages >= e.nbEleves },
    { libelle: e.stages.nbAttribues > 0 ? `${e.stages.nbAttribues} tuteurs attribués` : 'Tuteurs attribués', faite: e.stages.nbAttribues > 0 },
  ];
}

/** Part des étapes faites, sur les deux chantiers. */
export function avancement(e: EtatPreparation): number {
  const toutes = [...etapesOral(e), ...etapesStages(e).slice(1)];
  return Math.round((toutes.filter(t => t.faite).length / toutes.length) * 100);
}
