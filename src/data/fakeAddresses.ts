/**
 * Module de génération d'adresses fictives pour les tests
 * Centre: Collège Jean Laurain, 1 rue Jean Laurain, 57140 Woippy
 * Rayon: ~50km autour de Woippy (Moselle, France)
 * 
 * ⚠️ Ces adresses sont réelles mais utilisées uniquement à des fins de test.
 * Aucune donnée personnelle n'est associée à ces adresses.
 */

// Coordonnées du collège (centre de référence)
export const COLLEGE_REFERENCE = {
  nom: 'Collège Jean Laurain',
  adresse: '1 rue Jean Laurain',
  codePostal: '57140',
  ville: 'Woippy',
  lat: 49.1547,
  lng: 6.1517,
};

// Type pour une adresse fictive
export interface FakeAddress {
  adresse: string;
  codePostal: string;
  ville: string;
  // Coordonnées approximatives pour référence (pas utilisées pour le géocodage réel)
  lat?: number;
  lng?: number;
  // Distance approximative du collège en km
  distanceApproxKm?: number;
}

/**
 * Liste d'adresses réelles autour de Woippy (rayon ~50km)
 * Classées par distance approximative du collège
 */
export const FAKE_ADDRESSES_ENSEIGNANTS: FakeAddress[] = [
  // Woippy et environs immédiats (0-5km)
  { adresse: '15 rue de Briey', codePostal: '57140', ville: 'Woippy', lat: 49.1523, lng: 6.1489, distanceApproxKm: 1 },
  { adresse: '8 avenue de Thionville', codePostal: '57140', ville: 'Woippy', lat: 49.1561, lng: 6.1534, distanceApproxKm: 1 },
  { adresse: '22 rue du Général de Gaulle', codePostal: '57140', ville: 'Woippy', lat: 49.1538, lng: 6.1502, distanceApproxKm: 1 },
  
  // Metz (3-5km)
  { adresse: '45 rue Serpenoise', codePostal: '57000', ville: 'Metz', lat: 49.1193, lng: 6.1757, distanceApproxKm: 4 },
  { adresse: '12 place Saint-Louis', codePostal: '57000', ville: 'Metz', lat: 49.1175, lng: 6.1778, distanceApproxKm: 4 },
  { adresse: '3 avenue Foch', codePostal: '57000', ville: 'Metz', lat: 49.1108, lng: 6.1756, distanceApproxKm: 5 },
  { adresse: '28 rue des Clercs', codePostal: '57000', ville: 'Metz', lat: 49.1198, lng: 6.1745, distanceApproxKm: 4 },
  { adresse: '7 rue du Pont des Morts', codePostal: '57000', ville: 'Metz', lat: 49.1231, lng: 6.1689, distanceApproxKm: 4 },
  
  // Maizières-lès-Metz (5-8km)
  { adresse: '18 rue de la Gare', codePostal: '57280', ville: 'Maizières-lès-Metz', lat: 49.2089, lng: 6.1631, distanceApproxKm: 6 },
  { adresse: '5 place de la Mairie', codePostal: '57280', ville: 'Maizières-lès-Metz', lat: 49.2103, lng: 6.1612, distanceApproxKm: 6 },
  
  // Hagondange (8-12km)
  { adresse: '24 rue de Verdun', codePostal: '57300', ville: 'Hagondange', lat: 49.2456, lng: 6.1642, distanceApproxKm: 10 },
  { adresse: '11 avenue de la Liberté', codePostal: '57300', ville: 'Hagondange', lat: 49.2478, lng: 6.1598, distanceApproxKm: 10 },
  
  // Amnéville (10-15km)
  { adresse: '6 rue des Thermes', codePostal: '57360', ville: 'Amnéville', lat: 49.2567, lng: 6.1378, distanceApproxKm: 12 },
  { adresse: '33 rue du Casino', codePostal: '57360', ville: 'Amnéville', lat: 49.2589, lng: 6.1356, distanceApproxKm: 12 },
  
  // Thionville (20-25km)
  { adresse: '14 place du Marché', codePostal: '57100', ville: 'Thionville', lat: 49.3578, lng: 6.1656, distanceApproxKm: 23 },
  { adresse: '29 avenue Albert 1er', codePostal: '57100', ville: 'Thionville', lat: 49.3601, lng: 6.1623, distanceApproxKm: 23 },
  { adresse: '8 rue de Paris', codePostal: '57100', ville: 'Thionville', lat: 49.3589, lng: 6.1678, distanceApproxKm: 23 },
  { adresse: '51 route de Luxembourg', codePostal: '57100', ville: 'Thionville', lat: 49.3612, lng: 6.1712, distanceApproxKm: 24 },
  
  // Briey (25-30km)
  { adresse: '17 rue Raymond Poincaré', codePostal: '54150', ville: 'Briey', lat: 49.2489, lng: 5.9401, distanceApproxKm: 27 },
  { adresse: '4 place de la République', codePostal: '54150', ville: 'Briey', lat: 49.2501, lng: 5.9412, distanceApproxKm: 27 },
  
  // Pont-à-Mousson (25-30km)
  { adresse: '21 place Duroc', codePostal: '54700', ville: 'Pont-à-Mousson', lat: 48.9067, lng: 6.0534, distanceApproxKm: 28 },
  { adresse: '9 rue Victor Hugo', codePostal: '54700', ville: 'Pont-à-Mousson', lat: 48.9078, lng: 6.0512, distanceApproxKm: 28 },
  
  // Boulay-Moselle (30-35km)
  { adresse: '13 Grand Rue', codePostal: '57220', ville: 'Boulay-Moselle', lat: 49.1834, lng: 6.4923, distanceApproxKm: 32 },
  { adresse: '6 rue de l\'Église', codePostal: '57220', ville: 'Boulay-Moselle', lat: 49.1845, lng: 6.4901, distanceApproxKm: 32 },
  
  // Moyeuvre-Grande (15-20km)
  { adresse: '19 rue de Metz', codePostal: '57250', ville: 'Moyeuvre-Grande', lat: 49.2567, lng: 6.0423, distanceApproxKm: 18 },
  { adresse: '2 place Jeanne d\'Arc', codePostal: '57250', ville: 'Moyeuvre-Grande', lat: 49.2578, lng: 6.0445, distanceApproxKm: 18 },
  
  // Rombas (12-15km)
  { adresse: '31 rue de la Mine', codePostal: '57120', ville: 'Rombas', lat: 49.2512, lng: 6.0934, distanceApproxKm: 14 },
  { adresse: '7 avenue Jean Jaurès', codePostal: '57120', ville: 'Rombas', lat: 49.2523, lng: 6.0912, distanceApproxKm: 14 },
  
  // Sarrebourg (45-50km)
  { adresse: '25 rue de la Gare', codePostal: '57400', ville: 'Sarrebourg', lat: 48.7345, lng: 7.0534, distanceApproxKm: 48 },
  { adresse: '10 Grand Rue', codePostal: '57400', ville: 'Sarrebourg', lat: 48.7356, lng: 7.0512, distanceApproxKm: 48 },
  
  // Forbach (45-50km)
  { adresse: '16 rue Nationale', codePostal: '57600', ville: 'Forbach', lat: 49.1878, lng: 6.9023, distanceApproxKm: 50 },
  { adresse: '3 place de l\'Hôtel de Ville', codePostal: '57600', ville: 'Forbach', lat: 49.1889, lng: 6.9001, distanceApproxKm: 50 },
];

