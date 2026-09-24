// Asks a free OpenRouter model for the day's 10 oddest notices and writes data/<date>.json.
// Usage: npm run pick [-- YYYY-MM-DD]. Without a date, picks the latest day once and leaves it alone afterwards.
import { existsSync, writeFileSync } from 'node:fs';
import { latestDate, fetchAvis } from '../lib/boamp.mjs';
import { mergeChoice } from '../lib/score.mjs';

// Free models come and go: the first one that answers wins.
// Order comes from a side-by-side test on real days (nemotron ultra picked best).
const MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-31b-it:free',
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

const PROMPT = `Voici les avis de marchés publics publiés aujourd'hui au BOAMP, un par ligne : "identifiant | objet | acheteur".
Choisis les 10 plus insolites : ceux qui font sourire, surprennent ou intriguent quand on découvre que l'État ou une collectivité achète ça (animaux, fêtes, objets inattendus, contextes étonnants). Écarte les travaux, la maintenance et les fournitures ordinaires, même rédigés de façon technique.
Pour chacun, écris une accroche en français (moins de 12 mots) qui fait sourire : un clin d'œil, pas une reformulation de l'objet. N'invente aucun fait, montant ni détail absent de la ligne.
Exemples inventés de bonnes accroches (ne les réutilise pas) :
- "Achat de 300 bonnets de Père Noël" → "Le Père Noël sous-traite."
- "Location d'un troupeau de moutons pour l'entretien des parcs" → "Des tondeuses qui font bêê."
Mauvaise accroche (simple reformulation) : "Construction d'un dôme géodésique pour l'université".
Réponds uniquement avec ce JSON : {"top":[{"idweb":"...","pourquoi":"..."}]}`;

async function ask(model, avis) {
  const lines = avis.map((a) => `${a.idweb} | ${a.objet.replace(/\s+/g, ' ')} | ${a.nomacheteur}`).join('\n');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: `${PROMPT}\n\n${lines}` }] }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const text = (await res.json()).choices?.[0]?.message?.content ?? '';
  const { top } = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (!Array.isArray(top) || !top.length) throw new Error('empty answer');
  return top;
}

if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is missing');
const date = process.argv[2] ?? (await latestDate());
const file = `data/${date}.json`;
if (!process.argv[2] && existsSync(file)) {
  console.log(`${file} already exists`);
  process.exit();
}
const avis = await fetchAvis(date);

// Free models are often rate-limited: two passes over the list, one minute apart.
let choice = [], model = null;
for (let pass = 0; pass < 2 && !model; pass++) {
  if (pass) await new Promise((r) => setTimeout(r, 60_000));
  for (const m of MODELS) {
    try {
      choice = await ask(m, avis);
      model = m;
      break;
    } catch (e) {
      console.error(`${m}: ${e.message.slice(0, 120)}`);
    }
  }
}

const top = mergeChoice(choice, avis);
writeFileSync(file, JSON.stringify({ date, total: avis.length, model, top }, null, 1) + '\n');
console.log(`${date}: ${avis.length} notices, ${top.filter((a) => a.pourquoi).length}/10 picked by ${model ?? 'nobody (keyword fallback)'}`);
for (const a of top) console.log('-', a.objet.replace(/\s+/g, ' ').slice(0, 80), a.pourquoi ? `→ ${a.pourquoi}` : '');
