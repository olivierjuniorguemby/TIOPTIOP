# TiopTiop Starter Layouts v2

Cette version remplace les includes dispersés par `express-ejs-layouts`.

## Pourquoi elle corrige l'erreur EJS

Les pages comme :

- `views/client/home.ejs`
- `views/client/auth/login.ejs`
- `views/admin/dashboard.ejs`

ne contiennent **aucun `include()`**.

Seuls ces deux fichiers composent la structure générale :

- `views/layouts/client.ejs`
- `views/layouts/admin.ejs`

Les chemins d'inclusion y sont relatifs et fixes :

```ejs
<%- include("../partials/client/head", { title }) %>
```

Le contenu de la page est injecté par :

```ejs
<%- body %>
```

Il n'est donc plus nécessaire de calculer `../` ou `../../` selon l'emplacement d'une page.

## Installation

```powershell
npm install
Copy-Item .env.example .env
npm run check
npm run db:test
npm start
```

Adresses :

- Client : `http://localhost:3000`
- Administration : `http://localhost:3000/admin`
- API : `http://localhost:3000/api/v1/health`

## Comptes de démonstration

Client :

```text
celestin@tioptiop.cg
demo1234
```

Admin :

```text
admin@tioptiop.cg
admin1234
```

L'authentification admin est volontairement simplifiée dans ce starter. Elle devra ensuite utiliser `admin_users`, bcrypt et les rôles MySQL.

## Migration de Signature 2.4.4

Pour chaque ancienne page :

1. Identifiez uniquement le contenu situé à l'intérieur de `<main>`.
2. Copiez ce contenu dans le fichier EJS correspondant.
3. Ne copiez pas `<html>`, `<head>`, `<body>`, le header ou le footer.
4. Ne mettez aucun `include()` dans la page.
5. Placez les CSS dans `public/css`.
6. Placez les scripts dans `public/js`.
7. Placez les images et icônes dans `public/media`.
8. Remplacez progressivement les données JavaScript par celles des contrôleurs/services/MySQL.

## Test intégré

```powershell
npm run check
```

Ce test vérifie :

- la syntaxe Node.js ;
- la présence des layouts et partials ;
- l'absence d'include EJS dans les pages.
