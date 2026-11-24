// ============================================================
// ALGORITHME - COMPOSITION AUTOMATIQUE DES JURYS
// ============================================================
//
// Choisit quels enseignants siègent et les regroupe en jurys, en amont de la
// répartition des élèves. Un bon découpage ici évite des élèves privés de leur
// matière plus tard : aucun solveur ne peut placer un élève de SVT devant un
// enseignant de SVT qui ne siège dans aucun jury.
//
// Dans l'ordre :
//   1. écarter les enseignants indisponibles sur toutes les demi-journées de l'oral ;
//   2. choisir les titulaires selon la demande des élèves : chaque matière reçoit
//      des sièges en proportion des élèves qui l'ont choisie (méthode des plus
//      forts quotients, comme une répartition de sièges) ;
//   3. regrouper les titulaires en jurys : des membres disponibles en même temps,
//      des matières différentes dans un même jury ;
//   4. répartir les enseignants restants comme suppléants.
//
// Sans matières renseignées côté élèves, toutes les matières pèsent pareil et
// l'on retrouve une simple diversification des jurys.
// Le résultat ne dépend pas de l'ordre de la liste des enseignants.

import type { Eleve, Enseignant } from '../domain/models';
import { cleMatiere, getMatiereRef } from '../domain/models';

export interface JuryCompositionOptions {
  nbJurys?: number;
  enseignantsParJury?: number;
  suppleantsParJury?: number;
  /** Diversifier les matières (vrai par défaut) ; faux : garder l'ordre donné. */
  equilibrerMatieres?: boolean;
  /** Élèves concernés : leurs matières d'oral et langues orientent le choix des titulaires. */
  eleves?: Eleve[];
  /** Demi-journées de l'oral (« jeudi_matin »…), pour tenir compte des indisponibilités. */
  demiJournees?: string[];
}

export interface JuryComposition {
  jurys: { juryIndex: number; enseignantIds: string[]; suppleantsIds: string[] }[];
  /** Enseignants écartés car indisponibles sur toutes les demi-journées de l'oral. */
  indisponibles: string[];
}

const POIDS_PREMIER_CHOIX = 1;
const POIDS_SECOND_CHOIX = 0.5;
const POIDS_LANGUE = 0.3;

interface Candidat {
  ens: Enseignant;
  cle: string;
  categorie: string;
  /** Demi-journées de l'oral où il est disponible. */
  dispo: Set<string>;
  ordre: string;
}

function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Demande des élèves par matière (clé du référentiel). */
function demandeParMatiere(eleves: Eleve[] | undefined): Map<string, number> {
  const demande = new Map<string, number>();
  const ajouter = (cle: string, poids: number) => {
    if (cle) demande.set(cle, (demande.get(cle) ?? 0) + poids);
  };
  for (const e of eleves ?? []) {
    const cles = [...new Set((e.matieresOral ?? []).map(cleMatiere).filter(Boolean))];
    if (cles[0]) ajouter(cles[0], POIDS_PREMIER_CHOIX);
    if (cles[1]) ajouter(cles[1], POIDS_SECOND_CHOIX);
    ajouter(cleMatiere(e.langueEtrangere), POIDS_LANGUE);
  }
  return demande;
}

function communes(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter(x => b.has(x)));
}

