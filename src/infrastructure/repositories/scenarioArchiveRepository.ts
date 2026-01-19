// ============================================================
// SCENARIO ARCHIVE REPOSITORY
// Gestion de l'historique des scénarios pour profil enseignant
// ============================================================

import { db } from '../database/db';
import type { 
  ScenarioArchive, 
  ArchiveParticipant, 
  ArchiveEleve,
  ScenarioType 
} from '../../domain/models';

// ============================================================
// TYPES
// ============================================================

export interface EnseignantHistoryEntry {
  archiveId: string;
  scenarioId: string;
  scenarioNom: string;
  scenarioType: ScenarioType;
  archivedAt: Date;
  role: ArchiveParticipant['role'];
  roleLabel?: string;
  eleves: ArchiveEleve[];
  juryNom?: string;
  scoreTotal?: number;
}

// ============================================================
// REPOSITORY
// ============================================================

export const scenarioArchiveRepository = {
  /**
   * Récupère tous les archives
   */
  async getAll(): Promise<ScenarioArchive[]> {
    return db.scenarioArchives.orderBy('archivedAt').reverse().toArray();
  },

  /**
   * Récupère un archive par ID
   */
  async getById(id: string): Promise<ScenarioArchive | undefined> {
    return db.scenarioArchives.get(id);
  },

  /**
   * Récupère les archives d'un scénario
   */
  async getByScenarioId(scenarioId: string): Promise<ScenarioArchive[]> {
    return db.scenarioArchives
      .where('scenarioId')
      .equals(scenarioId)
      .reverse()
      .sortBy('archivedAt');
  },

  /**
   * Récupère les archives par type de scénario
   */
  async getByType(scenarioType: ScenarioType): Promise<ScenarioArchive[]> {
    return db.scenarioArchives
      .where('scenarioType')
      .equals(scenarioType)
      .reverse()
      .sortBy('archivedAt');
  },

  /**
   * Récupère l'historique d'un enseignant spécifique
   * Retourne les entrées formatées pour l'affichage
   */
  async getHistoryForEnseignant(enseignantId: string): Promise<EnseignantHistoryEntry[]> {
    const allArchives = await db.scenarioArchives.toArray();
    const history: EnseignantHistoryEntry[] = [];

    for (const archive of allArchives) {
      // Chercher si cet enseignant participe à cet archive
      const participant = archive.participants.find(p => p.enseignantId === enseignantId);
      if (!participant) continue;

      // Chercher les affectations de cet enseignant
      const affectation = archive.affectations.find(a => a.enseignantId === enseignantId);
      
      history.push({
        archiveId: archive.id,
        scenarioId: archive.scenarioId,
        scenarioNom: archive.scenarioNom,
        scenarioType: archive.scenarioType,
        archivedAt: archive.archivedAt,
        role: participant.role,
        roleLabel: participant.roleLabel,
        eleves: affectation?.eleves || [],
        juryNom: affectation?.juryNom,
        scoreTotal: affectation?.scoreTotal,
      });
    }

    // Tri par date décroissante
    return history.sort((a, b) => 
      new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
    );
  },

  /**
   * Récupère l'historique filtré par type pour un enseignant
   */
  async getHistoryForEnseignantByType(
    enseignantId: string, 
    scenarioType: ScenarioType
  ): Promise<EnseignantHistoryEntry[]> {
    const history = await this.getHistoryForEnseignant(enseignantId);
    return history.filter(h => h.scenarioType === scenarioType);
  },

  /**
   * Compte le nombre de participations d'un enseignant
   */
  async countParticipations(enseignantId: string): Promise<number> {
    const history = await this.getHistoryForEnseignant(enseignantId);
    return history.length;
  },

  /**
   * Compte les participations par type
   */
  async countParticipationsByType(enseignantId: string): Promise<Record<ScenarioType, number>> {
    const history = await this.getHistoryForEnseignant(enseignantId);
    const counts: Record<ScenarioType, number> = {
      oral_dnb: 0,
      suivi_stage: 0,
      custom: 0,
    };
    
    for (const entry of history) {
      counts[entry.scenarioType]++;
    }
    
    return counts;
  },

  /**
   * Crée un nouvel archive
   */
  async create(archive: Omit<ScenarioArchive, 'id' | 'createdAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    await db.scenarioArchives.add({
      ...archive,
      id,
      createdAt: now,
    });
    
    return id;
  },

  /**
   * Supprime un archive
   */
  async delete(id: string): Promise<void> {
    await db.scenarioArchives.delete(id);
  },

  /**
   * Supprime tous les archives d'un scénario
   */
  async deleteByScenarioId(scenarioId: string): Promise<number> {
    return db.scenarioArchives
      .where('scenarioId')
      .equals(scenarioId)
      .delete();
  },

  /**
   * Supprime tous les archives
   */
  async deleteAll(): Promise<void> {
    await db.scenarioArchives.clear();
  },
};
