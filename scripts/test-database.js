require("dotenv").config();
const { testConnection } = require("../config/database");

testConnection()
  .then(() => {
    console.log("Connexion MySQL OK");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Connexion MySQL impossible :", error.message);
    process.exit(1);
  });
