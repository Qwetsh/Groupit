// ============================================================
// ALGORITHME - SOLVEUR ORAL DNB AVEC JURYS
// ============================================================
//
// Le problème : placer chaque élève (ou chaque binôme/trinôme, qui passe
// ensemble) devant un jury, sans dépasser la capacité des jurys.
//
// Les priorités, dans l'ordre strict :
//   1. placer tout le monde ;
//   2. donner à chaque élève un jury qui enseigne une de ses matières d'oral ;
//   3. lui donner un jury qui enseigne sa langue étrangère, s'il en a choisi une ;
//   4. puis les critères réglables (équilibre, mixité, élèves du prof, etc.),
//      pondérés par les réglages du scénario.
//
// La méthode :
//   - les groupes sont placés d'abord, chacun dans le jury qui lui coûte le moins ;
//   - les élèves seuls sont placés par un flot à coût minimum : la meilleure
//     répartition possible sur les priorités 1 à 3 et sur l'équilibre des jurys,
//     y compris quand il faut déplacer un élève pour libérer une place ;
//   - une recherche locale (déplacements et échanges, groupes compris) affine
//     ensuite les critères qui dépendent de la composition des jurys (mixité,
//     diversité des sujets, tiers temps).
//
// Le résultat ne dépend pas de l'ordre de saisie des élèves ni des jurys, et
// deux lancements sur les mêmes données donnent la même répartition.

import type {
  Eleve,
  Enseignant,
  Scenario,
  Jury,
  MatchingResultDNB,
  SolverAlerte,
  SolverResultDNB,
  AffectationExplication,
  JuryStats,
} from '../domain/models';
import { cleMatiere, getPoidsPedagogiqueNormalise } from '../domain/models';
import { getEffectiveCriteres, criteresToOralDnbOptions, type OralDnbOptions } from '../domain/criteriaConfig';
import { COLLEGE_GEO } from '../domain/college';
import { calculateDistance } from './distance';
import { MinCostFlow } from './minCostFlow';

// ============ COÛTS ============
//
// Les écarts de grandeur entre les coûts traduisent l'ordre strict des
// priorités : aucun gain sur un critère secondaire ne peut payer la perte
// d'une correspondance de matière.

const COUT_NON_AFFECTE = 1e9;
const COUT_SANS_MATIERE = 1e7;
const COUT_SANS_LANGUE = 1e5;
/** Échelle des critères secondaires (poids normalisés entre 0 et 1). */
const ECHELLE = 1000;
/** Préférence pour le premier choix de matière plutôt que le second. */
const POIDS_RANG = 0.1;
/** Dispersion des sujets dans un jury (toujours active, comme avant). */
const POIDS_DIVERSITE = 0.35;
/** Tiers temps : répartition entre jurys et proximité des enseignants. */
const POIDS_TIERS_TEMPS = 0.3;
/** Un minimum d'équilibre, pour ne jamais remplir un jury au hasard. */
const EQUILIBRE_MINIMAL = 0.05;
/** Au-delà de cette part d'un même sujet dans un jury, la diversité pénalise. */
const SEUIL_CONCENTRATION = 0.3;
const MAX_PASSES_RECHERCHE = 60;
const MAX_TOURS = 3;
const EPSILON = 1e-6;

interface SolverDnbConfig {
  verbose: boolean;
}

const DEFAULT_CONFIG: SolverDnbConfig = {
  verbose: false,
};

/**
 * Extrait les options de scoring depuis le scénario
 * Utilise criteresV2 si disponible, sinon fallback sur l'ancien système
 */
function getOptionsFromScenario(scenario: Scenario): OralDnbOptions {
  if (scenario.parametres.criteresV2?.length) {
    const effectiveCriteres = getEffectiveCriteres('oral_dnb', scenario.parametres.criteresV2);
    return criteresToOralDnbOptions(effectiveCriteres);
  }

  const oralConfig = scenario.parametres.oralDnb;
  if (!oralConfig) {
    return {
      poidsMatiereMatch: 70,
      poidsEquilibrage: 20,
      poidsMixite: 10,
      poidsPedagogique: 0,
      poidsCapacite: 0,
      poidsElevesEnCours: 0,
      equilibrageWeightByHours: false,
    };
  }

  // Ancien format : un poids pour la matière, le reste partagé entre les critères cochés.
  const hasCritere = (c: string) => oralConfig.criteresSecondaires?.includes(c as 'equilibrage' | 'parite' | 'capacite');
  const nbCriteres = oralConfig.criteresSecondaires?.length || 1;
  const poidsSecondaire = (100 - oralConfig.poidsMatiere) / nbCriteres;

  return {
    poidsMatiereMatch: oralConfig.poidsMatiere,
    poidsEquilibrage: hasCritere('equilibrage') ? poidsSecondaire : 0,
    poidsMixite: hasCritere('parite') ? poidsSecondaire : 0,
    poidsPedagogique: 0,
    poidsCapacite: hasCritere('capacite') ? poidsSecondaire : 0,
    poidsElevesEnCours: 0,
    equilibrageWeightByHours: false,
  };
}

