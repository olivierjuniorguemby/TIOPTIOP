# Base MySQL TiopTiop

1. Démarrez MySQL dans XAMPP.
2. Ouvrez `http://localhost/phpmyadmin`.
3. Importez `database/tioptiop.sql`.
4. Copiez `.env.example` en `.env`.
5. Lancez `npm run db:test`.

Configuration XAMPP par défaut :

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=tioptiop
```
