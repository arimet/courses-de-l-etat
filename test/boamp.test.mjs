import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate } from '../lib/boamp.mjs';

const amount = (x) => ({ '@currencyID': 'EUR', '#text': x });

test('eForms: global estimate wins over lots', () => {
  const d = { EFORMS: { ContractNotice: {
    'cac:ProcurementProject': { 'cac:RequestedTenderTotal': { 'cbc:EstimatedOverallContractAmount': amount('940000.00') } },
    'cac:ProcurementProjectLot': { 'cac:ProcurementProject': { 'cac:RequestedTenderTotal': { 'cbc:EstimatedOverallContractAmount': amount('1') } } },
  } } };
  assert.equal(estimate(d), 940000);
});

test('eForms: sums lots when there is no global estimate, ignoring zeros', () => {
  const lot = (x) => ({ 'cac:ProcurementProject': { 'cac:RequestedTenderTotal': { 'cbc:EstimatedOverallContractAmount': amount(x) } } });
  assert.equal(estimate({ EFORMS: { ContractNotice: { 'cac:ProcurementProjectLot': [lot('1000'), lot('0.00'), lot('500')] } } }), 1500);
});

test('FNSimple: estimated value, range high value, then lots', () => {
  assert.equal(estimate({ FNSimple: { initial: { natureMarche: { valeurEstimee: { valeur: '42000' } } } } }), 42000);
  assert.equal(estimate({ FNSimple: { initial: { natureMarche: { valeurEstimee: { fourchette: { valeurHaute: '90000' } } } } } }), 90000);
  assert.equal(estimate({ FNSimple: { initial: { lots: { lot: [{ estimationValeur: { valeur: '10' } }, { estimationValeur: { valeur: '5' } }] } } } }), 15);
});

test('no amount, zero or unknown schema gives null', () => {
  assert.equal(estimate({ FNSimple: { initial: { natureMarche: { valeurEstimee: { fourchette: '' } } } } }), null);
  assert.equal(estimate({}), null);
  assert.equal(estimate(null), null);
});