interface Poids {
  matiere: number;
  equilibrage: number;
  mixite: number;
  capacite: number;
  pedagogique: number;
  enCours: number;
  /** La correspondance de matière est-elle recherchée ? */
  avecMatiere: boolean;
  parHeures: boolean;
}

/** Poids entre 0 et 1, de somme 1 (hors critères toujours actifs). */
function normaliserPoids(opts: OralDnbOptions): Poids {
  const brut = {
    matiere: Math.max(0, opts.poidsMatiereMatch),
    equilibrage: Math.max(0, opts.poidsEquilibrage),
    mixite: Math.max(0, opts.poidsMixite),
    capacite: Math.max(0, opts.poidsCapacite),
    pedagogique: Math.max(0, opts.poidsPedagogique ?? 0),
    enCours: Math.max(0, opts.poidsElevesEnCours ?? 0),
  };
  const total = Object.values(brut).reduce((a, b) => a + b, 0);
  const k = total > 0 ? 1 / total : 0;
  return {
    matiere: brut.matiere * k,
    equilibrage: brut.equilibrage * k,
    mixite: brut.mixite * k,
    capacite: brut.capacite * k,
    pedagogique: brut.pedagogique * k,
    enCours: brut.enCours * k,
    avecMatiere: brut.matiere > 0,
    parHeures: !!opts.equilibrageWeightByHours,
  };
}

// ============ DONNÉES PRÉPARÉES ============

interface EleveInfo {
  eleve: Eleve;
  /** Clés de ses matières d'oral, dans l'ordre de ses choix. */
  cles: string[];
  /** Clé du premier choix (pour la diversité des sujets). */
  cle1: string;
  langue: string;
  sexe: 'F' | 'M' | null;
  tiersTemps: boolean;
}

interface JuryInfo {
  jury: Jury;
  enseignants: Enseignant[];
  /** Matières du jury, une par matière (libellé du premier enseignant qui l'a). */
  matieres: string[];
  cles: Set<string>;
  classes: Set<string>;
  cap: number;
  capEffective: number;
  poidsPedagogique: number;
  distanceCollegeKm: number;
}

interface Unite {
  membres: number[]; // indices dans `eleves`
  taille: number;
  /** Coût séparable total par jury. */
  cout: Float64Array;
  nbF: number;
  nbM: number;
  nbTT: number;
  /** Nombre de membres par clé de premier choix. */
  sujets: Map<string, number>;
}

interface Compte {
  n: number;
  f: number;
  m: number;
  tt: number;
  sujets: Map<string, number>;
  diversite: number;
}

const normaliserClasse = (c: string | undefined) => (c ?? '').replace(/\s+/g, '').toUpperCase();

function cleTri(...parts: (string | undefined)[]): string {
  return parts.map(p => p ?? '').join('\u0000');
}

function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function proximiteCollege(distanceKm: number): number {
  if (distanceKm <= 5) return 100;
  if (distanceKm <= 15) return 75;
  if (distanceKm <= 30) return 40;
  return 20;
}

function preparerJurys(jurys: Jury[], enseignants: Enseignant[], parHeures: boolean): JuryInfo[] {
  const parId = new Map(enseignants.map(e => [e.id, e]));
  return [...jurys]
    .sort((a, b) => comparer(cleTri(a.nom, a.id), cleTri(b.nom, b.id)))
    .map(jury => {
      const membres = jury.enseignantIds
        .map(id => parId.get(id))
        .filter((e): e is Enseignant => !!e);

      const matieres: string[] = [];
      const cles = new Set<string>();
      for (const ens of membres) {
        const cle = cleMatiere(ens.matierePrincipale);
        if (cle && !cles.has(cle)) {
          cles.add(cle);
          matieres.push(ens.matierePrincipale.trim());
        }
      }

      let distance = Infinity;
      for (const ens of membres) {
        if (ens.lat && ens.lon) {
          distance = Math.min(distance, calculateDistance(ens.lat, ens.lon, COLLEGE_GEO.lat, COLLEGE_GEO.lon));
        }
      }
      if (!isFinite(distance)) distance = 10; // aucune adresse connue

      const poidsPedagogique = matieres.length > 0
        ? matieres.reduce((s, m) => s + getPoidsPedagogiqueNormalise(m), 0) / matieres.length
        : 0.5;
      const cap = Math.max(0, jury.capaciteMax);

      return {
        jury,
        enseignants: membres,
        matieres,
        cles,
        classes: new Set(membres.flatMap(e => (e.classesEnCharge ?? []).map(normaliserClasse))),
        cap,
        capEffective: Math.max(1, parHeures ? cap * Math.max(0.3, poidsPedagogique) : cap),
        poidsPedagogique,
        distanceCollegeKm: distance,
      };
    });
}

