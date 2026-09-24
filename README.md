# La liste de courses de l'État

Chaque jour, les marchés publics les plus insolites publiés au [BOAMP](https://www.boamp.fr), présentés comme un ticket de caisse : champagne, capture d'animaux, dôme géodésique…

## Fonctionnement

- **Page statique** : `index.html` et `app.js` appellent directement l'API BOAMP (Opendatasoft, CORS ouvert). Aucun backend, aucune dépendance.
- **Sélection du jour** : chaque matin, une GitHub Action lance `scripts/pick.mjs`. Il envoie les avis du jour à un modèle gratuit d'[OpenRouter](https://openrouter.ai), qui choisit les 10 plus insolites et écrit une accroche. Le résultat est commité dans `data/AAAA-MM-JJ.json`.
- **Secours** : pour les jours sans fichier, ou si aucun modèle ne répond, le classement se fait par mots-clés (`lib/score.mjs`, listes `INSOLITE` et `BANAL`).
- **Montants** : estimation de l'acheteur lue dans le détail de l'avis (`lib/boamp.mjs`, fonction `estimate`). Environ 40 % des avis en donnent une.

## Développement

```bash
npm test         # tests
npm run serve    # http://localhost:8000
npm run pick     # sélection du jour (nécessite OPENROUTER_API_KEY dans .env)
```

L'Action a besoin du secret `OPENROUTER_API_KEY` dans les réglages du dépôt.

## Crédits

Données : BOAMP, Direction de l'information légale et administrative (DILA).
Polices : [Unbounded](https://github.com/googlefonts/unbounded) et [IBM Plex Mono](https://github.com/IBM/plex), sous licence SIL Open Font License.
