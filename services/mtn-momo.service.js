const crypto =
    require("crypto");


/* =========================================================
   MTN MOMO SERVICE
   TIOPTIOP — 13.7.4
========================================================= */


let cachedToken =
    null;


let cachedTokenExpiresAt =
    0;


/* =========================================================
   CONFIGURATION
========================================================= */

function getConfig() {

    const config = {

        environment:
            String(
                process.env.MTN_MOMO_ENVIRONMENT
                ||
                "sandbox"
            ).trim(),

        baseUrl:
            String(
                process.env.MTN_MOMO_BASE_URL
                ||
                "https://sandbox.momodeveloper.mtn.com"
            )
                .trim()
                .replace(
                    /\/+$/,
                    ""
                ),

        subscriptionKey:
            String(
                process.env.MTN_MOMO_SUBSCRIPTION_KEY
                ||
                ""
            ).trim(),

        apiUser:
            String(
                process.env.MTN_MOMO_API_USER
                ||
                ""
            ).trim(),

        apiKey:
            String(
                process.env.MTN_MOMO_API_KEY
                ||
                ""
            ).trim(),

        targetEnvironment:
            String(
                process.env.MTN_MOMO_TARGET_ENVIRONMENT
                ||
                "sandbox"
            ).trim(),

        callbackUrl:
            String(
                process.env.MTN_MOMO_CALLBACK_URL
                ||
                ""
            ).trim(),

        sandboxCurrency:
            String(
                process.env.MTN_MOMO_SANDBOX_CURRENCY
                ||
                "EUR"
            )
                .trim()
                .toUpperCase(),

        sandboxAmount:
            String(
                process.env.MTN_MOMO_SANDBOX_AMOUNT
                ||
                "100"
            ).trim(),

        timeoutMs:
            Math.max(
                3000,
                Number(
                    process.env.MTN_MOMO_TIMEOUT_MS
                    ||
                    15000
                )
            )
    };


    const missing = [];


    if (
        !config.subscriptionKey
    ) {

        missing.push(
            "MTN_MOMO_SUBSCRIPTION_KEY"
        );
    }


    if (
        !config.apiUser
    ) {

        missing.push(
            "MTN_MOMO_API_USER"
        );
    }


    if (
        !config.apiKey
    ) {

        missing.push(
            "MTN_MOMO_API_KEY"
        );
    }


    if (
        !config.callbackUrl
    ) {

        missing.push(
            "MTN_MOMO_CALLBACK_URL"
        );
    }


    if (
        missing.length
    ) {

        const error =
            new Error(
                "Configuration MTN MoMo incomplète : "
                +
                missing.join(
                    ", "
                )
            );


        error.code =
            "MTN_MOMO_CONFIG_MISSING";


        throw error;
    }


    return config;
}


/* =========================================================
   TIMEOUT
========================================================= */

function createSignal(
    timeoutMs
) {

    return AbortSignal.timeout(
        Math.max(
            1000,
            Number(
                timeoutMs
                ||
                15000
            )
        )
    );
}


/* =========================================================
   ERREUR HTTP
========================================================= */

async function createHttpError(
    response,
    fallbackMessage
) {

    let body =
        null;


    try {

        const contentType =
            String(
                response.headers.get(
                    "content-type"
                )
                ||
                ""
            );


        body =
            contentType.includes(
                "application/json"
            )

                ? await response.json()

                : await response.text();
    }
    catch (_error) {

        body =
            null;
    }


    const error =
        new Error(
            (
                body
                &&
                typeof body ===
                    "object"
                &&
                (
                    body.message
                    ||
                    body.reason
                )
            )
            ||
            fallbackMessage
            ||
            `MTN MoMo HTTP ${response.status}`
        );


    error.code =
        "MTN_MOMO_HTTP_ERROR";


    error.httpStatus =
        response.status;


    error.providerBody =
        body;


    return error;
}


/* =========================================================
   TOKEN
========================================================= */

async function getAccessToken({
    forceRefresh = false
} = {}) {

    const now =
        Date.now();


    if (
        !forceRefresh
        &&
        cachedToken
        &&
        cachedTokenExpiresAt >
            now + 30000
    ) {

        return cachedToken;
    }


    const config =
        getConfig();


    const basic =
        Buffer
            .from(
                `${config.apiUser}:${config.apiKey}`,
                "utf8"
            )
            .toString(
                "base64"
            );


    const response =
        await fetch(
            `${config.baseUrl}/collection/token/`,
            {
                method:
                    "POST",

                signal:
                    createSignal(
                        config.timeoutMs
                    ),

                headers: {

                    Authorization:
                        `Basic ${basic}`,

                    "Ocp-Apim-Subscription-Key":
                        config.subscriptionKey,

                    "Content-Length":
                        "0"
                }
            }
        );


    if (
        !response.ok
    ) {

        throw await createHttpError(
            response,
            "Impossible d'obtenir le token MTN MoMo."
        );
    }


    const data =
        await response.json();


    if (
        !data.access_token
    ) {

        const error =
            new Error(
                "MTN MoMo n'a pas retourné d'access_token."
            );


        error.code =
            "MTN_MOMO_TOKEN_INVALID";


        throw error;
    }


    cachedToken =
        data.access_token;


    const expiresIn =
        Number(
            data.expires_in
            ||
            3600
        );


    cachedTokenExpiresAt =
        now
        +
        (
            Number.isFinite(
                expiresIn
            )
                ? expiresIn
                : 3600
        )
        *
        1000;


    return cachedToken;
}