function preparerEleves(eleves: Eleve[]): EleveInfo[] {
  return [...eleves]
    .sort((a, b) => comparer(cleTri(a.nom, a.prenom, a.classe, a.id), cleTri(b.nom, b.prenom, b.classe, b.id)))
    .map(eleve => {
      const cles: string[] = [];
      for (const m of eleve.matieresOral ?? []) {
        const cle = cleMatiere(m);
        if (cle && !cles.includes(cle)) cles.push(cle);
      }
      return {
        eleve,
        cles,
        cle1: cles[0] ?? '',
        langue: cleMatiere(eleve.langueEtrangere),
        sexe: eleve.sexe === 'F' || eleve.sexe === 'M' ? eleve.sexe : null,
        tiersTemps: !!eleve.tiersTemps,
      };
    });
}

// ============ SOLVEUR ============

class Probleme {
  readonly eleves: EleveInfo[];
  readonly jurys: JuryInfo[];
  readonly poids: Poids;
  readonly nbJurys: number;
  readonly unites: Unite[];
  /** Part de filles parmi les élèves dont le sexe est connu. */
  private readonly partFilles: number;

  constructor(eleves: EleveInfo[], jurys: JuryInfo[], poids: Poids) {
    this.eleves = eleves;
    this.jurys = jurys;
    this.poids = poids;
    this.nbJurys = jurys.length;
    const f = eleves.filter(e => e.sexe === 'F').length;
    const m = eleves.filter(e => e.sexe === 'M').length;
    this.partFilles = f + m > 0 ? f / (f + m) : 0.5;
    this.unites = this.construireUnites();
  }

  /** Rang de la matière couverte (0 = premier choix), ou -1. */
  rangMatiere(e: EleveInfo, j: JuryInfo): number {
    return e.cles.findIndex(c => j.cles.has(c));
  }

  enCours(e: EleveInfo, j: JuryInfo): boolean {
    return j.classes.has(normaliserClasse(e.eleve.classe));
  }

  /** Ce que coûte de placer cet élève dans ce jury, indépendamment des autres. */
  coutSeparable(e: EleveInfo, j: JuryInfo): number {
    const w = this.poids;
    let cout = 0;
    const rang = this.rangMatiere(e, j);
    if (w.avecMatiere && e.cles.length > 0) {
      if (rang < 0) cout += COUT_SANS_MATIERE;
      else cout += POIDS_RANG * ECHELLE * rang;
    }
    if (e.langue && !j.cles.has(e.langue)) cout += COUT_SANS_LANGUE;
    if (w.enCours > 0 && !this.enCours(e, j)) cout += w.enCours * ECHELLE;
    if (w.pedagogique > 0) cout += w.pedagogique * ECHELLE * (1 - j.poidsPedagogique);
    if (e.tiersTemps) cout += POIDS_TIERS_TEMPS * 0.4 * ECHELLE * (1 - proximiteCollege(j.distanceCollegeKm) / 100);
    return cout;
  }

  private construireUnites(): Unite[] {
    const parGroupe = new Map<string, number[]>();
    const unites: number[][] = [];
    this.eleves.forEach((e, i) => {
      const g = e.eleve.groupeOralId;
      if (!g) {
        unites.push([i]);
        return;
      }
      const membres = parGroupe.get(g);
      if (membres) membres.push(i);
      else {
        const nouveau = [i];
        parGroupe.set(g, nouveau);
        unites.push(nouveau);
      }
    });

    return unites.map(membres => {
      const cout = new Float64Array(this.nbJurys);
      const sujets = new Map<string, number>();
      let nbF = 0, nbM = 0, nbTT = 0;
      for (const i of membres) {
        const e = this.eleves[i];
        for (let j = 0; j < this.nbJurys; j++) cout[j] += this.coutSeparable(e, this.jurys[j]);
        if (e.sexe === 'F') nbF++;
        else if (e.sexe === 'M') nbM++;
        if (e.tiersTemps) nbTT++;
        if (e.cle1) sujets.set(e.cle1, (sujets.get(e.cle1) ?? 0) + 1);
      }
      return { membres, taille: membres.length, cout, nbF, nbM, nbTT, sujets };
    });
  }

  // --- Coût d'un jury selon sa composition ---

  private poidsCharge(): number {
    return this.poids.equilibrage + this.poids.capacite + EQUILIBRE_MINIMAL;
  }

