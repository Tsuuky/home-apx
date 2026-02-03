# Conso Chauffage — Description

Ce logiciel suit la consommation de granulés et le stock associé, tout en croisant ces données avec les DJU
(degrés-jours unifiés) pour mesurer l’efficacité du chauffage.

## Fonctionnalités principales

- **Gestion des saisons** : création d’une saison de chauffe, suivi d’une saison active et clôture en fin de période.
- **Relevés quotidiens** : enregistrement et modification des consommations journalières (en kg ou en sacs).
- **Suivi du stock** : point de départ (stock initial), livraisons, corrections d’inventaire, et stock courant.
- **Tableau de bord** : synthèse des indicateurs clés (kg consommés, DJU cumulés, kg/DJU).

## Architecture

- **API (Node/Express + Prisma)** : expose les endpoints pour les saisons, les relevés et le stock.
- **Front-end (React)** : interface pour saisir les données et visualiser les indicateurs.

## Flux de travail rapide

1. Créer une saison de chauffe dans l’onglet **Saisons**.
2. Enregistrer des relevés quotidiens (kg ou sacs) au fil des jours.
3. Saisir les livraisons et ajuster le stock si nécessaire dans l’onglet **Stock**.
4. Suivre l’évolution des indicateurs dans le **Dashboard**.
