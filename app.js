import { latestDate, fetchAvis, fetchMontants } from './lib/boamp.mjs';
import { topInsolites } from './lib/score.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// Some objects are written in capitals: sentence case reads better on the ticket.
const tidy = (s) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
};

const shift = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Picked by a model each morning (scripts/pick.mjs); other days fall back to keywords.
async function load(date) {
  const { total, top } = await fetch(`data/${date}.json`).then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(async () => {
      const avis = await fetchAvis(date);
      return { total: avis.length, top: topInsolites(avis) };
    });
  const montants = await fetchMontants(top.map((a) => a.idweb)).catch(() => new Map());
  return { total, top: top.map((a) => ({ ...a, montant: montants.get(a.idweb) ?? null })) };
}

function item(a, i) {
  const li = el('li');
  li.style.setProperty('--i', i);
  // Buyers often already write their department: "Ville d'Antibes (06)".
  const dep = a.code_departement?.length ? `(${a.code_departement.map((d) => d.padStart(2, '0')).join(', ')})` : '';
  const body = el('div', { className: 'body' });
  body.append(el('a', { href: a.url_avis, target: '_blank', rel: 'noopener', textContent: tidy(a.objet), title: a.objet }));
  if (a.pourquoi) body.append(el('p', { className: 'quip', textContent: a.pourquoi }));
  body.append(el('span', { className: 'buyer', textContent: a.nomacheteur.includes(dep) ? a.nomacheteur : `${a.nomacheteur} ${dep}` }));
  const price = a.montant
    ? el('span', { className: 'price', textContent: euros.format(a.montant) })
    : el('span', { className: 'price nc', textContent: 'N.C.', title: 'Montant non communiqué' });
  li.append(body, price);
  return li;
}

function state(message, action) {
  const box = el('div', { className: 'state' });
  box.append(el('p', { textContent: message }));
  if (action) box.append(el('button', { type: 'button', textContent: action.label, onclick: action.run }));
  $('content').replaceChildren(box);
}

const jour = $('jour');
let latest;

async function show(date) {
  jour.value = date;
  $('next').disabled = date >= latest;
  $('ticket-date').textContent = longDate.format(new Date(`${date}T00:00:00Z`));
  $('count').textContent = $('sum').textContent = '…';
  $('content').replaceChildren(...Array.from({ length: 6 }, () => el('div', { className: 'skel' })));

  try {
    const { total, top } = await load(date);
    if (jour.value !== date) return; // a newer date was picked meanwhile
    $('count').textContent = total.toLocaleString('fr-FR');
    if (!top.length) {
      $('sum').textContent = euros.format(0);
      return state('Aucun avis de marché publié ce jour-là.', { label: 'Dernier ticket', run: () => show(latest) });
    }
    const priced = top.filter((a) => a.montant);
    const sum = priced.reduce((s, a) => s + a.montant, 0);
    $('sum').textContent = euros.format(sum);

    const list = el('ol', { id: 'top', className: 'printed' });
    list.append(...top.map(item));
    const line = el('div', { className: 'total' });
    line.append(el('span', { textContent: 'Total estimé' }), el('span', { textContent: euros.format(sum) }));
    const note = el('p', { className: 'total-note', textContent: `${top.length} articles, dont ${priced.length} avec un montant estimé.` });
    $('content').replaceChildren(list, el('hr', { className: 'rule' }), line, note);
  } catch (e) {
    state(`Impossible de joindre l'API BOAMP (${e.message}).`, { label: 'Réessayer', run: () => show(date) });
  }
}

latest = await latestDate().catch(() => new Date().toISOString().slice(0, 10));
jour.max = latest;
jour.onchange = () => jour.value && show(jour.value);
// Desktop browsers only open the calendar from its icon, which is hidden here.
jour.onclick = () => { try { jour.showPicker(); } catch {} };
$('prev').onclick = () => show(shift(jour.value, -1));
$('next').onclick = () => show(shift(jour.value, 1));
show(latest);