  /** Coût marginal du k-ième élève dans un jury (équilibre des charges). */
  coutChargeMarginal(j: JuryInfo, k: number): number {
    return this.poidsCharge() * ECHELLE * (2 * k - 1) / j.capEffective;
  }

  private penaliteSujet(j: JuryInfo, nb: number): number {
    const exces = nb - SEUIL_CONCENTRATION * j.cap;
    return exces > 0 ? exces * exces : 0;
  }

  coutJury(j: JuryInfo, n: number, f: number, m: number, tt: number, diversite: number): number {
    const cap = Math.max(1, j.cap);
    let cout = this.poidsCharge() * ECHELLE * n * n / j.capEffective;
    if (this.poids.mixite > 0 && f + m > 0) {
      const ecart = f - this.partFilles * (f + m);
      cout += this.poids.mixite * ECHELLE * 4 * ecart * ecart / cap;
    }
    cout += POIDS_TIERS_TEMPS * 0.6 * ECHELLE * tt * tt / cap;
    cout += POIDS_DIVERSITE * ECHELLE * diversite / cap;
    return cout;
  }

  compteVide(): Compte {
    return { n: 0, f: 0, m: 0, tt: 0, sujets: new Map(), diversite: 0 };
  }

  /** Coût du jury si l'on ajoute `plus` et retire `moins` (l'un ou l'autre peut manquer). */
  coutJuryModifie(jIdx: number, c: Compte, plus: Unite | null, moins: Unite | null): number {
    const j = this.jurys[jIdx];
    const n = c.n + (plus?.taille ?? 0) - (moins?.taille ?? 0);
    const f = c.f + (plus?.nbF ?? 0) - (moins?.nbF ?? 0);
    const m = c.m + (plus?.nbM ?? 0) - (moins?.nbM ?? 0);
    const tt = c.tt + (plus?.nbTT ?? 0) - (moins?.nbTT ?? 0);
    let diversite = c.diversite;
    const touchees = new Set<string>([...(plus?.sujets.keys() ?? []), ...(moins?.sujets.keys() ?? [])]);
    for (const cle of touchees) {
      const avant = c.sujets.get(cle) ?? 0;
      const apres = avant + (plus?.sujets.get(cle) ?? 0) - (moins?.sujets.get(cle) ?? 0);
      diversite += this.penaliteSujet(j, apres) - this.penaliteSujet(j, avant);
    }
    return this.coutJury(j, n, f, m, tt, diversite);
  }

  appliquer(jIdx: number, c: Compte, u: Unite, signe: 1 | -1): void {
    const j = this.jurys[jIdx];
    c.n += signe * u.taille;
    c.f += signe * u.nbF;
    c.m += signe * u.nbM;
    c.tt += signe * u.nbTT;
    for (const [cle, nb] of u.sujets) {
      const avant = c.sujets.get(cle) ?? 0;
      const apres = avant + signe * nb;
      c.diversite += this.penaliteSujet(j, apres) - this.penaliteSujet(j, avant);
      if (apres === 0) c.sujets.delete(cle);
      else c.sujets.set(cle, apres);
    }
  }

  coutUnite(u: Unite, jIdx: number): number {
    return jIdx < 0 ? u.taille * COUT_NON_AFFECTE : u.cout[jIdx];
  }

  // --- Évaluation complète ---

  comptes(placement: Int32Array): Compte[] {
    const comptes = this.jurys.map(() => this.compteVide());
    this.unites.forEach((u, i) => {
      if (placement[i] >= 0) this.appliquer(placement[i], comptes[placement[i]], u, 1);
    });
    return comptes;
  }

  objectif(placement: Int32Array): number {
    let total = 0;
    this.unites.forEach((u, i) => { total += this.coutUnite(u, placement[i]); });
    this.comptes(placement).forEach((c, j) => {
      total += this.coutJury(this.jurys[j], c.n, c.f, c.m, c.tt, c.diversite);
    });
    return total;
  }

  // --- Étape 1 : les groupes ---

  placerGroupes(placement: Int32Array): void {
    const comptes = this.comptes(placement);
    const groupes = this.unites
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => u.taille > 1)
      .sort((a, b) =>
        b.u.taille - a.u.taille
        || this.nbJurysSansPerte(a.u) - this.nbJurysSansPerte(b.u)
        || a.i - b.i);

