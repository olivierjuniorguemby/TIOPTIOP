const PaymentService =
    require("./payment.service");


/* =========================================================
   RECONCILIATION MTN MOMO
   TIOPTIOP — 13.7.4
========================================================= */


let timer =
    null;


let running =
    false;


/* =========================================================
   EXECUTION UNIQUE
========================================================= */

async function runOnce() {

    if (
        running
    ) {

        return {

            skipped:
                true,

            reason:
                "ALREADY_RUNNING"
        };
    }


    running =
        true;


    try {

        const result =
            await PaymentService
                .reconcilePendingMtnMomo({

                    limit:
                        Number(
                            process.env
                                .MTN_MOMO_RECONCILIATION_LIMIT
                            ||
                            50
                        )
                });


        if (
            result.checked >
            0
        ) {

            console.log(
                "[MTN MoMo] Réconciliation :",
                result
            );
        }


        return result;
    }
    finally {

        running =
            false;
    }
}


/* =========================================================
   DEMARRAGE AUTOMATIQUE
========================================================= */

function start() {

    const enabled =
        String(
            process.env
                .MTN_MOMO_RECONCILIATION_ENABLED
            ||
            "true"
        )
            .trim()
            .toLowerCase()
        !==
        "false";


    if (
        !enabled
    ) {

        console.log(
            "[MTN MoMo] Réconciliation automatique désactivée."
        );


        return;
    }


    if (
        timer
    ) {

        return;
    }


    const intervalMs =
        Math.max(
            15000,
            Number(
                process.env
                    .MTN_MOMO_RECONCILIATION_INTERVAL_MS
                ||
                60000
            )
        );


    const initialDelayMs =
        Math.max(
            3000,
            Number(
                process.env
                    .MTN_MOMO_RECONCILIATION_INITIAL_DELAY_MS
                ||
                10000
            )
        );


    const launch =
        async () => {

            try {

                await runOnce();
            }
            catch (error) {

                console.error(
                    "[MTN MoMo] Réconciliation :",
                    error
                );
            }
        };


    const startupTimer =
        setTimeout(
            () => {

                launch();


                timer =
                    setInterval(
                        launch,
                        intervalMs
                    );


                timer.unref?.();

            },
            initialDelayMs
        );


    startupTimer.unref?.();
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    start,

    runOnce
};
