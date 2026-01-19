// ============================================================
// SEED DATA - Données de démonstration
// ============================================================

import type { Eleve, Enseignant } from '../domain/models';
import { eleveRepository, enseignantRepository, scenarioRepository } from '../infrastructure/repositories';
import { FAKE_ADDRESSES_ENSEIGNANTS, formatFullAddress } from './fakeAddresses';

// ============ ÉLÈVES ============

// Plus d'élèves par défaut pour le seed
const elevesData: Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[] = [];

// ============ ENSEIGNANTS ============

const enseignantsData: Omit<Enseignant, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { nom: 'ALTINTAS', prenom: 'Sevval', matierePrincipale: 'Physique-Chimie', classesEnCharge: ['3A', '3B', '3C', '4A', '4B', '4C'], estProfPrincipal: false, tags: [] },
  { nom: 'AUBERNIAS', prenom: 'Marie', matierePrincipale: 'Français', classesEnCharge: ['4F', '4E', '3D'], estProfPrincipal: true, classePP: '4F', tags: [] },
  { nom: 'BARET', prenom: 'Hélène', matierePrincipale: 'Documentation', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F', '3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'BETTINGER', prenom: 'Rosaria', matierePrincipale: 'Anglais', classesEnCharge: ['5A', '5B', '4A', '4B'], estProfPrincipal: false, tags: [] },
  { nom: 'BOUCHKHACHEKH', prenom: 'Sarah', matierePrincipale: 'Espagnol', classesEnCharge: ['4A', '4B', '4C', '3A', '3B'], estProfPrincipal: false, tags: [] },
  { nom: 'BOULENOUAR', prenom: 'Mohamed', matierePrincipale: 'Technologie', classesEnCharge: ['6A', '6B', '5A', '5B', '4A', '4B', '3A', '3B'], estProfPrincipal: false, tags: [] },
  { nom: 'BULLIER', prenom: 'Marie-Noëlle', matierePrincipale: 'Français', classesEnCharge: ['6A', '6B', '5C', '5D'], estProfPrincipal: false, tags: [] },
  { nom: 'CHARBONNIER', prenom: 'Antoine', matierePrincipale: 'EPS', classesEnCharge: ['6A', '6B', '6C', '6D', '6E'], estProfPrincipal: true, classePP: '6D', tags: [] },
  { nom: 'CHARLES', prenom: 'Thomas', matierePrincipale: 'SVT', classesEnCharge: ['4A', '4B', '4C', '4D', '4E', '4F', '3A', '3B'], estProfPrincipal: true, classePP: '4E', tags: [] },
  { nom: 'CHEDANI', prenom: 'Mammar', matierePrincipale: 'EPS', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '3A', tags: [] },
  { nom: 'D\'ANNA', prenom: 'Solaine', matierePrincipale: 'Anglais', classesEnCharge: ['6A', '6B', '6C', '3C', '3D'], estProfPrincipal: false, tags: [] },
  { nom: 'FAN CHAMBON', prenom: 'Lijun', matierePrincipale: 'Chinois', classesEnCharge: ['5A', '5B', '4A', '4B', '3A', '3B'], estProfPrincipal: false, tags: [] },
  { nom: 'GABRIEL', prenom: 'Christine', matierePrincipale: 'Mathématiques', classesEnCharge: ['6A', '6B', '6C', '5A'], estProfPrincipal: true, classePP: '6A', tags: [] },
  { nom: 'GARNIER', prenom: 'Marion', matierePrincipale: '', classesEnCharge: [], estProfPrincipal: false, tags: [] },
  { nom: 'GAUDEL', prenom: 'Géraldine', matierePrincipale: 'Français', classesEnCharge: ['5A', '5B', '4C', '4D', '3A'], estProfPrincipal: false, tags: [] },
  { nom: 'GENTILLET', prenom: 'Julie', matierePrincipale: 'Allemand', classesEnCharge: ['6A', '6B', '5A', '5B', '4A', '4B', '4C', '3A', '3B'], estProfPrincipal: true, classePP: '4C', tags: [] },
  { nom: 'GESENHUES', prenom: 'Nathalie', matierePrincipale: 'Français', classesEnCharge: ['3A', '3B', '3C', '3D'], estProfPrincipal: true, classePP: '3C', tags: [] },
  { nom: 'HEITZ', prenom: 'Florent', matierePrincipale: 'Mathématiques', classesEnCharge: ['4A', '4B', '4C', '3A', '3B'], estProfPrincipal: false, tags: [] },
  { nom: 'HOEBEL-SEGUIN', prenom: 'Angélique', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['6C', '6D', '5A', '5B'], estProfPrincipal: false, tags: [] },
  { nom: 'HOJLO', prenom: 'Emmanuelle', matierePrincipale: 'ULIS TFC', classesEnCharge: ['ULIS'], estProfPrincipal: false, tags: [] },
  { nom: 'JASKOWIAK', prenom: 'Hugo', matierePrincipale: 'EPS', classesEnCharge: ['5A', '5B', '5C', '5D'], estProfPrincipal: true, classePP: '5A', tags: [] },
  { nom: 'KARST', prenom: 'Claudia', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['5C', '5D', '4A', '4B'], estProfPrincipal: true, classePP: '5C', tags: [] },
  { nom: 'KRENC', prenom: 'Carine', matierePrincipale: 'Mathématiques', classesEnCharge: ['4D', '4E', '4F', '3C'], estProfPrincipal: true, classePP: '4A', tags: [] },
  { nom: 'LANGBACH', prenom: 'Pauline', matierePrincipale: '', classesEnCharge: [], estProfPrincipal: false, tags: [] },
  { nom: 'LASSALLE', prenom: 'Carole', matierePrincipale: 'Physique-Chimie', classesEnCharge: ['3C', '3D', '3E', '4D', '4E'], estProfPrincipal: true, classePP: '3E', tags: [] },
  { nom: 'MALLET', prenom: 'Céline', matierePrincipale: 'Anglais', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '3B', tags: [] },
  { nom: 'MANSOURI M JAHED', prenom: 'Ahmed', matierePrincipale: 'Technologie', classesEnCharge: ['6C', '6D', '6E', '5C', '5D', '4C', '4D', '3C', '3D'], estProfPrincipal: true, classePP: '5B', tags: [] },
  { nom: 'MARTIN', prenom: 'Pauline', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['6A', '6B', '6E', '4C', '4D'], estProfPrincipal: true, classePP: '6E', tags: [] },
  { nom: 'MARTINEZ', prenom: 'Chloé', matierePrincipale: 'Espagnol', classesEnCharge: ['4D', '4E', '4F', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'MEMBRE', prenom: 'Estelle', matierePrincipale: 'Éducation musicale', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F', '3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'NENNIG', prenom: 'Nathalie', matierePrincipale: 'Français', classesEnCharge: ['6C', '6D', '6E', '4A', '4B'], estProfPrincipal: false, tags: [] },
  { nom: 'PERCHERON', prenom: 'Amandine', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '3D', tags: [] },
  { nom: 'PIZZOL', prenom: 'Stéphanie', matierePrincipale: 'Mathématiques', classesEnCharge: ['5B', '5C', '5D', '3D', '3E'], estProfPrincipal: true, classePP: '5D', tags: [] },
  { nom: 'ROULLET', prenom: 'Agathe', matierePrincipale: 'Anglais', classesEnCharge: ['4C', '4D', '4E', '4F'], estProfPrincipal: false, tags: [] },
  { nom: 'SCHURCH', prenom: 'Marion', matierePrincipale: 'EPS', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '4A', '4B', '4C', '4D', '4E', '4F'], estProfPrincipal: true, classePP: '6B', tags: [] },
  { nom: 'SCHWARTZ', prenom: 'Nicolas', matierePrincipale: 'Allemand', classesEnCharge: ['6C', '6D', '6E', '5C', '5D', '4D', '4E', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'STENGER', prenom: 'Hélène', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['4E', '4F', '5C', '5D'], estProfPrincipal: false, tags: [] },
  { nom: 'THIRY', prenom: 'Amandine', matierePrincipale: 'Anglais', classesEnCharge: ['6C', '6D', '6E', '5C', '5D'], estProfPrincipal: true, classePP: '6C', tags: [] },
  { nom: 'THOMAS', prenom: 'Rachel', matierePrincipale: 'Arts plastiques', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F', '3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'TILLE', prenom: 'Ibo', matierePrincipale: 'Français', classesEnCharge: ['4B', '4C', '4D', '4E'], estProfPrincipal: true, classePP: '4B', tags: [] },
  { nom: 'TISON', prenom: 'Christophe', matierePrincipale: 'Arts plastiques', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F', '3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'UKROPINA', prenom: 'Laurence', matierePrincipale: 'Français', classesEnCharge: ['5A', '5B', '5C', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'WEBER', prenom: 'Ewan', matierePrincipale: 'SVT', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4D'], estProfPrincipal: true, classePP: '4D', tags: [] },
  { nom: 'ZANOUNE', prenom: 'Anissa', matierePrincipale: 'Mathématiques', classesEnCharge: ['6D', '6E', '4F', '5A'], estProfPrincipal: false, tags: [] },
];

// ============ FONCTION DE SEED ============

export async function seedDatabase(): Promise<{
  eleves: number;
  enseignants: number;
  scenarios: number;
}> {
  // Vérifier si des données existent déjà
  const existingEleves = await eleveRepository.count();
  const existingEnseignants = await enseignantRepository.count();
  
  if (existingEleves > 0 || existingEnseignants > 0) {
    console.log('Database already seeded, skipping...');
    return {
      eleves: existingEleves,
      enseignants: existingEnseignants,
      scenarios: await scenarioRepository.count(),
    };
  }
  
  console.log('Seeding database...');
  
  // Ajouter les élèves
  const eleves = await eleveRepository.createMany(elevesData);
  console.log(`Created ${eleves.length} élèves`);
  
  // Ajouter les enseignants
  const enseignants = await enseignantRepository.createMany(enseignantsData);
  console.log(`Created ${enseignants.length} enseignants`);
  
  // Créer les scénarios par défaut
  await scenarioRepository.ensureDefaults();
  const scenarios = await scenarioRepository.count();
  console.log(`Created ${scenarios} scénarios`);
  
  return {
    eleves: eleves.length,
    enseignants: enseignants.length,
    scenarios,
  };
}

export async function clearAndReseedDatabase(): Promise<void> {
  console.log('Clearing database...');
  
  await eleveRepository.deleteAll();
  await enseignantRepository.deleteAll();
  await scenarioRepository.deleteAll();
  
  // Re-seed
  await eleveRepository.createMany(elevesData);
  await enseignantRepository.createMany(enseignantsData);
  await scenarioRepository.ensureDefaults();
  
  console.log('Database reseeded');
}

// ============ FONCTIONS DE GÉNÉRATION DE DONNÉES DE TEST ============

/**
 * Applique des adresses fictives à TOUS les enseignants existants.
 * Utilise les adresses de la liste FAKE_ADDRESSES_ENSEIGNANTS.
 * 
 * ⚠️ RÉSERVÉ AU MODE TEST/DÉMO
 */
export async function applyFakeAddressesToEnseignants(): Promise<{
  updated: number;
  total: number;
}> {
  const enseignants = await enseignantRepository.getAll();
  const addresses = [...FAKE_ADDRESSES_ENSEIGNANTS];
  
  // Mélanger les adresses pour plus de variété
  addresses.sort(() => Math.random() - 0.5);
  
  let updated = 0;
  
  for (let i = 0; i < enseignants.length; i++) {
    const ens = enseignants[i];
    const addr = addresses[i % addresses.length];
    
    await enseignantRepository.update(ens.id!, {
      adresse: formatFullAddress(addr),
      commune: `${addr.ville} ${addr.codePostal}`, // Ville + code postal pour le géocodage
      lat: addr.lat,
      lon: addr.lng,
      geoStatus: 'pending', // Le géocodage devra être fait
    });
    
    updated++;
  }
  
  console.log(`Applied fake addresses to ${updated}/${enseignants.length} enseignants`);
  
  return {
    updated,
    total: enseignants.length,
  };
}

/**
 * Supprime les adresses de tous les enseignants.
 * Utile pour remettre les données en état "propre".
 */
export async function clearEnseignantAddresses(): Promise<number> {
  const enseignants = await enseignantRepository.getAll();
  let cleared = 0;
  
  for (const ens of enseignants) {
    if (ens.adresse) {
      await enseignantRepository.update(ens.id!, {
        adresse: undefined,
        commune: undefined,
        lat: undefined,
        lon: undefined,
        geoStatus: undefined,
        geoErrorMessage: undefined,
      });
      cleared++;
    }
  }
  
  console.log(`Cleared addresses from ${cleared} enseignants`);
  return cleared;
}
