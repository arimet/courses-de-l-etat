export const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe');

// Hand-tuned keyword lists: adjust them by looking at the daily top.
// Whole words only, otherwise "rat" matches "préparation".
const words = (list) => new RegExp(`(?<![\\p{L}])(${list.join('|')})(?![\\p{L}])`, 'gu');

const INSOLITE = words([
  "oeuvres? d'art", 'spectacles?', "feux? d'artifice", 'pyrotechni\\p{L}*', 'noel', 'illuminations?',
  'chocolats?', 'champagne', 'huitres?', 'fleurs?', 'fleurissement', 'chevaux', 'cheval', 'equins?',
  'chiens?', 'chats?', 'animaux', 'animal', 'pigeons?', 'abeilles?', 'ruches?', 'rats?', 'nuisibles',
  'taupes?', 'frelons?', 'costumes?', 'deguisements?', 'mascottes?', 'trophees?', 'medailles?', 'goodies',
  'drones?', 'cloches?', 'orgues?', 'pianos?', 'sapins?', 'patinoires?', 'plages?', 'bateaux?',
  'montgolfieres?', 'fouilles? archeologiques?', 'cinema', 'concerts?', 'cirques?', 'jouets?', 'ballons?',
  'bonnets?', 'parapluies?', 'statues?', 'carillons?', 'zoo', 'potagers?', 'insectes?',
  'fetes?', 'carnaval', 'marionnettes?', 'escargots?', 'moutons?', 'chevres?', 'eco-paturage',
  'chalets?', 'cadeaux', 'sculptures?', 'theatre', 'domes? geodesiques?', 'vins?', 'bieres?',
]);

// "repas" stays here: it mostly surfaces ordinary school canteens.
const BANAL = words([
  'maintenance', 'entretien', 'travaux', "maitrise d'oeuvre", 'assurances?', 'nettoyage', 'etudes?',
  'electricite', 'menuiseries?', 'voirie', 'plomberie', 'chauffage', 'informatiques?', 'logiciels?',
  'accord-cadre', 'renouvellement', 'repas', 'restauration collective',
]);

const count = (re, s) => (s.match(re) ?? []).length;

export function descriptorFreq(avis) {
  const f = new Map();
  for (const a of avis) for (const d of a.descripteur_libelle ?? []) f.set(d, (f.get(d) ?? 0) + 1);
  return f;
}

export function score(a, freq) {
  const o = normalize(a.objet);
  let s = 3 * count(INSOLITE, o) - count(BANAL, o);
  for (const d of a.descripteur_libelle ?? []) if (freq.get(d) === 1) s += 1;
  if (a.objet.length < 60) s += 1;
  return s;
}

// Notices with an odd keyword always rank first; the rest only fill up to n.
export function topInsolites(avis, n = 10) {
  const freq = descriptorFreq(avis);
  const seen = new Set();
  return avis
    .map((a) => ({ a, odd: count(INSOLITE, normalize(a.objet)) > 0, s: score(a, freq) }))
    .sort((x, y) => y.odd - x.odd || y.s - x.s)
    .filter(({ a }) => !seen.has(normalize(a.objet)) && seen.add(normalize(a.objet)))
    .slice(0, n)
    .map(({ a }) => a);
}

// Keeps the model's picks that really exist in today's notices, then fills up with the keyword ranking.
export function mergeChoice(choice, avis, n = 10) {
  const byId = new Map(avis.map((a) => [a.idweb, a]));
  const picked = new Map();
  for (const { idweb, pourquoi } of choice) {
    if (byId.has(idweb) && !picked.has(idweb)) picked.set(idweb, { ...byId.get(idweb), pourquoi: String(pourquoi ?? '') });
  }
  for (const a of topInsolites(avis, avis.length)) if (!picked.has(a.idweb)) picked.set(a.idweb, a);
  return [...picked.values()].slice(0, n);
}