/**
 * Liste d'adresses pour les lieux de stage des élèves
 * Entreprises fictives autour de Woippy
 */
export const FAKE_ADDRESSES_STAGES: FakeAddress[] = [
  // Woippy - Zone commerciale
  { adresse: '1 rue du Commerce', codePostal: '57140', ville: 'Woippy', distanceApproxKm: 1 },
  { adresse: '45 avenue des Deux Fontaines', codePostal: '57140', ville: 'Woippy', distanceApproxKm: 2 },
  { adresse: '12 rue de l\'Industrie', codePostal: '57140', ville: 'Woippy', distanceApproxKm: 2 },
  
  // Metz - Centre et zones d'activités
  { adresse: '78 rue aux Arènes', codePostal: '57000', ville: 'Metz', distanceApproxKm: 4 },
  { adresse: '23 boulevard de Trèves', codePostal: '57070', ville: 'Metz', distanceApproxKm: 5 },
  { adresse: '156 avenue de Strasbourg', codePostal: '57070', ville: 'Metz', distanceApproxKm: 6 },
  { adresse: '34 rue du Pont Rouge', codePostal: '57000', ville: 'Metz', distanceApproxKm: 4 },
  { adresse: '89 avenue de Nancy', codePostal: '57000', ville: 'Metz', distanceApproxKm: 5 },
  { adresse: '5 rue Belle Isle', codePostal: '57000', ville: 'Metz', distanceApproxKm: 4 },
  { adresse: '67 rue Haute Seille', codePostal: '57000', ville: 'Metz', distanceApproxKm: 4 },
  { adresse: '112 route de Thionville', codePostal: '57050', ville: 'Metz', distanceApproxKm: 3 },
  
  // Technopôle Metz
  { adresse: '4 boulevard Arago', codePostal: '57078', ville: 'Metz Technopôle', distanceApproxKm: 8 },
  { adresse: '7 rue Marconi', codePostal: '57078', ville: 'Metz Technopôle', distanceApproxKm: 8 },
  
  // Actipôle et zones industrielles
  { adresse: '15 rue des Artisans', codePostal: '57140', ville: 'Woippy', distanceApproxKm: 3 },
  { adresse: '28 zone industrielle Sud', codePostal: '57140', ville: 'Woippy', distanceApproxKm: 3 },
  
  // Maizières-lès-Metz
  { adresse: '42 rue de l\'Usine', codePostal: '57280', ville: 'Maizières-lès-Metz', distanceApproxKm: 7 },
  { adresse: '9 avenue de la Paix', codePostal: '57280', ville: 'Maizières-lès-Metz', distanceApproxKm: 6 },
  
  // Hagondange
  { adresse: '56 rue de la Sidérurgie', codePostal: '57300', ville: 'Hagondange', distanceApproxKm: 11 },
  { adresse: '18 rue du Fer', codePostal: '57300', ville: 'Hagondange', distanceApproxKm: 10 },
  
  // Amnéville
  { adresse: '2 rue du Zoo', codePostal: '57360', ville: 'Amnéville', distanceApproxKm: 12 },
  { adresse: '25 rue du Bois de Coulange', codePostal: '57360', ville: 'Amnéville', distanceApproxKm: 13 },
  
  // Thionville
  { adresse: '145 route de Metz', codePostal: '57100', ville: 'Thionville', distanceApproxKm: 20 },
  { adresse: '67 rue de l\'Ancien Hôpital', codePostal: '57100', ville: 'Thionville', distanceApproxKm: 23 },
  { adresse: '38 allée de la Libération', codePostal: '57100', ville: 'Thionville', distanceApproxKm: 22 },
  { adresse: '91 boulevard Foch', codePostal: '57100', ville: 'Thionville', distanceApproxKm: 24 },
  
  // Yutz
  { adresse: '23 rue de Basse-Yutz', codePostal: '57970', ville: 'Yutz', distanceApproxKm: 25 },
  { adresse: '8 rue du Moulin', codePostal: '57970', ville: 'Yutz', distanceApproxKm: 24 },
  
  // Briey
  { adresse: '12 zone industrielle', codePostal: '54150', ville: 'Briey', distanceApproxKm: 28 },
  { adresse: '45 rue Jean Jaurès', codePostal: '54150', ville: 'Briey', distanceApproxKm: 27 },
  
  // Pont-à-Mousson
  { adresse: '78 rue Saint-Martin', codePostal: '54700', ville: 'Pont-à-Mousson', distanceApproxKm: 29 },
  { adresse: '34 avenue de la gare', codePostal: '54700', ville: 'Pont-à-Mousson', distanceApproxKm: 28 },
  
  // Moyeuvre-Grande
  { adresse: '56 rue de la Vallée', codePostal: '57250', ville: 'Moyeuvre-Grande', distanceApproxKm: 17 },
  { adresse: '23 rue de l\'Orne', codePostal: '57250', ville: 'Moyeuvre-Grande', distanceApproxKm: 18 },
  
  // Rombas
  { adresse: '89 avenue de Verdun', codePostal: '57120', ville: 'Rombas', distanceApproxKm: 14 },
  { adresse: '12 rue Pasteur', codePostal: '57120', ville: 'Rombas', distanceApproxKm: 13 },
  
  // Uckange
  { adresse: '34 rue de Metz', codePostal: '57270', ville: 'Uckange', distanceApproxKm: 15 },
  { adresse: '67 Grand Rue', codePostal: '57270', ville: 'Uckange', distanceApproxKm: 16 },
  
  // Talange
  { adresse: '45 rue de Hagondange', codePostal: '57525', ville: 'Talange', distanceApproxKm: 9 },
  { adresse: '18 rue de la Moselle', codePostal: '57525', ville: 'Talange', distanceApproxKm: 8 },
  
  // Fameck
  { adresse: '23 rue de Florange', codePostal: '57290', ville: 'Fameck', distanceApproxKm: 17 },
  { adresse: '56 avenue de Grande-Bretagne', codePostal: '57290', ville: 'Fameck', distanceApproxKm: 18 },
  
  // Florange
  { adresse: '78 rue de la Paix', codePostal: '57190', ville: 'Florange', distanceApproxKm: 20 },
  { adresse: '12 rue du Commerce', codePostal: '57190', ville: 'Florange', distanceApproxKm: 19 },
  
  // Montigny-lès-Metz
  { adresse: '34 rue de Pont-à-Mousson', codePostal: '57950', ville: 'Montigny-lès-Metz', distanceApproxKm: 6 },
  { adresse: '89 avenue de la Liberté', codePostal: '57950', ville: 'Montigny-lès-Metz', distanceApproxKm: 7 },
  
  // Le Ban-Saint-Martin
  { adresse: '45 rue de Metz', codePostal: '57050', ville: 'Le Ban-Saint-Martin', distanceApproxKm: 3 },
  { adresse: '12 rue des Jardins', codePostal: '57050', ville: 'Le Ban-Saint-Martin', distanceApproxKm: 3 },
  
  // Longeville-lès-Metz
  { adresse: '67 rue de l\'Église', codePostal: '57050', ville: 'Longeville-lès-Metz', distanceApproxKm: 4 },
  { adresse: '23 avenue des Alliés', codePostal: '57050', ville: 'Longeville-lès-Metz', distanceApproxKm: 4 },
];

