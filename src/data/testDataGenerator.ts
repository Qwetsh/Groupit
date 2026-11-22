/**
 * Module de génération de données de test pour le suivi de stage
 * 
 * ⚠️ RÉSERVÉ AU MODE TEST/DÉMO
 * Ces fonctions génèrent des données fictives et ne doivent pas être
 * utilisées avec des données réelles.
 */

import { 
  getUniqueStageAddresses, 
  getRandomCompanyName,
  formatFullAddress,
} from './fakeAddresses';
import type { Eleve, Stage } from '../domain/models';

// Marqueur pour identifier les stages générés automatiquement
export const FAKE_STAGE_MARKER = '[TEST]';

/**
 * Génère un stage fictif pour un élève
 */
export interface GeneratedStage {
  eleveId: string;
  nomEntreprise: string;
  adresseStage: string;
  dateDebut: string;
  dateFin: string;
  tuteurEntreprise?: string;
  telephoneEntreprise?: string;
  isTest: boolean;
}

/**
 * Génère des stages fictifs pour une liste d'élèves
 */
export function generateFakeStages(
  eleves: Eleve[],
  options?: {
    dateDebut?: string;
    dateFin?: string;
  }
): GeneratedStage[] {
  const addresses = getUniqueStageAddresses(eleves.length);
  
  // Dates par défaut : semaine prochaine
  const today = new Date();
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  
  const dateDebut = options?.dateDebut || nextMonday.toISOString().split('T')[0];
  const dateFin = options?.dateFin || nextFriday.toISOString().split('T')[0];
  
  // Noms de tuteurs fictifs
  const tuteurPrenoms = ['Jean', 'Marie', 'Pierre', 'Sophie', 'Michel', 'Isabelle', 'François', 'Catherine', 'Alain', 'Nathalie'];
  const tuteurNoms = ['Dupont', 'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy'];
  
  return eleves.map((eleve, index) => {
    const addr = addresses[index];
    const tuteurPrenom = tuteurPrenoms[Math.floor(Math.random() * tuteurPrenoms.length)];
    const tuteurNom = tuteurNoms[Math.floor(Math.random() * tuteurNoms.length)];
    
    // Générer un numéro de téléphone fictif (format français)
    const telPrefix = ['01', '02', '03', '04', '05'][Math.floor(Math.random() * 5)];
    const telSuffix = Array.from({ length: 4 }, () => 
      String(Math.floor(Math.random() * 100)).padStart(2, '0')
    ).join(' ');
    
    return {
      eleveId: eleve.id!,
      nomEntreprise: `${FAKE_STAGE_MARKER} ${getRandomCompanyName()} ${addr.ville}`,
      adresseStage: formatFullAddress(addr),
      dateDebut,
      dateFin,
      tuteurEntreprise: `${tuteurPrenom} ${tuteurNom}`,
      telephoneEntreprise: `${telPrefix} ${telSuffix}`,
      isTest: true,
    };
  });
}

/**
 * Vérifie si un stage est un stage de test
 */
export function isFakeStage(stage: Stage): boolean {
  // Vérifie le marqueur dans le nom de l'entreprise
  const nomEntreprise = stage.nomEntreprise || '';
  return nomEntreprise.includes(FAKE_STAGE_MARKER) || stage.isTest === true;
}

