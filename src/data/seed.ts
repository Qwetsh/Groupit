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
  { nom: 'ALTINTAS', prenom: 'Sevval', matierePrincipale: 'Physique-Chimie', classesEnCharge: ['4A', '4B', '4C'], estProfPrincipal: false, tags: [], adresse: "47 B RUE DE CARLING", commune: "L'HOPITAL 57490", geoStatus: 'pending' },
  { nom: 'AUBERNIAS', prenom: 'Marie', matierePrincipale: 'Français', classesEnCharge: ['3A', '3D', '3E'], estProfPrincipal: true, classePP: '4F', tags: [], adresse: "3 RUE DU HAUT POIRIER", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'BARET', prenom: 'Hélène', matierePrincipale: 'Documentation', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F'], estProfPrincipal: false, tags: [], adresse: "39 RUE RENE PAQUET", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'BETTINGER', prenom: 'Rosaria', matierePrincipale: 'Anglais', classesEnCharge: ['5A', '5B', '4A', '4B'], estProfPrincipal: false, tags: [], adresse: "31 RUE DU HAUT DES AMBES", commune: "BAZONCOURT 57530", geoStatus: 'pending' },
  { nom: 'BOUCHKHACHEKH', prenom: 'Sarah', matierePrincipale: 'Espagnol', classesEnCharge: ['3A', '3B', '3C', '3D'], estProfPrincipal: false, tags: [], adresse: "4 RUE GASTON ZELLER", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'BOULENOUAR', prenom: 'Mohamed', matierePrincipale: 'Technologie', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [], adresse: "28 RUE DU GENERAL GIBON", commune: "WOIPPY 57140", geoStatus: 'pending' },
  { nom: 'BULLIER', prenom: 'Marie-Noëlle', matierePrincipale: 'Français', classesEnCharge: ['6A', '6B', '5C', '5D'], estProfPrincipal: false, tags: [], adresse: "4 RUE AUGUSTE RENOIR", commune: "FEVES 57280", geoStatus: 'pending' },
  { nom: 'CHARBONNIER', prenom: 'Antoine', matierePrincipale: 'EPS', classesEnCharge: ['6A', '6B', '6C', '6D', '6E'], estProfPrincipal: true, classePP: '6D', tags: [], adresse: "4 RUE DES FAUVETTES", commune: "LORRY LES METZ 57050", geoStatus: 'pending' },
  { nom: 'CHARLES', prenom: 'Thomas', matierePrincipale: 'SVT', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '4E', tags: [], adresse: "3 AVENUE REPUBLIQUE", commune: "BRIEY 54150", geoStatus: 'pending' },
  { nom: 'CHEDANI', prenom: 'Mammar', matierePrincipale: 'EPS', classesEnCharge: ['3A', '3B'], estProfPrincipal: true, classePP: '3A', tags: [], adresse: "46 ROUTE DE WOIPPY", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'D\'ANNA', prenom: 'Solaine', matierePrincipale: 'Anglais', classesEnCharge: ['6A', '6B', '6C'], estProfPrincipal: false, tags: [] },
  { nom: 'FAN CHAMBON', prenom: 'Lijun', matierePrincipale: 'Chinois', classesEnCharge: ['3A'], estProfPrincipal: false, tags: [], adresse: "22 RUE DU GENERAL TREZEL", commune: "MARLY 57155", geoStatus: 'pending' },
  { nom: 'GABRIEL', prenom: 'Christine', matierePrincipale: 'Mathématiques', classesEnCharge: ['3A', '3B'], estProfPrincipal: true, classePP: '6A', tags: [], adresse: "1 RUE RENE CASSIN", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'GARNIER', prenom: 'Marion', matierePrincipale: '', classesEnCharge: ['3D', '3E'], estProfPrincipal: false, tags: [] },
  { nom: 'GAUDEL', prenom: 'Géraldine', matierePrincipale: 'Français', classesEnCharge: ['3A', '3B', '3C'], estProfPrincipal: false, tags: [], adresse: "113 ROUTE DE WOIPPY", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'GENTILLET', prenom: 'Julie', matierePrincipale: 'Allemand', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '4C', tags: [], adresse: "13 RUE DE LA CHENEAU", commune: "SCY-CHAZELLES 57160", geoStatus: 'pending' },
  { nom: 'GESENHUES', prenom: 'Nathalie', matierePrincipale: 'Français', classesEnCharge: ['3B', '3C'], estProfPrincipal: true, classePP: '3C', tags: [], adresse: "57 AVENUE DE NANCY", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'HEITZ', prenom: 'Florent', matierePrincipale: 'Mathématiques', classesEnCharge: ['4A', '4B', '4C'], estProfPrincipal: false, tags: [], adresse: "4 RUE CHRISTIAN PFISTER", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'HOEBEL-SEGUIN', prenom: 'Angélique', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['6C', '6D', '5A', '5B'], estProfPrincipal: false, tags: [] },
  { nom: 'HOJLO', prenom: 'Emmanuelle', matierePrincipale: 'ULIS TFC', classesEnCharge: ['3E'], estProfPrincipal: false, tags: [], adresse: "34 RUE G LENOTRE", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'JASKOWIAK', prenom: 'Hugo', matierePrincipale: 'EPS', classesEnCharge: ['3C', '3E'], estProfPrincipal: true, classePP: '5A', tags: [], adresse: "8 SQUARE MICHEL PRAILLON", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'KARST', prenom: 'Claudia', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['5C', '5D', '4A', '4B'], estProfPrincipal: true, classePP: '5C', tags: [], adresse: "6 CHEMIN DES VIGNERONS", commune: "METZ 57070", geoStatus: 'pending' },
  { nom: 'KRENC', prenom: 'Carine', matierePrincipale: 'Mathématiques', classesEnCharge: ['4D', '4E', '4F'], estProfPrincipal: true, classePP: '4A', tags: [], adresse: "1 IMPASSE DES PEUPLIERS", commune: "LORRY LES METZ 57050", geoStatus: 'pending' },
  { nom: 'LANGBACH', prenom: 'Pauline', matierePrincipale: '', classesEnCharge: [], estProfPrincipal: false, tags: [], adresse: "74 RUE NOTRE DAME", commune: "LORRY-MARDIGNY 57420", geoStatus: 'pending' },
  { nom: 'LASSALLE', prenom: 'Carole', matierePrincipale: 'Physique-Chimie', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '3E', tags: [], adresse: "26 IMPASSE AUGUSTE RENOIR", commune: "FEVES 57280", geoStatus: 'pending' },
  { nom: 'MALLET', prenom: 'Céline', matierePrincipale: 'Anglais', classesEnCharge: ['3A', '3B', '3C'], estProfPrincipal: true, classePP: '3B', tags: [], adresse: "12 RUE GRAMMONT", commune: "MOYEUVRE-GRANDE 57250", geoStatus: 'pending' },
  { nom: 'MANSOURI M JAHED', prenom: 'Ahmed', matierePrincipale: 'Technologie', classesEnCharge: ['3A', '3B'], estProfPrincipal: true, classePP: '5B', tags: [], adresse: "27 RUE RABELAIS", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'MARTIN', prenom: 'Pauline', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['6A', '6B', '6E', '4C', '4D'], estProfPrincipal: true, classePP: '6E', tags: [] },
  { nom: 'MARTINEZ', prenom: 'Chloé', matierePrincipale: 'Espagnol', classesEnCharge: ['3A', '3B', '3E'], estProfPrincipal: false, tags: [], adresse: "121 ROUTE DE THIONVILLE", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'MEMBRE', prenom: 'Estelle', matierePrincipale: 'Éducation musicale', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [], adresse: "51 RUE DU 19 MARS 1962", commune: "FAILLY 57640", geoStatus: 'pending' },
  { nom: 'MINELLA', prenom: 'Sarah', matierePrincipale: 'Anglais', classesEnCharge: [], estProfPrincipal: false, tags: [], adresse: "1 RUE PAUL DIACRE", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'NENNIG', prenom: 'Nathalie', matierePrincipale: 'Français', classesEnCharge: ['3A', '3D', '3E'], estProfPrincipal: false, tags: [], adresse: "30 RUE DU RUCHER", commune: "WOIPPY 57140", geoStatus: 'pending' },
  { nom: 'PERCHERON', prenom: 'Amandine', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['3A', '3C', '3D', '3E'], estProfPrincipal: true, classePP: '3D', tags: [], adresse: "118 ROUTE DE LORRY", commune: "METZ 57050", geoStatus: 'pending' },
  { nom: 'PIZZOL', prenom: 'Stéphanie', matierePrincipale: 'Mathématiques', classesEnCharge: ['3C', '3D', '3E'], estProfPrincipal: true, classePP: '5D', tags: [], adresse: "1 RUE DE LA COTE BIEUVE", commune: "ROZERIEULLES 57160", geoStatus: 'pending' },
  { nom: 'ROULLET', prenom: 'Agathe', matierePrincipale: 'Anglais', classesEnCharge: ['4C', '4D', '4E', '4F'], estProfPrincipal: false, tags: [], adresse: "61 RUE DU GENERAL PATTON", commune: "LANEUVEVILLE DEVANT NANCY 54410", geoStatus: 'pending' },
  { nom: 'SANTOS CAMILO', prenom: 'Ana Mayra', matierePrincipale: 'Espagnol', classesEnCharge: ['3A', '3B', '3E'], estProfPrincipal: false, tags: [], adresse: "1 RUE GASTON ZELLER", commune: "METZ 57000", geoStatus: 'pending' },
  { nom: 'SCHURCH', prenom: 'Marion', matierePrincipale: 'EPS', classesEnCharge: ['3D'], estProfPrincipal: true, classePP: '6B', tags: [], adresse: "45 RUE DU NORD", commune: "LE BAN SAINT MARTIN 57050", geoStatus: 'pending' },
  { nom: 'SCHWARTZ', prenom: 'Nicolas', matierePrincipale: 'Allemand', classesEnCharge: ['6C', '6D', '6E', '5C', '5D', '4D', '4E'], estProfPrincipal: false, tags: [], adresse: "65 GRAND RUE", commune: "JOUY AUX ARCHES 57130", geoStatus: 'pending' },
  { nom: 'STENGER', prenom: 'Hélène', matierePrincipale: 'Histoire-Géographie', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [], adresse: "53 RUE DE LA CHENEAU", commune: "METZ 57070", geoStatus: 'pending' },
  { nom: 'THIRY', prenom: 'Amandine', matierePrincipale: 'Anglais', classesEnCharge: ['3D', '3E'], estProfPrincipal: true, classePP: '6C', tags: [], adresse: "1 RUE PIERRE CURIE", commune: "PAGNY SUR MOSELLE 54530", geoStatus: 'pending' },
  { nom: 'THOMAS', prenom: 'Rachel', matierePrincipale: 'Arts plastiques', classesEnCharge: ['3A', '3B', '3C', '3D', '3E'], estProfPrincipal: false, tags: [], adresse: "14 RUE TRES-AU-PRE", commune: "PLESNOIS 57140", geoStatus: 'pending' },
  { nom: 'TILLE', prenom: 'Ibo', matierePrincipale: 'Français', classesEnCharge: ['4B', '4C', '4D', '4E'], estProfPrincipal: true, classePP: '4B', tags: [], adresse: "78 A RUE MIGETTE", commune: "LONGEVILLE LES METZ 57050", geoStatus: 'pending' },
  { nom: 'TISON', prenom: 'Christophe', matierePrincipale: 'Arts plastiques', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4A', '4B', '4C', '4D', '4E', '4F'], estProfPrincipal: false, tags: [], adresse: "32 RUE DE LA CHOUETTE", commune: "WOIPPY 57140", geoStatus: 'pending' },
  { nom: 'UKROPINA', prenom: 'Laurence', matierePrincipale: 'Français', classesEnCharge: ['5A', '5B', '5C'], estProfPrincipal: false, tags: [] },
  { nom: 'WEBER', prenom: 'Ewan', matierePrincipale: 'SVT', classesEnCharge: ['6A', '6B', '6C', '6D', '6E', '5A', '5B', '5C', '5D', '4D'], estProfPrincipal: true, classePP: '4D', tags: [], adresse: "25 RUE DE LA SOURCE", commune: "NANCY 54000", geoStatus: 'pending' },
  { nom: 'ZANOUNE', prenom: 'Anissa', matierePrincipale: 'Mathématiques', classesEnCharge: ['6D', '6E', '4F', '5A'], estProfPrincipal: false, tags: [], adresse: "4 B SQUARE FRANCOIS MITTERRAND", commune: "UCKANGE 57270", geoStatus: 'pending' },
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

