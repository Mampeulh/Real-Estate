# Real Estate Backend (mock, stockage en mémoire)

Mock API REST pour la **gestion de biens immobiliers** : propriétés, lots,
locataires, baux et loyers. Node.js/Express, documentation Swagger UI,
aucune base de données.

Les données de démo sont chargées au démarrage. Toute création, modification
ou suppression vit tant que le process tourne ; un redémarrage remet les
données de démo.

## Démarrage

```bash
npm install
npm run dev     # rechargement automatique (nodemon)
# ou
npm start
```

- API : `http://localhost:3000/api/v1`
- Swagger UI : `http://localhost:3000/api-docs` (la racine `/` y redirige)
- Spec brute : `http://localhost:3000/api-docs.json`
- Santé : `http://localhost:3000/health`

Le port se règle avec la variable d'environnement `PORT`.

## Modèle de données

```
Property (immeuble) 1──n Unit (lot) 1──n Lease (bail) n──1 Tenant (locataire)
                                        Lease 1──n RentPayment (loyer)
```

| Ressource | Endpoints |
|-----------|-----------|
| Propriétés | `GET/POST /properties`, `GET/PUT/DELETE /properties/:propertyId` |
| Lots d'une propriété | `GET /properties/:propertyId/units` |
| Synthèse d'une propriété | `GET /properties/:propertyId/summary` |
| Lots | `GET/POST /units`, `GET/PUT/DELETE /units/:unitId` |
| Locataires | `GET/POST /tenants`, `GET/PUT/DELETE /tenants/:tenantId` |
| Baux | `GET/POST /leases`, `GET/PUT/DELETE /leases/:leaseId` |
| Loyers d'un bail | `GET /leases/:leaseId/payments` |
| Loyers | `GET/POST /payments`, `GET/PUT/DELETE /payments/:paymentId` |

Les listes sont paginées (`page`, `pageSize`) et filtrables :
`type` et `city` (propriétés), `propertyId`, `status`, `type` (lots),
`type` (locataires), `unitId`, `tenantId`, `status` (baux),
`leaseId`, `status`, `period=YYYY-MM` (loyers).

`PUT` accepte des mises à jour partielles : seuls les champs envoyés changent.

## Règles métier simulées

- **Occupation** : créer un bail actif passe le lot à `occupied` ; quand plus aucun bail actif ne subsiste, le lot redevient `vacant` (un lot en `renovation` n'est pas modifié).
- **Un seul bail actif par lot** : sinon `409 CONFLICT`.
- **Statut de bail** déduit des dates si `status` n'est pas fourni (`upcoming`, `active`, `terminated`).
- **Statut de loyer** déduit des montants si `status` n'est pas fourni : `paid`, `partial`, `late` (échéance dépassée) ou `pending`.
- **Une échéance par bail et par période** (`period`), sinon `409`.
- **Référence de lot unique** dans une propriété, sinon `409`.
- **Suppressions** : supprimer une propriété, un lot ou un bail supprime en cascade ses lots, baux et loyers. Un locataire avec un bail actif ne peut pas être supprimé (`409`).
- **Synthèse** (`/summary`) : taux d'occupation, loyers + charges mensuels des baux actifs, montant impayé, nombre d'échéances en retard.

## Exemples

```bash
# Synthèse de la résidence de démo
curl http://localhost:3000/api/v1/properties/prop_001/summary

# Lots vacants
curl "http://localhost:3000/api/v1/units?status=vacant"

# Créer un bail sur le studio A-201 (le lot passe à "occupied")
curl -X POST http://localhost:3000/api/v1/leases \
  -H "Content-Type: application/json" \
  -d '{"unitId":"unit_004","tenantId":"ten_001","startDate":"2026-10-01","monthlyRent":520,"charges":40,"deposit":520}'

# Loyers en retard
curl "http://localhost:3000/api/v1/payments?status=late"

# Enregistrer le paiement complet d'un loyer
curl -X PUT http://localhost:3000/api/v1/payments/<paymentId> \
  -H "Content-Type: application/json" \
  -d '{"amountPaid":910}'
```

## Données de démo

2 propriétés (Marseille, Lyon), 7 lots, 4 locataires, 5 baux (dont 1 terminé)
et 16 loyers de juillet à octobre 2026, avec quelques retards et un paiement
partiel pour illustrer la synthèse.

## Déploiement sur Render

`render.yaml` décrit un service web Node.js, sans base de données.

1. Pousser le projet sur GitHub.
2. Sur [render.com](https://render.com) : **New > Blueprint**, sélectionner le dépôt.
3. Ajouter l'URL publique dans `servers` de `src/docs/openapi.yaml` pour que le "Try it out" de Swagger UI l'utilise.

Sur le plan gratuit, le service se met en veille après inactivité ; le
redémarrage réinitialise les données en mémoire.

## Structure

```
src/
  server.js              # Express, Swagger UI, health
  routes/index.js        # routes CRUD + routes imbriquées
  resources.js           # champs, validations et règles métier par ressource
  crud.js                # fabrique de handlers CRUD
  domain.js              # cascades, statuts dérivés, synthèse
  store.js               # données de démo en mémoire
  middleware/errorHandler.js
  docs/openapi.yaml      # spec OpenAPI servie par Swagger UI
```
