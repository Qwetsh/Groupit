// ============================================================
// REPOSITORY - SCÉNARIOS
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import type { Scenario, ScenarioMode, ScenarioType, ScenarioParametres } from '../../domain/models';

// Paramètres par défaut pour un scénario
export function getDefaultParametres(type: ScenarioType): ScenarioParametres {
  const baseParametres: ScenarioParametres = {
    criteres: [
      { id: 'capacite', nom: 'Capacité enseignant', actif: true, poids: 50, estContrainteDure: true },
      { id: 'equilibrage', nom: 'Équilibrage charge', actif: true, poids: 30, estContrainteDure: false },
    ],
    capaciteConfig: {
      capaciteBaseDefaut: 2,
      coefficients: {
        '6e': 0,
        '5e': 0,
        '4e': 0.5,
        '3e': 1,
      },
    },
    equilibrageActif: true,
  };

  switch (type) {
    case 'suivi_stage':
      return {
        ...baseParametres,
        criteres: [
          ...baseParametres.criteres,
          { id: 'distance', nom: 'Distance domicile-stage', actif: true, poids: 40, estContrainteDure: false },
          { id: 'contraintes_relationnelles', nom: 'Contraintes relationnelles', actif: true, poids: 100, estContrainteDure: true },
        ],
        distanceMaxKm: 50,
      };

    case 'oral_dnb':
      return {
        ...baseParametres,
        criteres: [
          { id: 'matiere', nom: 'Compatibilité matière', actif: true, poids: 100, estContrainteDure: true },
          ...baseParametres.criteres,
          { id: 'contraintes_relationnelles', nom: 'Contraintes relationnelles', actif: true, poids: 100, estContrainteDure: true },
        ],
        matieresOralPossibles: ['SVT', 'Physique-Chimie', 'Technologie', 'Histoire-Géo', 'Français', 'Arts Plastiques', 'Éducation Musicale', 'EPS'],
      };

    case 'custom':
    default:
      return {
        ...baseParametres,
        criteres: [
          ...baseParametres.criteres,
          { id: 'contraintes_relationnelles', nom: 'Contraintes relationnelles', actif: true, poids: 100, estContrainteDure: true },
        ],
      };
  }
}

export class ScenarioRepository {
  async getAll(): Promise<Scenario[]> {
    return db.scenarios.toArray();
  }

  async getById(id: string): Promise<Scenario | undefined> {
    return db.scenarios.get(id);
  }

  async getByType(type: ScenarioType): Promise<Scenario[]> {
    return db.scenarios.where('type').equals(type).toArray();
  }

  async getByMode(mode: ScenarioMode): Promise<Scenario[]> {
    return db.scenarios.where('mode').equals(mode).toArray();
  }

  async create(scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>): Promise<Scenario> {
    const newScenario: Scenario = {
      ...scenario,
      id: uuidv4(),
      parametres: scenario.parametres || getDefaultParametres(scenario.type),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.scenarios.add(newScenario);
    return newScenario;
  }

  async createDefault(nom: string, type: ScenarioType, mode: ScenarioMode = 'matching'): Promise<Scenario> {
    return this.create({
      nom,
      mode,
      type,
      parametres: getDefaultParametres(type),
    });
  }

  async update(id: string, updates: Partial<Omit<Scenario, 'id' | 'createdAt'>>): Promise<void> {
    await db.scenarios.update(id, { ...updates, updatedAt: new Date() });
  }

  async updateParametres(id: string, parametres: Partial<ScenarioParametres>): Promise<void> {
    const scenario = await this.getById(id);
    if (scenario) {
      const updatedParametres = { ...scenario.parametres, ...parametres };
      await db.scenarios.update(id, { parametres: updatedParametres, updatedAt: new Date() });
    }
  }

  async duplicate(id: string, newNom: string): Promise<Scenario | undefined> {
    const original = await this.getById(id);
    if (!original) return undefined;

    return this.create({
      nom: newNom,
      mode: original.mode,
      type: original.type,
      parametres: JSON.parse(JSON.stringify(original.parametres)),
      description: `Copie de ${original.nom}`,
    });
  }

  async delete(id: string): Promise<void> {
    await db.scenarios.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.scenarios.clear();
  }

  async count(): Promise<number> {
    return db.scenarios.count();
  }

  // Créer les scénarios par défaut si aucun n'existe
  async ensureDefaults(): Promise<void> {
    const count = await this.count();
    if (count === 0) {
      await this.createDefault('Suivi de Stage 3ème', 'suivi_stage');
      await this.createDefault('Oral DNB', 'oral_dnb');
    }
  }
}

export const scenarioRepository = new ScenarioRepository();