    for (const { u, i } of groupes) {
      let meilleur = -1;
      let meilleurCout = Infinity;
      for (let j = 0; j < this.nbJurys; j++) {
        if (comptes[j].n + u.taille > this.jurys[j].cap) continue;
        const delta = u.cout[j]
          + this.coutJuryModifie(j, comptes[j], u, null)
          - this.coutJuryModifie(j, comptes[j], null, null);
        if (delta < meilleurCout - EPSILON) {
          meilleurCout = delta;
          meilleur = j;
        }
      }
      placement[i] = meilleur;
      if (meilleur >= 0) this.appliquer(meilleur, comptes[meilleur], u, 1);
    }
  }

  /** Nombre de jurys où le groupe n'a aucune perte de matière ni de langue. */
  private nbJurysSansPerte(u: Unite): number {
    let nb = 0;
    for (let j = 0; j < this.nbJurys; j++) if (u.cout[j] < COUT_SANS_LANGUE) nb++;
    return nb;
  }

  // --- Étape 2 : les élèves seuls, par flot à coût minimum ---

  placerSeulsParFlot(placement: Int32Array): void {
    const comptes = this.comptes(placement.map((p, i) => (this.unites[i].taille > 1 ? p : -1)) as Int32Array);
    const seuls = this.unites
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => u.taille === 1);

    const J = this.nbJurys;
    const S = seuls.length;
    const source = 0;
    const premierJury = 1 + S;
    const puits = premierJury + J;
    const flot = new MinCostFlow(puits + 1);
    const arcs: { k: number; j: number; arc: { from: number; index: number } }[] = [];

    seuls.forEach(({ u }, k) => {
      flot.addEdge(source, 1 + k, 1, 0);
      for (let j = 0; j < J; j++) {
        if (comptes[j].n >= this.jurys[j].cap) continue;
        arcs.push({ k, j, arc: flot.addEdge(1 + k, premierJury + j, 1, u.cout[j]) });
      }
      flot.addEdge(1 + k, puits, 1, COUT_NON_AFFECTE);
    });
    for (let j = 0; j < J; j++) {
      const jury = this.jurys[j];
      for (let k = comptes[j].n + 1; k <= jury.cap; k++) {
        flot.addEdge(premierJury + j, puits, 1, this.coutChargeMarginal(jury, k));
      }
    }

    flot.run(source, puits, S);

    for (const { i } of seuls) placement[i] = -1;
    for (const { k, j, arc } of arcs) {
      if (flot.flowOf(arc) > 0) placement[seuls[k].i] = j;
    }
  }

  // --- Étape 3 : recherche locale ---

  ameliorer(placement: Int32Array): void {
    const comptes = this.comptes(placement);
    const U = this.unites.length;

    const placeLibre = (j: number, entre: Unite, sort: Unite | null) =>
      j < 0 || comptes[j].n + entre.taille - (sort?.taille ?? 0) <= this.jurys[j].cap;

    const coutJuryActuel = (j: number) =>
      this.coutJuryModifie(j, comptes[j], null, null);

    for (let passe = 0; passe < MAX_PASSES_RECHERCHE; passe++) {
      let ameliore = false;

      // Déplacements
      for (let i = 0; i < U; i++) {
        const u = this.unites[i];
        for (let b = 0; b < this.nbJurys; b++) {
          const a = placement[i];
          if (b === a || !placeLibre(b, u, null)) continue;
          let delta = u.cout[b] - this.coutUnite(u, a);
          delta += this.coutJuryModifie(b, comptes[b], u, null) - coutJuryActuel(b);
          if (a >= 0) delta += this.coutJuryModifie(a, comptes[a], null, u) - coutJuryActuel(a);
          if (delta < -EPSILON) {
            if (a >= 0) this.appliquer(a, comptes[a], u, -1);
            this.appliquer(b, comptes[b], u, 1);
            placement[i] = b;
            ameliore = true;
          }
        }
      }

      // Échanges
      for (let i = 0; i < U; i++) {
        for (let k = i + 1; k < U; k++) {
          const a = placement[i];
          const b = placement[k];
          if (a === b) continue;
          const u = this.unites[i];
          const v = this.unites[k];
          if (!placeLibre(a, v, u) || !placeLibre(b, u, v)) continue;
          let delta = this.coutUnite(u, b) + this.coutUnite(v, a)
            - this.coutUnite(u, a) - this.coutUnite(v, b);
          if (a >= 0) delta += this.coutJuryModifie(a, comptes[a], v, u) - coutJuryActuel(a);
          if (b >= 0) delta += this.coutJuryModifie(b, comptes[b], u, v) - coutJuryActuel(b);
          if (delta < -EPSILON) {
            if (a >= 0) { this.appliquer(a, comptes[a], u, -1); this.appliquer(a, comptes[a], v, 1); }
            if (b >= 0) { this.appliquer(b, comptes[b], v, -1); this.appliquer(b, comptes[b], u, 1); }
            placement[i] = b;
            placement[k] = a;
            ameliore = true;
          }
        }
      }

      if (!ameliore) break;
    }
  }

  resoudre(): Int32Array {
    let placement = new Int32Array(this.unites.length).fill(-1);
    this.placerGroupes(placement);
    this.placerSeulsParFlot(placement);
    this.ameliorer(placement);
    let meilleur = placement.slice();
    let meilleurCout = this.objectif(meilleur);

    // Le flot recalcule les élèves seuls autour des groupes déplacés par la
    // recherche locale ; on garde le meilleur des tours.
    for (let tour = 1; tour < MAX_TOURS; tour++) {
      placement = meilleur.slice();
      this.placerSeulsParFlot(placement);
      this.ameliorer(placement);
      const cout = this.objectif(placement);
      if (cout >= meilleurCout - EPSILON) break;
      meilleur = placement;
      meilleurCout = cout;
    }
    return meilleur;
  }
}

