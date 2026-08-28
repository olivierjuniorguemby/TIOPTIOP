require("dotenv").config();

const Reconciliation = require("../services/payment-reconciliation.service");

(async () => {
    try {
        console.log("============================================================");
        console.log("TIOPTIOP — 13.9.5.3 — RECONCILIATION PAIEMENTS");
        console.log("============================================================");
        const result = await Reconciliation.runOnce();
        console.dir(result, {depth: 5});
        const errors =
            Number(result?.mtn?.errors || 0)
            + Number(result?.stripe?.errors || 0)
            + Number(result?.stripeRefunds?.errors || 0);

        const warnings =
            Number(result?.mtn?.notFound || 0);

        console.log("------------------------------------------------------------");
        console.log(`Erreurs critiques : ${errors}`);
        console.log(`Avertissements    : ${warnings}`);

        if (errors === 0) {
            console.log("✅ Réconciliation critique validée.");
        }

        if (warnings > 0) {
            console.log(
                "⚠️ Références MTN introuvables côté provider : elles restent PENDING et nécessitent un contrôle manuel / nettoyage des anciennes données Sandbox."
            );
        }

        process.exitCode = errors > 0 ? 2 : 0;
    } catch (error) {
        console.error("ERREUR RECONCILIATION:", error);
        process.exitCode = 1;
    }
})();
