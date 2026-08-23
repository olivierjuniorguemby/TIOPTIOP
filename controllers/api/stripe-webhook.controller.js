const StripeService =
    require("../../services/stripe.service");


const PaymentService =
    require("../../services/payment.service");


/* =========================================================
   STRIPE WEBHOOK CONTROLLER
   TIOPTIOP — 13.8.5

   IMPORTANT :
   req.body doit être un Buffer produit par express.raw().
========================================================= */

exports.handle =
async function (
    req,
    res
) {

    const signature =
        req.headers[
            "stripe-signature"
        ];


    let stripeEvent =
        null;


    try {

        /*
         * Vérifie cryptographiquement que la requête
         * provient bien de Stripe.
         */
        stripeEvent =
            StripeService
                .constructWebhookEvent(
                    req.body,
                    signature
                );
    }
    catch (error) {

        console.error(
            "[Stripe webhook] Signature invalide :",
            error.message
        );


        return res
            .status(400)
            .json({
                received:
                    false,

                error:
                    "INVALID_STRIPE_SIGNATURE"
            });
    }


    try {

        const result =
            await PaymentService
                .handleStripeWebhookEvent(
                    stripeEvent
                );


        if (
            result.duplicate
        ) {

            console.log(
                `[Stripe webhook] Doublon ignoré ${stripeEvent.id}`
            );
        }
        else if (
            result.ignored
        ) {

            console.log(
                `[Stripe webhook] Evénement ignoré ${stripeEvent.type} (${result.reason})`
            );
        }
        else {

            console.log(
                `[Stripe webhook] ${stripeEvent.type} traité (${stripeEvent.id})`
            );
        }


        /*
         * Stripe attend un 2xx rapidement.
         */
        return res.json({
            received:
                true,

            handled:
                Boolean(
                    result.handled
                ),

            duplicate:
                Boolean(
                    result.duplicate
                ),

            ignored:
                Boolean(
                    result.ignored
                )
        });
    }
    catch (error) {

        console.error(
            "[Stripe webhook] Erreur traitement :",
            error
        );


        /*
         * 500 => Stripe pourra retenter l'événement.
         */
        return res
            .status(500)
            .json({
                received:
                    true,

                processed:
                    false
            });
    }
};