// ============ RÉSULTAT ============

const borne = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function libelleGroupe(taille: number): string {
  return taille === 2 ? 'Binôme' : taille === 3 ? 'Trinôme' : 'Groupe';
}

function construireResultat(
  p: Probleme,
  placement: Int32Array,
  debut: number
): SolverResultDNB {
  const comptes = p.comptes(placement);
  const juryDe = new Int32Array(p.eleves.length).fill(-1);
  p.unites.forEach((u, i) => { for (const m of u.membres) juryDe[m] = placement[i]; });

  const totalPlaces = p.jurys.reduce((s, j) => s + j.cap, 0);
  const remplissageMoyen = totalPlaces > 0
    ? comptes.reduce((s, c) => s + c.n, 0) / totalPlaces
    : 0;
  const w = p.poids;

  const affectations: MatchingResultDNB[] = [];
  const sansMatchMatiere: string[] = [];

  p.unites.forEach((u, ui) => {
    const jIdx = placement[ui];
    if (jIdx < 0) return;
    const j = p.jurys[jIdx];
    const c = comptes[jIdx];

    for (const m of u.membres) {
      const e = p.eleves[m];
      const rang = p.rangMatiere(e, j);
      const matiereMatch = rang >= 0;
      const matchingMatiere = matiereMatch ? e.eleve.matieresOral![
        (e.eleve.matieresOral ?? []).findIndex(x => cleMatiere(x) === e.cles[rang])
      ] : null;

      // Sous-scores affichés (0 à 100) et leur poids dans le score global.
      const detail: Record<string, number> = {};
      const poidsDetail: Record<string, number> = {};
      const ajouter = (cle: string, valeur: number, poids: number) => {
        detail[cle] = borne(valeur);
        poidsDetail[cle] = poids;
      };

      ajouter('matiere', e.cles.length === 0 ? 50 : matiereMatch ? 100 : 30, Math.max(w.matiere, w.avecMatiere ? 0.3 : 0.1));
      if (e.langue) ajouter('langue', j.cles.has(e.langue) ? 100 : 0, 0.5);

      const remplissage = j.cap > 0 ? c.n / j.cap : 1;
      if (w.equilibrage > 0) {
        const surplus = Math.max(0, remplissage - remplissageMoyen);
        ajouter('equilibrage', 100 - 100 * surplus / Math.max(remplissageMoyen, 0.05), w.equilibrage);
      }
      if (w.mixite > 0 && e.sexe) {
        const sexes = c.f + c.m;
        const partF = sexes > 0 ? c.f / sexes : 0.5;
        ajouter('mixite', 100 - 200 * Math.abs(partF - 0.5), w.mixite);
      }
      if (w.capacite > 0) ajouter('capacite', 100 * (1 - Math.max(0, remplissage - 0.5) * 2) , w.capacite);
      if (w.enCours > 0) ajouter('elevesEnCours', p.enCours(e, j) ? 100 : 30, w.enCours);
      if (w.pedagogique > 0) ajouter('pedagogique', j.poidsPedagogique * 100, w.pedagogique);
      if (e.tiersTemps) {
        const partTT = c.n > 0 ? c.tt / c.n : 0;
        const repartition = borne(100 - partTT * 150);
        ajouter('tiersTemps', repartition * 0.6 + proximiteCollege(j.distanceCollegeKm) * 0.4, POIDS_TIERS_TEMPS);
      }
      if (e.cle1 && c.n >= 2) {
        const concentration = (c.sujets.get(e.cle1) ?? 0) / c.n;
        ajouter('diversite', concentration <= SEUIL_CONCENTRATION ? 100 : 100 - (concentration - SEUIL_CONCENTRATION) * 140, POIDS_DIVERSITE);
      }

      const sommePoids = Object.values(poidsDetail).reduce((a, b) => a + b, 0);
      const score = borne(sommePoids > 0
        ? Object.entries(detail).reduce((s, [k, v]) => s + v * poidsDetail[k], 0) / sommePoids
        : 50);

      if (!matiereMatch && e.cles.length > 0) sansMatchMatiere.push(e.eleve.id);

      affectations.push({
        eleveId: e.eleve.id,
        juryId: j.jury.id,
        matiereEleve: e.eleve.matieresOral?.[0] ?? null,
        matieresJury: j.matieres,
        matiereMatch,
        score,
        scoreDetail: detail,
        explication: expliquer(p, e, j, u, matchingMatiere, detail, score),
      });
    }
  });

  const nonAffectes = p.eleves.filter((_, i) => juryDe[i] < 0).map(e => e.eleve.id);

  const statsParJury: Record<string, JuryStats> = {};
  p.jurys.forEach((j, jIdx) => {
    const repartitionMatieres: Record<string, number> = {};
    for (const a of affectations) {
      if (a.juryId === j.jury.id && a.matiereEleve) {
        repartitionMatieres[a.matiereEleve] = (repartitionMatieres[a.matiereEleve] ?? 0) + 1;
      }
    }
    statsParJury[j.jury.id] = {
      nbElevesAffectes: comptes[jIdx].n,
      repartitionMatieres,
      tauxRemplissage: j.cap > 0 ? Math.round((comptes[jIdx].n / j.cap) * 100) : 0,
      matieresEnseignants: j.matieres,
    };
  });

  const avecMatiere = affectations.filter(a => p.eleves.find(e => e.eleve.id === a.eleveId)!.cles.length > 0);
  const tauxMatchMatiere = avecMatiere.length > 0
    ? Math.round((avecMatiere.filter(a => a.matiereMatch).length / avecMatiere.length) * 100)
    : 100;
  const scoreGlobal = affectations.length > 0
    ? Math.round(affectations.reduce((s, a) => s + a.score, 0) / affectations.length)
    : 0;

  return {
    affectations,
    nonAffectes,
    sansMatchMatiere,
    statsParJury,
    scoreGlobal,
    tauxMatchMatiere,
    tempsCalculMs: Math.round(performance.now() - debut),
    alertes: construireAlertes(p, placement, juryDe),
  };
}

