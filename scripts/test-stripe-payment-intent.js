require("dotenv").config();


const crypto =
    require("crypto");


const StripeService =
    require("../services/stripe.service");


(async () => {

    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        " TIOPTIOP — STRIPE 13.8.3"
    );
    console.log(
        " PAYMENT INTENT TEST"
    );
    console.log(
        "=============================================="
    );


    try {

        const testId =
            crypto.randomUUID();


        const orderReference =
            `TEST-${Date.now()}`;


        console.log("");
        console.log(
            "Création PaymentIntent Stripe TEST..."
        );


        /*
         * 6000 XAF fictifs.
         * Aucun débit bancaire.
         */
        const result =
            await StripeService
                .createPaymentIntent({

                    amount:
                        6000,

                    currency:
                        "XAF",

                    orderReference,

                    paymentPublicId:
                        testId
                });


        console.log("");
        console.log(
            "PaymentIntent créé : ✅"
        );

        console.log(
            "ID :",
            result.id
        );

        console.log(
            "Statut :",
            result.status
        );

        console.log(
            "Montant :",
            result.amount,
            result.currency.toUpperCase()
        );

        console.log(
            "livemode :",
            result.livemode
        );


        if (
            result.livemode === true
        ) {

            throw new Error(
                "ERREUR : paiement LIVE détecté."
            );
        }


        if (
            !String(result.id)
                .startsWith("pi_")
        ) {

            throw new Error(
                "Stripe n'a pas retourné de PaymentIntent valide."
            );
        }


        console.log("");
        console.log(
            "Aucune carte saisie."
        );

        console.log(
            "Aucun argent débité."
        );

        console.log("");
        console.log(
            "13.8.3 TEST A : OK ✅"
        );
        console.log("");


        process.exit(0);
    }
    catch (error) {

        console.error("");
        console.error(
            "❌ STRIPE 13.8.3"
        );

        console.error(
            "Message :",
            error.message
        );

        console.error(
            "Code :",
            error.code || "-"
        );

        console.error(
            "Type :",
            error.type || "-"
        );

        console.error("");


        process.exit(1);
    }

})();