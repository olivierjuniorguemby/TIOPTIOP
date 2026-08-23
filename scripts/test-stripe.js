require("dotenv").config();


const StripeService =
    require(
        "../services/stripe.service"
    );


(async () => {

    console.log(
        ""
    );

    console.log(
        "=============================================="
    );

    console.log(
        " TIOPTIOP — STRIPE 13.8.2"
    );

    console.log(
        "=============================================="
    );


    try {

        console.log(
            "Test connexion Stripe..."
        );


        const result =
            await StripeService
                .testConnection();


        console.log(
            ""
        );

        console.log(
            "Connexion Stripe : ✅"
        );

        console.log(
            `Mode : ${result.environment.toUpperCase()}`
        );

        console.log(
            `Secret key : ${result.secretKey}`
        );

        console.log(
            `Publishable key : ${result.publishableKey}`
        );

        console.log(
            `Stripe livemode : ${result.livemode}`
        );


        if (
            result.livemode ===
            true
        ) {

            throw new Error(
                "SECURITE : Stripe indique livemode=true."
            );
        }


        console.log(
            ""
        );

        console.log(
            "Aucun paiement créé."
        );

        console.log(
            "Aucun argent débité."
        );

        console.log(
            ""
        );

        console.log(
            "13.8.2 : OK ✅"
        );

        console.log(
            ""
        );


        process.exit(
            0
        );
    }
    catch (error) {

        console.error(
            ""
        );

        console.error(
            "❌ STRIPE 13.8.2"
        );

        console.error(
            "Message :",
            error.message
        );


        if (
            error.code
        ) {

            console.error(
                "Code :",
                error.code
            );
        }


        if (
            error.type
        ) {

            console.error(
                "Stripe type :",
                error.type
            );
        }


        console.error(
            ""
        );


        process.exit(
            1
        );
    }

})();