function expliquer(
  p: Probleme,
  e: EleveInfo,
  j: JuryInfo,
  u: Unite,
  matchingMatiere: string | null,
  detail: Record<string, number>,
  score: number
): AffectationExplication {
  const matieres = e.eleve.matieresOral ?? [];
  let raison: string;
  if (matchingMatiere) {
    raison = `Correspondance matière: ${matchingMatiere}`;
  } else if (matieres.length === 0) {
    raison = 'Matière non renseignée - Affecté par équilibrage';
  } else if (p.jurys.some(x => e.cles.some(c => x.cles.has(c)))) {
    raison = `Jurys de ${matieres.join('/')} complets - Affecté selon les critères secondaires`;
  } else {
    raison = `Aucun jury avec ${matieres.join('/')} - Affecté selon les critères secondaires`;
  }

  if (e.eleve.langueEtrangere) {
    raison += j.cles.has(e.langue)
      ? ` | Langue: ${e.eleve.langueEtrangere}`
      : ` | Langue: ${e.eleve.langueEtrangere} (pas d'enseignant de cette langue dans le jury)`;
  }

  if (u.taille > 1) {
    const autres = u.membres
      .map(m => p.eleves[m].eleve)
      .filter(x => x.id !== e.eleve.id)
      .map(x => `${x.prenom} ${x.nom}`);
    raison = `${libelleGroupe(u.taille)} avec ${autres.join(', ')} — ${raison}`;
  }

  return {
    raisonPrincipale: raison,
    criteresUtilises: Object.keys(detail),
    matiereRespectee: !!matchingMatiere,
    score,
    detailScores: detail,
  };
}

function pluriel(n: number, singulier: string, plurielForme: string): string {
  return `${n} ${n > 1 ? plurielForme : singulier}`;
}

