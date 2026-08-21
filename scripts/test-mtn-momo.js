require("dotenv").config();
const MtnMomo = require("../services/mtn-momo.service");

(async () => {
    try {
        console.log("Test connexion MTN MoMo Sandbox...");
        const result = await MtnMomo.testConnection();
        console.log("✅ Token MTN MoMo obtenu :", result.tokenReceived);
        process.exit(0);
    } catch (error) {
        console.error("❌ MTN MoMo :", {
            message: error.message,
            code: error.code,
            httpStatus: error.httpStatus,
            providerBody: error.providerBody
        });
        process.exit(1);
    }
})();
