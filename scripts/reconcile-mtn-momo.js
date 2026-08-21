require("dotenv").config();

const reconciliation =
    require("../services/payment-reconciliation.service");


(async () => {

    try {

        const result =
            await reconciliation.runOnce();


        console.log(
            "Réconciliation MTN MoMo terminée :",
            result
        );


        process.exit(0);
    }
    catch (error) {

        console.error(
            "Erreur réconciliation MTN MoMo :",
            error
        );


        process.exit(1);
    }
})();
