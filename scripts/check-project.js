const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const jsFiles = [
  "app.js",
  "routes/client/index.routes.js",
  "routes/client/auth.routes.js",
  "routes/client/account.routes.js",
  "routes/client/career.routes.js",
  "routes/admin/index.routes.js",
  "routes/api/index.routes.js"
];

for (const file of jsFiles) {
  execFileSync(process.execPath, ["--check", path.join(root, file)], {
    stdio: "inherit"
  });
}

const views = [];
function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".ejs")) views.push(full);
  }
}
walk(path.join(root, "views"));

const pageFiles = views.filter((file) =>
  file.includes(`${path.sep}views${path.sep}client${path.sep}`) ||
  file.includes(`${path.sep}views${path.sep}admin${path.sep}`) ||
  file.includes(`${path.sep}views${path.sep}errors${path.sep}`)
);

for (const file of pageFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("include(")) {
    throw new Error(`Include interdit dans une page : ${file}`);
  }
}

const required = [
  "views/layouts/client.ejs",
  "views/layouts/admin.ejs",
  "views/partials/shared-messages.ejs",
  "views/partials/client/head.ejs",
  "views/partials/client/header.ejs",
  "views/partials/client/footer.ejs",
  "views/partials/admin/head.ejs",
  "views/partials/admin/header.ejs",
  "views/partials/admin/sidebar.ejs"
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Fichier obligatoire absent : ${file}`);
  }
}

console.log("Vérification du projet réussie.");
console.log("- Syntaxe JavaScript OK");
console.log("- Aucun include dans les pages EJS");
console.log("- Layouts et partials obligatoires présents");
