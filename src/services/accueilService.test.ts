import { describe, it, expect } from 'vitest';
import {
  lireDateStage, joursAvant, echeance, anneeScolaire, prochaineEtape, etapesOral, avancement,
  type EtatPreparation,
} from './accueilService';

const base = (patch: Partial<EtatPreparation> = {}): EtatPreparation => ({
  nbEleves: 117, nbClasses: 4, nbEnseignants: 42, nbEnseignantsSansAdresse: 3,
  nbStages: 0, debutStages: null, nbSujetsRenseignes: 0,
  oral: { enCours: false, nbJurys: 0, nbRepartis: 0 },
  stages: { enCours: false, nbAttribues: 0 },
  aujourdhui: new Date(2026, 10, 24),
  ...patch,
});

describe('Dates de stage', () => {
  it('lit les formats courants', () => {
    expect(lireDateStage('14/12/2026')).toEqual(new Date(2026, 11, 14));
    expect(lireDateStage('2026-12-14')).toEqual(new Date(2026, 11, 14));
    expect(lireDateStage('46370')).toEqual(new Date(2026, 11, 14));
    expect(lireDateStage('bientôt')).toBeNull();
    expect(lireDateStage(undefined)).toBeNull();
  });

  it('compte les jours et les dit en français', () => {
    expect(joursAvant(new Date(2026, 11, 14), new Date(2026, 10, 24, 18))).toBe(20);
    expect(echeance(20)).toBe('dans 20 jours');
    expect(echeance(1)).toBe('demain');
    expect(echeance(-3)).toBe('il y a 3 jours');
  });

  it("donne l'année scolaire", () => {
    expect(anneeScolaire(new Date(2026, 10, 24))).toBe('2026-2027');
    expect(anneeScolaire(new Date(2027, 4, 2))).toBe('2026-2027');
  });
});

describe('Prochaine étape', () => {
  it('commence par les élèves, puis les enseignants', () => {
    expect(prochaineEtape(base({ nbEleves: 0 })).action).toBe('importer-eleves');
    expect(prochaineEtape(base({ nbEnseignants: 0 })).action).toBe('importer-enseignants');
  });

  it('propose les stages tant qu’ils ne sont pas attribués', () => {
    expect(prochaineEtape(base()).action).toBe('importer-stages');
    const avecStages = prochaineEtape(base({ nbStages: 117, debutStages: new Date(2026, 11, 14) }));
    expect(avecStages.action).toBe('attribuer-tuteurs');
    expect(avecStages.detail).toContain('dans 20 jours');
  });

  it("passe à l'oral une fois les tuteurs attribués", () => {
    const e = base({ nbStages: 117, stages: { enCours: true, nbAttribues: 117 }, nbSujetsRenseignes: 40 });
    const etape = prochaineEtape(e);
    expect(etape.action).toBe('preparer-oral');
    expect(etape.bouton).toBe('Renseigner les sujets');
    expect(prochaineEtape({ ...e, oral: { enCours: true, nbJurys: 8, nbRepartis: 117 } }).action).toBe('reprendre-oral');
  });

  it("mesure l'avancement des deux chantiers", () => {
    expect(etapesOral(base())[0].faite).toBe(true);
    expect(avancement(base())).toBe(17);
    expect(avancement(base({
      nbStages: 117, nbSujetsRenseignes: 117,
      oral: { enCours: true, nbJurys: 8, nbRepartis: 117 },
      stages: { enCours: true, nbAttribues: 117 },
    }))).toBe(100);
  });
});
