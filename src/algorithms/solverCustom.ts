// ============================================================
// ALGORITHME - SOLVEUR MODE PERSONNALISÉ
// ============================================================
//
// Crée des groupes d'élèves de taille donnée et y répartit les adultes, selon
// des critères réglables : parité, adulte qui a l'élève en classe, mélange ou
// regroupement des classes, des langues vivantes.
//
// Méthode : placement initial élève par élève, puis échanges entre groupes tant
// qu'un échange améliore la somme des scores. Chaque groupe tient à jour ses
// compteurs (filles, garçons, classes, langues…) : évaluer un échange ne coûte
// que quelques opérations, au lieu de recalculer les groupes entiers.
//
// Le résultat ne dépend pas de l'ordre des élèves, et deux lancements sur les
// mêmes données donnent les mêmes groupes.

import type { Eleve, Enseignant, Scenario } from '../domain/models';
import type { CustomModeConfig } from '../stores/uiStore';

// ============ TYPES ============

export interface CustomGroup {
  id: string;
  nom: string;
  eleveIds: string[];
  enseignantIds: string[];
  capaciteMax: number;
}

export interface CustomSolverResult {
  groups: CustomGroup[];
  affectations: CustomAffectation[];
  nonAffectes: string[];
  scoreGlobal: number;
  tempsCalculMs: number;
}

export interface CustomAffectation {
  eleveId: string;
  juryId: string;
  enseignantId: string;
  score: number;
  scoreDetail: Record<string, number>;
  explication: string;
}

const LANGUES = ['allemand', 'anglais', 'espagnol', 'italien', 'chinois', 'arabe', 'portugais', 'russe'];
const MAX_PASSES = 50;
const EPSILON = 1e-6;

// ============ DONNÉES PRÉPARÉES ============

interface EleveInfo {
  eleve: Eleve;
  sexe: 'M' | 'F' | null;
  classe: string;
  /** Combinaison de langues vivantes (« allemand|espagnol »), vide si aucune. */
  langues: string;
}

interface Stats {
  n: number;
  f: number;
  m: number;
  /** Nombre de couples (élève, adulte du groupe) où l'adulte a l'élève en classe. */
  enClasse: number;
  classes: Map<string, number>;
  langues: Map<string, number>;
}

function cleTri(...parts: (string | undefined)[]): string {
  return parts.map(p => p ?? '').join('\u0000');
}

function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function languesDe(eleve: Eleve): string {
  return (eleve.options ?? [])
    .map(o => o.toLowerCase())
    .flatMap(o => LANGUES.filter(l => o.includes(l)))
    .sort()
    .join('|');
}

function heuresTotales(e: Enseignant): number {
  return e.heuresParNiveau ? Object.values(e.heuresParNiveau).reduce((s, v) => s + (v ?? 0), 0) : 0;
}

function poidsParite(priorite: CustomModeConfig['critereParity']): number {
  return priorite === 'required' ? 3 : priorite === 'high' ? 2 : priorite === 'normal' ? 1.5 : 1;
}

function intensiteParite(priorite: CustomModeConfig['critereParity']): number {
  return priorite === 'low' ? 0.3 : priorite === 'normal' ? 0.6 : priorite === 'high' ? 0.9 : 1;
}

// ============ SCORE D'UN GROUPE ============

class Evaluateur {
  /** Part de filles parmi les élèves dont le sexe est connu : la cible de chaque groupe. */
  private readonly partFilles: number;
  private readonly config: CustomModeConfig;
  /** Pour chaque groupe, nombre d'adultes du groupe qui ont chaque classe. */
  private readonly adultesParClasse: Map<string, number>[];
  private readonly nbAdultes: number[];

  constructor(
    config: CustomModeConfig,
    eleves: EleveInfo[],
    adultesParClasse: Map<string, number>[],
    nbAdultes: number[]
  ) {
    this.config = config;
    this.adultesParClasse = adultesParClasse;
    this.nbAdultes = nbAdultes;
    const f = eleves.filter(e => e.sexe === 'F').length;
    const m = eleves.filter(e => e.sexe === 'M').length;
    this.partFilles = f + m > 0 ? f / (f + m) : 0.5;
  }

  statsVides(): Stats {
    return { n: 0, f: 0, m: 0, enClasse: 0, classes: new Map(), langues: new Map() };
  }