export function composerJurys(
  enseignants: Enseignant[],
  options: JuryCompositionOptions = {}
): JuryComposition {
  const parJury = Math.max(1, options.enseignantsParJury ?? 2);
  const suppleantsParJury = Math.max(0, options.suppleantsParJury ?? 0);
  const demiJournees = options.demiJournees ?? [];
  const equilibrer = options.equilibrerMatieres ?? true;

  if (enseignants.length === 0) return { jurys: [], indisponibles: [] };

  const nbJurys = Math.max(1, options.nbJurys ?? Math.floor(enseignants.length / parJury));

  // 1. Disponibilités
  const candidats: Candidat[] = [];
  const indisponibles: string[] = [];
  enseignants.forEach((ens, i) => {
    const dispo = demiJournees.length > 0
      ? new Set(demiJournees.filter(d => !ens.indisponibilites?.includes(d)))
      : new Set(['*']);
    if (dispo.size === 0) {
      indisponibles.push(ens.id);
      return;
    }
    candidats.push({
      ens,
      cle: cleMatiere(ens.matierePrincipale),
      categorie: getMatiereRef(ens.matierePrincipale)?.categorie ?? 'autre',
      dispo,
      // Sans équilibrage, l'ordre de la liste fait foi (comportement d'origine).
      ordre: equilibrer
        ? [ens.nom, ens.prenom, ens.id].join('\u0000')
        : String(i).padStart(6, '0'),
    });
  });
  candidats.sort((a, b) => comparer(a.ordre, b.ordre));

  const nbTitulaires = Math.min(candidats.length, nbJurys * parJury);
  const demande = demandeParMatiere(options.eleves);
  const avecDemande = demande.size > 0;
  // Sans données élèves : chaque matière pèse 1, ce qui revient à diversifier.
  const poidsMatiere = (cle: string) => (avecDemande ? demande.get(cle) ?? 0 : 1);

  // 2. Choix des titulaires (plus forts quotients)
  const titulaires: Candidat[] = [];
  const restants = [...candidats];
  if (!equilibrer) {
    titulaires.push(...restants.splice(0, nbTitulaires));
  } else {
    const sieges = new Map<string, number>();
    while (titulaires.length < nbTitulaires) {
      let meilleur = 0;
      for (let i = 1; i < restants.length; i++) {
        const c = restants[i];
        const m = restants[meilleur];
        const qc = poidsMatiere(c.cle) / ((sieges.get(c.cle) ?? 0) + 1);
        const qm = poidsMatiere(m.cle) / ((sieges.get(m.cle) ?? 0) + 1);
        if (qc > qm + 1e-9 || (Math.abs(qc - qm) <= 1e-9 && c.dispo.size > m.dispo.size)) meilleur = i;
      }
      const choisi = restants.splice(meilleur, 1)[0];
      sieges.set(choisi.cle, (sieges.get(choisi.cle) ?? 0) + 1);
      titulaires.push(choisi);
    }
  }

  // 3. Regroupement en jurys
  const jurys = Array.from({ length: nbJurys }, () => ({
    membres: [] as Candidat[],
    dispo: null as Set<string> | null, // disponibilités communes des membres
    suppleants: [] as Candidat[],
  }));

  // Élèves qu'un siège aura à recevoir : la demande de sa matière partagée
  // entre les sièges de cette matière. Pour que chaque jury puisse accueillir
  // ses élèves, on équilibre cette charge entre jurys : les sièges les plus
  // chargés sont placés d'abord, chacun dans le jury le moins chargé (on évite
  // ainsi de réunir deux matières très demandées dans un même jury).
  const siegesParCle = new Map<string, number>();
  for (const t of titulaires) siegesParCle.set(t.cle, (siegesParCle.get(t.cle) ?? 0) + 1);
  const chargeSiege = (t: Candidat) => poidsMatiere(t.cle) / (siegesParCle.get(t.cle) ?? 1);
  const chargeMoyenne = Math.max(1e-9, titulaires.reduce((s, t) => s + chargeSiege(t), 0) / nbJurys);
  const charges = new Array<number>(nbJurys).fill(0);

  const ordreTitulaires = equilibrer
    ? [...titulaires].sort((a, b) =>
      chargeSiege(b) - chargeSiege(a) || comparer(a.cle, b.cle) || comparer(a.ordre, b.ordre))
    : titulaires;

  for (const t of ordreTitulaires) {
    let meilleur = -1;
    let meilleurScore = -Infinity;
    jurys.forEach((j, idx) => {
      if (j.membres.length >= parJury) return;
      let score = 0;
      const dispoCommune = j.dispo ? communes(j.dispo, t.dispo) : t.dispo;
      if (dispoCommune.size > 0) score += 1000; // pouvoir siéger ensemble
      if (equilibrer) {
        if (!j.membres.some(m => m.cle === t.cle)) score += 100;
        score -= 40 * (charges[idx] / chargeMoyenne); // jury le moins chargé
        if (!j.membres.some(m => m.categorie === t.categorie)) score += 5;
      }
      score += (parJury - j.membres.length) * 0.1; // remplir les jurys au même rythme
      if (score > meilleurScore + 1e-9) {
        meilleurScore = score;
        meilleur = idx;
      }
    });
    if (meilleur < 0) break;
    const j = jurys[meilleur];
    charges[meilleur] += chargeSiege(t);
    j.membres.push(t);
    const dispoCommune = j.dispo ? communes(j.dispo, t.dispo) : new Set(t.dispo);
    j.dispo = dispoCommune.size > 0 ? dispoCommune : j.dispo;
  }

  // 4. Suppléants : ceux qui restent, là où ils peuvent siéger avec le jury
  if (suppleantsParJury > 0) {
    for (const s of restants) {
      let meilleur = -1;
      let meilleurScore = -Infinity;
      jurys.forEach((j, idx) => {
        if (j.membres.length === 0 || j.suppleants.length >= suppleantsParJury) return;
        let score = 0;
        if (!j.dispo || communes(j.dispo, s.dispo).size > 0) score += 1000;
        if (!j.membres.some(m => m.cle === s.cle)) score += 10;
        score += (suppleantsParJury - j.suppleants.length);
        if (score > meilleurScore) {
          meilleurScore = score;
          meilleur = idx;
        }
      });
      if (meilleur >= 0) jurys[meilleur].suppleants.push(s);
    }
  }

  return {
    jurys: jurys
      .map((j, juryIndex) => ({
        juryIndex,
        enseignantIds: j.membres.map(m => m.ens.id),
        suppleantsIds: j.suppleants.map(m => m.ens.id),
      }))
      .filter(j => j.enseignantIds.length > 0),
    indisponibles,
  };
}