/**
 * Noms d'entreprises fictifs pour les stages
 */
export const FAKE_COMPANY_NAMES: string[] = [
  'Boulangerie Artisanale',
  'Pharmacie Centrale',
  'Cabinet Médical',
  'Garage Auto Plus',
  'Salon de Coiffure Style',
  'Restaurant Le Gourmet',
  'Librairie du Centre',
  'Supermarché Express',
  'Clinique Vétérinaire',
  'Agence Immobilière',
  'Cabinet d\'Avocats',
  'Bureau de Tabac',
  'Fleuriste Les Roses',
  'Pâtisserie Gourmande',
  'Optique Vision',
  'Électricité Martin',
  'Plomberie Services',
  'Menuiserie Bois & Co',
  'Cabinet Comptable',
  'Imprimerie Rapide',
  'Laboratoire d\'Analyses',
  'Mairie',
  'Médiathèque Municipale',
  'Centre Social',
  'Association Sportive',
  'Banque Populaire',
  'Caisse d\'Épargne',
  'Poste',
  'École Maternelle',
  'École Primaire',
  'Maison de Retraite',
  'Centre de Loisirs',
  'Boucherie Charcuterie',
  'Pressing du Centre',
  'Pizzeria Italia',
  'Kebab Palace',
  'Cave à Vins',
  'Fromagerie Tradition',
  'Cordonnerie Éclair',
  'Magasin Bio Nature',
  'Salle de Sport Fitness',
  'Auto-École Conduite',
  'Photographe Studio',
  'Bijouterie Diamant',
  'Mercerie Couture',
  'Jardinerie Verte',
  'Animalerie Compagnie',
  'Chocolaterie Délices',
  'Quincaillerie Outillage',
  'Papeterie Bureau',
];

