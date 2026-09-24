import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, descriptorFreq, score, topInsolites, mergeChoice } from '../lib/score.mjs';

const avis = (objet, descripteur_libelle = ['Prestations de services']) =>
  ({ idweb: objet, objet, nomacheteur: 'Mairie', code_departement: ['75'], descripteur_libelle, url_avis: '' });

test('normalize strips accents and case', () => {
  assert.equal(normalize("FÊTES DE NOËL – Œuvre d'art"), "fetes de noel – oeuvre d'art");
});

test('whole words only: "préparation" does not match "rat", "Evin" does not match "vin"', () => {
  assert.equal(score(avis('Préparation de repas à Evin Malmaison pour la collectivité'), new Map()), 0);
});

test('an odd keyword scores higher than a mundane object', () => {
  const f = new Map();
  assert.ok(score(avis("Capture et prise en charge d'animaux"), f) > score(avis('Maintenance des ascenseurs'), f));
});

test('descriptor that is rare today gets a bonus', () => {
  const list = [avis('Objet A', ['Dragage']), avis('Objet B'), avis('Objet C')];
  const f = descriptorFreq(list);
  assert.equal(f.get('Dragage'), 1);
  assert.equal(f.get('Prestations de services'), 2);
  assert.equal(score(list[0], f) - score(list[1], f), 1);
});

test('null descripteur_libelle does not crash', () => {
  assert.equal(typeof score({ ...avis('Objet'), descripteur_libelle: null }, new Map()), 'number');
});

test('topInsolites sorts, truncates to n and drops duplicate objects', () => {
  const list = [
    avis('Maintenance des ascenseurs de la mairie et des écoles'),
    avis("Capture et prise en charge d'animaux"),
    avis("Capture et prise en charge d'animaux"),
    avis("Feu d'artifice du 14 juillet"),
  ];
  const top = topInsolites(list, 2).map((a) => a.objet);
  assert.equal(top.length, 2);
  assert.ok(top.includes("Capture et prise en charge d'animaux"));
  assert.ok(top.includes("Feu d'artifice du 14 juillet"));
});

test('notices with an odd keyword rank first, the rest only fill up', () => {
  const list = [avis('PONTON', ['Dragage']), avis('2027-01-SARBT-MAINTALARM'), avis('Achat de champagne brut pour les réceptions officielles')];
  assert.deepEqual(topInsolites(list, 3)[0].objet, 'Achat de champagne brut pour les réceptions officielles');
  assert.equal(topInsolites(list, 3).length, 3);
});

test('"fontaine" is not an odd keyword (it is mostly a place name)', () => {
  const list = [avis('Travaux à Fontaine-lès-Vervins et alentours'), avis('Achat de chocolats pour les fêtes de fin année')];
  assert.equal(topInsolites(list, 1)[0].objet, 'Achat de chocolats pour les fêtes de fin année');
});

test('mergeChoice keeps valid model picks in order, drops unknown ids and fills up to n', () => {
  const list = ['Maintenance des ascenseurs', "Capture d'animaux", 'Nettoyage des locaux', 'Feu d\'artifice'].map((o) => avis(o));
  const top = mergeChoice([{ idweb: 'Nettoyage des locaux', pourquoi: 'drôle' }, { idweb: 'inventé' }, { idweb: 'Nettoyage des locaux' }], list, 3);
  assert.deepEqual(top.map((a) => a.objet), ['Nettoyage des locaux', "Capture d'animaux", "Feu d'artifice"]);
  assert.equal(top[0].pourquoi, 'drôle');
});