function construireAlertes(p: Probleme, placement: Int32Array, juryDe: Int32Array): SolverAlerte[] {
  const alertes: SolverAlerte[] = [];
  const capMax = Math.max(0, ...p.jurys.map(j => j.cap));
  const totalPlaces = p.jurys.reduce((s, j) => s + j.cap, 0);

  // Élèves sans jury
  const sansJury: string[] = [];
  p.unites.forEach((u, i) => {
    if (placement[i] >= 0) return;
    const ids = u.membres.map(m => p.eleves[m].eleve.id);
    if (u.taille > 1 && u.taille > capMax) {
      alertes.push({
        type: 'groupe_trop_grand',
        message: `${libelleGroupe(u.taille)} de ${u.taille} élèves (${u.membres.map(m => `${p.eleves[m].eleve.prenom} ${p.eleves[m].eleve.nom}`).join(', ')}) : aucun jury n'a autant de places.`,
        eleveIds: ids,
      });
    } else {
      sansJury.push(...ids);
    }
  });
  if (sansJury.length > 0) {
    alertes.push({
      type: 'capacite_insuffisante',
      message: `${pluriel(sansJury.length, 'élève reste', 'élèves restent')} sans jury : ${pluriel(totalPlaces, 'place', 'places')} pour ${pluriel(p.eleves.length, 'élève', 'élèves')}. Ajoutez un jury ou augmentez leur capacité.`,
      eleveIds: sansJury,
    });
  }

  // Matières et langues : non couvertes, ou couvertes mais saturées
  const signaler = (
    estCouvert: (e: EleveInfo, j: JuryInfo) => boolean,
    clesEleve: (e: EleveInfo) => string[],
    libelleEleve: (e: EleveInfo) => string,
    typeNonCouverte: SolverAlerte['type'],
    typeSaturee: SolverAlerte['type'],
    nomCritere: string
  ) => {
    const nonCouvertes = new Map<string, string[]>();
    const saturees = new Map<string, string[]>();
    p.eleves.forEach((e, i) => {
      if (juryDe[i] < 0 || clesEleve(e).length === 0) return;
      if (estCouvert(e, p.jurys[juryDe[i]])) return;
      const libelle = libelleEleve(e);
      const existe = p.jurys.some(j => estCouvert(e, j));
      const cible = existe ? saturees : nonCouvertes;
      cible.set(libelle, [...(cible.get(libelle) ?? []), e.eleve.id]);
    });
    const de = (libelle: string) => (libelle.includes(' ou ') ? `de ces ${nomCritere}s` : `de cette ${nomCritere}`);
    for (const [libelle, ids] of nonCouvertes) {
      alertes.push({
        type: typeNonCouverte,
        message: `${libelle} : ${pluriel(ids.length, 'élève concerné', 'élèves concernés')}, mais aucun jury n'a d'enseignant ${de(libelle)}.`,
        eleveIds: ids,
      });
    }
    for (const [libelle, ids] of saturees) {
      alertes.push({
        type: typeSaturee,
        message: `${libelle} : ${pluriel(ids.length, 'élève passe', 'élèves passent')} devant un jury sans enseignant ${de(libelle)}, faute de place dans les jurys concernés.`,
        eleveIds: ids,
      });
    }
  };

  if (p.poids.avecMatiere) {
    signaler(
      (e, j) => e.cles.some(c => j.cles.has(c)),
      e => e.cles,
      e => (e.eleve.matieresOral ?? []).join(' ou '),
      'matiere_non_couverte',
      'matiere_saturee',
      'matière'
    );
  }
  signaler(
    (e, j) => !e.langue || j.cles.has(e.langue),
    e => (e.langue ? [e.langue] : []),
    e => e.eleve.langueEtrangere ?? '',
    'langue_non_couverte',
    'langue_saturee',
    'langue'
  );

  return alertes;
}

// ============ POINT D'ENTRÉE ============

/**
 * Répartit les élèves entre les jurys du scénario.
 * Voir l'en-tête du fichier pour les priorités et la méthode.
 */
export function solveOralDnb(
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[],
  scenario: Scenario,
  config: Partial<SolverDnbConfig> = {}
): SolverResultDNB {
  const debut = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const poids = normaliserPoids(getOptionsFromScenario(scenario));
  const jurysScenario = jurys.filter(j => j.scenarioId === scenario.id);

  if (jurysScenario.length === 0) {
    return {
      affectations: [],
      nonAffectes: eleves.map(e => e.id),
      sansMatchMatiere: [],
      statsParJury: {},
      scoreGlobal: 0,
      tauxMatchMatiere: 0,
      tempsCalculMs: Math.round(performance.now() - debut),
      alertes: eleves.length > 0
        ? [{ type: 'aucun_jury', message: 'Aucun jury n\'est défini pour ce scénario.', eleveIds: eleves.map(e => e.id) }]
        : [],
    };
  }

  const probleme = new Probleme(
    preparerEleves(eleves),
    preparerJurys(jurysScenario, enseignants, poids.parHeures),
    poids
  );
  const resultat = construireResultat(probleme, probleme.resoudre(), debut);

  if (cfg.verbose) {
    console.log('[SolverDNB]', {
      affectes: resultat.affectations.length,
      nonAffectes: resultat.nonAffectes.length,
      tauxMatchMatiere: resultat.tauxMatchMatiere,
      tempsCalculMs: resultat.tempsCalculMs,
    });
  }
  return resultat;
}

/**
 * Point d'entrée utilisé par l'application. Conservé pour compatibilité :
 * `solveOralDnb` fait désormais tout le travail (il n'y a plus de phase
 * d'échanges séparée).
 */
export function solveOralDnbComplete(
  eleves: Eleve[],
  enseignants: Enseignant[],
  jurys: Jury[],
  scenario: Scenario,
  config: Partial<SolverDnbConfig> = {}
): SolverResultDNB {
  return solveOralDnb(eleves, enseignants, jurys, scenario, config);
}