/* =========================================================
   NUMERO MOMO
========================================================= */

function normalizeMsisdn(
    value
) {

    const digits =
        String(
            value || ""
        )
            .replace(
                /\D/g,
                ""
            );


    if (
        digits.length < 8
        ||
        digits.length > 15
    ) {

        const error =
            new Error(
                "Numéro Mobile Money invalide."
            );


        error.code =
            "MTN_MOMO_INVALID_MSISDN";


        throw error;
    }


    return digits;
}


/* =========================================================
   UUID REQUEST TO PAY
========================================================= */

function createRequestReference() {

    return crypto.randomUUID();
}


/* =========================================================
   REQUEST TO PAY
========================================================= */

async function requestToPay({
    referenceId,
    externalId,
    payerMsisdn,
    payerMessage = "Paiement TiopTiop",
    payeeNote = "Commande TiopTiop"
}) {

    const config =
        getConfig();


    if (
        config.environment !==
        "sandbox"
    ) {

        const error =
            new Error(
                "13.7.4 est volontairement limité au Sandbox MTN MoMo."
            );


        error.code =
            "MTN_MOMO_PRODUCTION_DISABLED";


        throw error;
    }


    const token =
        await getAccessToken();


    const msisdn =
        normalizeMsisdn(
            payerMsisdn
        );


    const response =
        await fetch(
            `${config.baseUrl}/collection/v1_0/requesttopay`,
            {
                method:
                    "POST",

                signal:
                    createSignal(
                        config.timeoutMs
                    ),

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    "Ocp-Apim-Subscription-Key":
                        config.subscriptionKey,

                    "X-Target-Environment":
                        config.targetEnvironment,

                    "X-Reference-Id":
                        referenceId,

                    "X-Callback-Url":
                        config.callbackUrl,

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        amount:
                            config.sandboxAmount,

                        currency:
                            config.sandboxCurrency,

                        externalId:
                            String(
                                externalId
                            ),

                        payer: {

                            partyIdType:
                                "MSISDN",

                            partyId:
                                msisdn
                        },

                        payerMessage:
                            String(
                                payerMessage
                            )
                                .slice(
                                    0,
                                    160
                                ),

                        payeeNote:
                            String(
                                payeeNote
                            )
                                .slice(
                                    0,
                                    160
                                )
                    })
            }
        );


    if (
        response.status !==
        202
    ) {

        if (
            response.status ===
            401
        ) {

            cachedToken =
                null;


            cachedTokenExpiresAt =
                0;
        }


        throw await createHttpError(
            response,
            "RequestToPay MTN MoMo refusé."
        );
    }


    return {

        accepted:
            true,

        httpStatus:
            202,

        referenceId,

        externalId:
            String(
                externalId
            ),

        payerMsisdn:
            msisdn,

        sandboxAmount:
            config.sandboxAmount,

        sandboxCurrency:
            config.sandboxCurrency
    };
}


/* =========================================================
   STATUT REQUEST TO PAY
========================================================= */

async function getRequestToPayStatus(
    referenceId
) {

    const config =
        getConfig();


    const token =
        await getAccessToken();


    const response =
        await fetch(
            `${config.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`,
            {
                method:
                    "GET",

                signal:
                    createSignal(
                        config.timeoutMs
                    ),

                headers: {

                    Authorization:
                        `Bearer ${token}`,

                    "Ocp-Apim-Subscription-Key":
                        config.subscriptionKey,

                    "X-Target-Environment":
                        config.targetEnvironment
                }
            }
        );


    if (
        !response.ok
    ) {

        throw await createHttpError(
            response,
            "Impossible de vérifier le statut MTN MoMo."
        );
    }


    return response.json();
}


/* =========================================================
   TEST
========================================================= */

async function testConnection() {

    const token =
        await getAccessToken({
            forceRefresh:
                true
        });


    return {

        ok:
            Boolean(
                token
            ),

        tokenReceived:
            true
    };
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    getConfig,

    normalizeMsisdn,

    createRequestReference,

    getAccessToken,

    requestToPay,

    getRequestToPayStatus,

    testConnection
};