  ajouter(g: number, s: Stats, e: EleveInfo, signe: 1 | -1): void {
    s.n += signe;
    if (e.sexe === 'F') s.f += signe;
    else if (e.sexe === 'M') s.m += signe;
    s.enClasse += signe * (this.adultesParClasse[g].get(e.classe) ?? 0);
    const incr = (map: Map<string, number>, cle: string) => {
      const v = (map.get(cle) ?? 0) + signe;
      if (v === 0) map.delete(cle);
      else map.set(cle, v);
    };
    incr(s.classes, e.classe);
    incr(s.langues, e.langues);
  }

  /** Score du groupe (0 à 100) et détail par critère. */
  score(g: number, s: Stats): { score: number; detail: Record<string, number> } {
    const c = this.config;
    const detail: Record<string, number> = {};
    let somme = 0;
    let poids = 0;
    const critere = (cle: string, valeur: number, w: number) => {
      detail[cle] = Math.round(valeur);
      somme += valeur * w;
      poids += w;
    };

    if (c.critereParity !== 'off') {
      const sexes = s.f + s.m;
      let brut = 100;
      if (sexes > 0) {
        // Écart à la proportion de la classe d'âge : une parité stricte est
        // impossible quand la cohorte elle-même n'est pas à 50/50.
        const ecart = Math.abs(s.f / sexes - this.partFilles);
        brut = 100 * (1 - ecart / Math.max(this.partFilles, 1 - this.partFilles));
      }
      critere('parite', Math.max(0, brut) * intensiteParite(c.critereParity), poidsParite(c.critereParity));
    }

    if (c.critereEnseignantAEleve !== 'off' && c.useAdultes && this.nbAdultes[g] > 0) {
      const total = s.n * this.nbAdultes[g];
      const ratio = total > 0 ? s.enClasse / total : 0;
      critere('enseignantEleve', total === 0 ? 50 : (c.critereEnseignantAEleve === 'prefer' ? ratio : 1 - ratio) * 100, 1.5);
    }

    if (c.critereMemeClasse !== 'off' && s.n > 1) {
      const diversite = s.classes.size / s.n;
      critere('memeClasse', (c.critereMemeClasse === 'prefer' ? 1 - diversite : diversite) * 100, 1);
    }

    if (c.critereLV !== 'off' && s.n > 1) {
      let max = 1;
      for (const v of s.langues.values()) if (v > max) max = v;
      const homogeneite = max / s.n;
      critere('lv', (c.critereLV === 'same' ? homogeneite : 1 - homogeneite) * 100, 1);
    }

    return { score: poids > 0 ? Math.max(0, Math.min(100, somme / poids)) : 50, detail };
  }

  /** Score du groupe après remplacement de `sort` par `entre` (sans le modifier). */
  scoreApresEchange(g: number, s: Stats, sort: EleveInfo, entre: EleveInfo): number {
    this.ajouter(g, s, sort, -1);
    this.ajouter(g, s, entre, 1);
    const resultat = this.score(g, s).score;
    this.ajouter(g, s, entre, -1);
    this.ajouter(g, s, sort, 1);
    return resultat;
  }
}

// ============ SOLVEUR PRINCIPAL ============

/**
 * Crée les groupes et affecte les élèves + enseignants
 */
