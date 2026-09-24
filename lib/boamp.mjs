const BASE = 'https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp';

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`BOAMP HTTP ${res.status}`);
  return res.json();
}

export async function latestDate() {
  const { results } = await get('/records?select=dateparution&order_by=dateparution%20desc&limit=1');
  return results[0].dateparution;
}

// The API leaves some HTML entities in text fields ("d&#039;Ille").
const decode = (s) => s?.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(n)).replace(/&amp;/g, '&');

// /exports has no 100-record cap, unlike /records.
export async function fetchAvis(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`date invalide : ${date}`);
  const where = encodeURIComponent(`dateparution=date'${date}' AND nature_libelle='Avis de marché'`);
  const avis = await get(`/exports/json?where=${where}&select=idweb,objet,nomacheteur,code_departement,descripteur_libelle,url_avis`);
  return avis.map((a) => ({ ...a, objet: decode(a.objet), nomacheteur: decode(a.nomacheteur) }));
}

// Estimated amount in euros, or null. Two schemas coexist: eForms (European notices) and FNSimple (national).
// Global estimate first, then the sum of lots, then the framework maximum.
const num = (v) => { const x = Number(v?.['#text'] ?? v?.valeur ?? v); return x > 0 ? x : null; };
const sum = (xs) => { const v = xs.map(num).filter(Boolean); return v.length ? v.reduce((a, b) => a + b) : null; };
const list = (x) => (x == null ? [] : [x].flat());

export function estimate(d) {
  const e = d?.EFORMS?.ContractNotice;
  if (e) {
    const total = (p) => p?.['cac:RequestedTenderTotal'];
    const max = (p) => total(p)?.['ext:UBLExtensions']?.['ext:UBLExtension']?.['ext:ExtensionContent']?.['efext:EformsExtension']?.['efbc:FrameworkMaximumAmount'];
    const lots = list(e['cac:ProcurementProjectLot']).map((l) => l['cac:ProcurementProject']);
    return num(total(e['cac:ProcurementProject'])?.['cbc:EstimatedOverallContractAmount'])
      ?? sum(lots.map((p) => total(p)?.['cbc:EstimatedOverallContractAmount']))
      ?? num(max(e['cac:ProcurementProject'])) ?? sum(lots.map(max));
  }
  const f = d?.FNSimple?.initial;
  const v = f?.natureMarche?.valeurEstimee;
  return num(v) ?? num(v?.fourchette?.valeurHaute) ?? sum(list(f?.lots?.lot).map((l) => l.estimationValeur));
}

// Map idweb -> estimated amount (or null), in one request for the displayed notices only (donnees is ~12 KB each).
export async function fetchMontants(ids) {
  if (!ids.length) return new Map();
  const where = encodeURIComponent(`idweb IN (${ids.map((id) => JSON.stringify(id)).join(',')})`);
  const rows = await get(`/exports/json?where=${where}&select=idweb,donnees`);
  return new Map(rows.map((r) => {
    try { return [r.idweb, estimate(JSON.parse(r.donnees))]; } catch { return [r.idweb, null]; }
  }));
}