/**
 * Retourne une adresse aléatoire pour un enseignant
 */
export function getRandomEnseignantAddress(): FakeAddress {
  const index = Math.floor(Math.random() * FAKE_ADDRESSES_ENSEIGNANTS.length);
  return FAKE_ADDRESSES_ENSEIGNANTS[index];
}

/**
 * Retourne une adresse aléatoire pour un stage
 */
export function getRandomStageAddress(): FakeAddress {
  const index = Math.floor(Math.random() * FAKE_ADDRESSES_STAGES.length);
  return FAKE_ADDRESSES_STAGES[index];
}

/**
 * Retourne un nom d'entreprise aléatoire
 */
export function getRandomCompanyName(): string {
  const index = Math.floor(Math.random() * FAKE_COMPANY_NAMES.length);
  return FAKE_COMPANY_NAMES[index];
}

/**
 * Génère une adresse complète formatée
 */
export function formatFullAddress(addr: FakeAddress): string {
  return `${addr.adresse}, ${addr.codePostal} ${addr.ville}`;
}

/**
 * Retourne une liste d'adresses uniques pour N enseignants
 */
export function getUniqueEnseignantAddresses(count: number): FakeAddress[] {
  const shuffled = [...FAKE_ADDRESSES_ENSEIGNANTS].sort(() => Math.random() - 0.5);
  // Si on demande plus d'adresses qu'il n'y en a, on réutilise
  const result: FakeAddress[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

/**
 * Retourne une liste d'adresses uniques pour N stages
 */
export function getUniqueStageAddresses(count: number): FakeAddress[] {
  const shuffled = [...FAKE_ADDRESSES_STAGES].sort(() => Math.random() - 0.5);
  const result: FakeAddress[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}