export function solveCustom(
  eleves: Eleve[],
  enseignants: Enseignant[],
  _scenario: Scenario,
  config: CustomModeConfig
): CustomSolverResult {
  const debut = performance.now();

  const selection = new Set(config.selectedEleveIds);
  const infos: EleveInfo[] = eleves
    .filter(e => selection.has(e.id))
    .sort((a, b) => comparer(cleTri(a.nom, a.prenom, a.classe, a.id), cleTri(b.nom, b.prenom, b.classe, b.id)))
    .map(eleve => ({
      eleve,
      sexe: eleve.sexe === 'M' || eleve.sexe === 'F' ? eleve.sexe : null,
      classe: eleve.classe ?? '',
      langues: languesDe(eleve),
    }));

  const selectionAdultes = new Set(config.selectedEnseignantIds);
  const adultes = config.useAdultes
    ? enseignants
      .filter(e => selectionAdultes.has(e.id))
      .sort((a, b) => comparer(cleTri(a.nom, a.prenom, a.id), cleTri(b.nom, b.prenom, b.id)))
    : [];

  const nbEleves = infos.length;
  if (nbEleves === 0) {
    return { groups: [], affectations: [], nonAffectes: [], scoreGlobal: 0, tempsCalculMs: 0 };
  }

  // Nombre et taille des groupes
  const tailleCible = config.tailleGroupeFixe
    ? config.tailleGroupeMin
    : Math.round((config.tailleGroupeMin + config.tailleGroupeMax) / 2);
  const nbGroupes = Math.max(1, Math.round(nbEleves / Math.max(1, tailleCible)));
  const tailleBase = Math.floor(nbEleves / nbGroupes);
  const reste = nbEleves - tailleBase * nbGroupes;

  const groups: CustomGroup[] = Array.from({ length: nbGroupes }, (_, i) => ({
    id: `custom-g-${i + 1}`,
    nom: `Groupe ${i + 1}`,
    eleveIds: [],
    enseignantIds: [],
    capaciteMax: i < reste ? tailleBase + 1 : tailleBase,
  }));

  // === Adultes : répartis à tour de rôle (les plus gros services d'abord si demandé) ===
  const ordreAdultes = config.critereVolumeHoraire
    ? [...adultes].sort((a, b) => heuresTotales(b) - heuresTotales(a))
    : adultes;
  ordreAdultes.forEach((a, i) => groups[i % nbGroupes].enseignantIds.push(a.id));

  const parId = new Map(adultes.map(a => [a.id, a]));
  const adultesParClasse = groups.map(g => {
    const map = new Map<string, number>();
    for (const id of g.enseignantIds) {
      for (const classe of parId.get(id)?.classesEnCharge ?? []) map.set(classe, (map.get(classe) ?? 0) + 1);
    }
    return map;
  });
  const evaluateur = new Evaluateur(config, infos, adultesParClasse, groups.map(g => g.enseignantIds.length));

  // === Placement initial ===
  const membres: number[][] = groups.map(() => []);
  const stats: Stats[] = groups.map(() => evaluateur.statsVides());
  const scores = groups.map((_, g) => evaluateur.score(g, stats[g]).score);

  infos.forEach((e, i) => {
    let meilleur = -1;
    let meilleurGain = -Infinity;
    for (let g = 0; g < nbGroupes; g++) {
      if (membres[g].length >= groups[g].capaciteMax) continue;
      evaluateur.ajouter(g, stats[g], e, 1);
      const gain = evaluateur.score(g, stats[g]).score - scores[g]
        + (groups[g].capaciteMax - membres[g].length) * 2; // remplir les groupes les plus vides
      evaluateur.ajouter(g, stats[g], e, -1);
      if (gain > meilleurGain + EPSILON) {
        meilleurGain = gain;
        meilleur = g;
      }
    }
    membres[meilleur].push(i);
    evaluateur.ajouter(meilleur, stats[meilleur], e, 1);
    scores[meilleur] = evaluateur.score(meilleur, stats[meilleur]).score;
  });

  // === Échanges entre groupes ===
  for (let passe = 0; passe < MAX_PASSES; passe++) {
    let ameliore = false;
    for (let ga = 0; ga < nbGroupes; ga++) {
      for (let gb = ga + 1; gb < nbGroupes; gb++) {
        for (let ia = 0; ia < membres[ga].length; ia++) {
          for (let ib = 0; ib < membres[gb].length; ib++) {
            const a = infos[membres[ga][ia]];
            const b = infos[membres[gb][ib]];
            const nouveauA = evaluateur.scoreApresEchange(ga, stats[ga], a, b);
            const nouveauB = evaluateur.scoreApresEchange(gb, stats[gb], b, a);
            if (nouveauA + nouveauB > scores[ga] + scores[gb] + EPSILON) {
              evaluateur.ajouter(ga, stats[ga], a, -1);
              evaluateur.ajouter(ga, stats[ga], b, 1);
              evaluateur.ajouter(gb, stats[gb], b, -1);
              evaluateur.ajouter(gb, stats[gb], a, 1);
              [membres[ga][ia], membres[gb][ib]] = [membres[gb][ib], membres[ga][ia]];
              scores[ga] = nouveauA;
              scores[gb] = nouveauB;
              ameliore = true;
            }
          }
        }
      }
    }
    if (!ameliore) break;
  }

  // === Résultat ===
  const affectations: CustomAffectation[] = [];
  groups.forEach((g, gi) => {
    g.eleveIds = membres[gi].map(i => infos[i].eleve.id);
    const { score, detail } = evaluateur.score(gi, stats[gi]);
    const arrondi = Math.round(score);
    for (const eleveId of g.eleveIds) {
      affectations.push({
        eleveId,
        juryId: g.id,
        enseignantId: g.enseignantIds[0] || '',
        score: arrondi,
        scoreDetail: detail,
        explication: `Affecté au ${g.nom} (score : ${arrondi})`,
      });
    }
  });

  return {
    groups,
    affectations,
    nonAffectes: [],
    scoreGlobal: affectations.length > 0
      ? Math.round(affectations.reduce((s, a) => s + a.score, 0) / affectations.length)
      : 0,
    tempsCalculMs: Math.round(performance.now() - debut),
  };
}
