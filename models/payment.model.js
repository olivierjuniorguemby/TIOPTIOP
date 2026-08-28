const db =
    require("../config/database");


/* =========================================================
   PAYMENT MODEL
   TIOPTIOP — 13.8.6

   IMPORTANT :
   - db.query() de votre projet retourne directement rows/result.
   - connection.execute() retourne [rows/result, fields].
   - Les fonctions *InTransaction utilisent la connexion reçue
     pour rester dans la transaction de Order.createFromCart().
========================================================= */


const METHODS = Object.freeze({
    CASH: "CASH",
    CARD: "CARD",
    MOBILE_MONEY: "MOBILE_MONEY"
});


const STATUSES = Object.freeze({
    PENDING: "PENDING",
    AUTHORIZED: "AUTHORIZED",
    PAID: "PAID",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    PARTIAL: "PARTIAL",
    REFUNDED: "REFUNDED"
});


const PROVIDERS = Object.freeze({
    CASH: "TIOPTIOP_CASH",
    CARD: "CARD_SANDBOX",
    MOBILE_MONEY: "MTN_MOMO"
});


function normalizeMethod(value) {

    const method =
        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    if (
        !Object.values(METHODS)
            .includes(method)
    ) {

        throw new Error(
            "Moyen de paiement invalide."
        );
    }


    return method;
}


function normalizeStatus(value) {

    const status =
        String(
            value || ""
        )
            .trim()
            .toUpperCase();


    if (
        !Object.values(STATUSES)
            .includes(status)
    ) {

        throw new Error(
            "Statut de paiement invalide."
        );
    }


    return status;
}


function getDefaultProvider(method) {

    const normalized =
        normalizeMethod(
            method
        );


    return PROVIDERS[
        normalized
    ];
}


function normalizeAmount(value) {

    const amount =
        Number(
            value
        );


    if (
        !Number.isFinite(amount)
        ||
        amount < 0
    ) {

        throw new Error(
            "Montant de paiement invalide."
        );
    }


    return amount;
}


function serializePayload(payload) {

    if (
        payload === null
        ||
        payload === undefined
    ) {

        return null;
    }


    return JSON.stringify(
        payload
    );
}


/* =========================================================
   LECTURE
========================================================= */

async function findById(id) {

    const paymentId =
        Number(
            id
        );


    if (
        !Number.isInteger(paymentId)
        ||
        paymentId <= 0
    ) {

        return null;
    }


    const rows =
        await db.query(
            `
            SELECT *
            FROM payments
            WHERE id = ?
            LIMIT 1
            `,
            [
                paymentId
            ]
        );


    return rows[0] || null;
}


async function findByPublicId(publicId) {

    const value =
        String(
            publicId || ""
        ).trim();


    if (!value) {
        return null;
    }


    const rows =
        await db.query(
            `
            SELECT *
            FROM payments
            WHERE public_id = ?
            LIMIT 1
            `,
            [
                value
            ]
        );


    return rows[0] || null;
}


async function findLatestByOrderId(orderId) {

    const id =
        Number(
            orderId
        );


    if (
        !Number.isInteger(id)
        ||
        id <= 0
    ) {

        return null;
    }


    const rows =
        await db.query(
            `
            SELECT *
            FROM payments
            WHERE order_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                id
            ]
        );


    return rows[0] || null;
}

/* =========================================================
   RECHERCHE DU DERNIER PAIEMENT PAR REFERENCE COMMANDE

   Utilisé notamment par le callback MTN MoMo lorsque
   MTN fournit externalId (= référence de commande TiopTiop)
   mais pas directement provider_reference.
========================================================= */

async function findLatestByOrderReference(
    orderReference
) {

    const reference =
        String(
            orderReference || ""
        ).trim();


    if (!reference) {
        return null;
    }


    const rows =
        await db.query(
            `
            SELECT
                p.*
            FROM payments p
            INNER JOIN orders o
                ON o.id = p.order_id
            WHERE o.reference = ?
            ORDER BY p.id DESC
            LIMIT 1
            `,
            [
                reference
            ]
        );


    return rows[0] || null;
}

async function findAllByOrderId(orderId) {

    const id =
        Number(
            orderId
        );


    if (
        !Number.isInteger(id)
        ||
        id <= 0
    ) {

        return [];
    }


    const rows =
        await db.query(
            `
            SELECT *
            FROM payments
            WHERE order_id = ?
            ORDER BY id DESC
            `,
            [
                id
            ]
        );


    return Array.isArray(rows)
        ? rows
        : [];
}


async function findByProviderReference(
    providerReference
) {

    const reference =
        String(
            providerReference || ""
        ).trim();


    if (!reference) {
        return null;
    }


    const rows =
        await db.query(
            `
            SELECT *
            FROM payments
            WHERE provider_reference = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [
                reference
            ]
        );


    return rows[0] || null;
}


/* =========================================================
   CREATION DANS UNE TRANSACTION EXISTANTE
========================================================= */

async function createInTransaction(
    connection,
    {
        publicId,
        orderId,
        method,
        provider = null,
        status = STATUSES.PENDING,
        amount,
        currency = "XAF",
        providerReference = null
    }
) {

    if (
        !connection
        ||
        typeof connection.execute !==
            "function"
    ) {

        throw new Error(
            "Connexion SQL transactionnelle invalide."
        );
    }


    const normalizedMethod =
        normalizeMethod(
            method
        );


    const normalizedStatus =
        normalizeStatus(
            status
        );


    const normalizedAmount =
        normalizeAmount(
            amount
        );


    const finalProvider =
        provider
        ||
        getDefaultProvider(
            normalizedMethod
        );


    const [
        result
    ] =
        await connection.execute(
            `
            INSERT INTO payments
            (
                public_id,
                order_id,
                method,
                provider,
                status,
                amount,
                currency,
                provider_reference,
                paid_at
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                NULL
            )
            `,
            [
                publicId,
                orderId,
                normalizedMethod,
                finalProvider,
                normalizedStatus,
                normalizedAmount,
                currency,
                providerReference
            ]
        );


    return {
        id:
            result.insertId,

        publicId,

        orderId,

        method:
            normalizedMethod,

        provider:
            finalProvider,

        status:
            normalizedStatus,

        amount:
            normalizedAmount,

        currency,

        providerReference:
            providerReference || null
    };
}


/* =========================================================
   CREATION HORS TRANSACTION EXTERNE
========================================================= */

async function create(data) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const payment =
            await createInTransaction(
                connection,
                data
            );


        await connection.commit();


        return payment;
    }
    catch (error) {

        try {
            await connection.rollback();
        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback paiement :",
                rollbackError
            );
        }


        throw error;
    }
    finally {

        connection.release();
    }
}


/* =========================================================
   EVENEMENTS
========================================================= */

async function addEventInTransaction(
    connection,
    {
        paymentId,
        eventType,
        description = null,
        payload = null
    }
) {

    const type =
        String(
            eventType || ""
        )
            .trim()
            .slice(
                0,
                60
            );


    if (!type) {

        throw new Error(
            "Type d'événement de paiement obligatoire."
        );
    }


    const [
        result
    ] =
        await connection.execute(
            `
            INSERT INTO payment_events
            (
                payment_id,
                event_type,
                description,
                payload
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?
            )
            `,
            [
                paymentId,
                type,
                description || null,
                serializePayload(
                    payload
                )
            ]
        );


    return result.insertId;
}


async function addEvent(data) {

    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const id =
            await addEventInTransaction(
                connection,
                data
            );


        await connection.commit();


        return id;
    }
    catch (error) {

        try {
            await connection.rollback();
        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback événement paiement :",
                rollbackError
            );
        }


        throw error;
    }
    finally {

        connection.release();
    }
}


async function getEvents(paymentId) {

    const rows =
        await db.query(
            `
            SELECT *
            FROM payment_events
            WHERE payment_id = ?
            ORDER BY
                created_at ASC,
                id ASC
            `,
            [
                paymentId
            ]
        );


    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   UPDATE PROVIDER / REFERENCE
========================================================= */

async function setProvider({
    paymentId,
    provider,
    providerReference = null
}) {

    await db.query(
        `
        UPDATE payments
        SET
            provider = ?,
            provider_reference = ?
        WHERE id = ?
        `,
        [
            provider || null,
            providerReference || null,
            paymentId
        ]
    );


    return findById(
        paymentId
    );
}


/* =========================================================
   UPDATE STATUS
========================================================= */

async function updateStatus(
    paymentId,
    status
) {

    const normalizedStatus =
        normalizeStatus(
            status
        );


    await db.query(
        `
        UPDATE payments
        SET
            status = ?,
            paid_at =
                CASE
                    WHEN ? = 'PAID'
                    THEN COALESCE(
                        paid_at,
                        CURRENT_TIMESTAMP
                    )
                    ELSE paid_at
                END
        WHERE id = ?
        `,
        [
            normalizedStatus,
            normalizedStatus,
            paymentId
        ]
    );


    return findById(
        paymentId
    );
}


/* =========================================================
   PAIEMENTS MTN EN ATTENTE A RECONCILIER
========================================================= */

async function findPendingMtnMomo(
    limit = 50
) {

    const safeLimit =
        Math.min(
            200,
            Math.max(
                1,
                Number(limit) || 50
            )
        );


    const rows =
        await db.query(
            `
            SELECT
                p.*,
                o.reference AS order_reference
            FROM payments p
            INNER JOIN orders o
                ON o.id = p.order_id
            WHERE p.method = 'MOBILE_MONEY'
              AND p.provider = 'MTN_MOMO'
              AND p.status = 'PENDING'
              AND p.provider_reference IS NOT NULL
            ORDER BY p.id ASC
            LIMIT ${safeLimit}
            `
        );


    return Array.isArray(rows)
        ? rows
        : [];
}


/* =========================================================
   NOUVELLE TENTATIVE DE PAIEMENT
   Verrouille la commande pour empêcher un double retry.
========================================================= */

async function createRetryAttempt({
    orderId,
    publicId
}) {

    const id =
        Number(orderId);


    if (
        !Number.isInteger(id)
        ||
        id <= 0
    ) {

        throw new Error(
            "Commande invalide."
        );
    }


    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            orderRows
        ] =
            await connection.execute(
                `
                SELECT
                    id,
                    reference,
                    total_amount,
                    currency
                FROM orders
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    id
                ]
            );


        const order =
            orderRows[0]
            ||
            null;


        if (!order) {

            throw new Error(
                "Commande introuvable."
            );
        }


        const [
            paymentRows
        ] =
            await connection.execute(
                `
                SELECT *
                FROM payments
                WHERE order_id = ?
                ORDER BY id DESC
                LIMIT 1
                FOR UPDATE
                `,
                [
                    id
                ]
            );


        const latest =
            paymentRows[0]
            ||
            null;


        if (!latest) {

            throw new Error(
                "Paiement introuvable."
            );
        }


        if (
            latest.status ===
            STATUSES.PAID
        ) {

            const error =
                new Error(
                    "Cette commande est déjà payée."
                );

            error.code =
                "PAYMENT_ALREADY_PAID";

            throw error;
        }


        if (
            latest.status ===
            STATUSES.PENDING
        ) {

            const error =
                new Error(
                    "Un paiement est déjà en attente pour cette commande."
                );

            error.code =
                "PAYMENT_ALREADY_PENDING";

            throw error;
        }


        if (
            latest.method !==
            METHODS.MOBILE_MONEY
        ) {

            const error =
                new Error(
                    "La dernière tentative n'est pas un paiement Mobile Money."
                );

            error.code =
                "PAYMENT_RETRY_METHOD_INVALID";

            throw error;
        }


        const retryPayment =
            await createInTransaction(
                connection,
                {
                    publicId,
                    orderId:
                        id,

                    method:
                        METHODS.MOBILE_MONEY,

                    provider:
                        PROVIDERS.MOBILE_MONEY,

                    status:
                        STATUSES.PENDING,

                    amount:
                        latest.amount,

                    currency:
                        latest.currency
                        ||
                        order.currency
                        ||
                        "XAF",

                    providerReference:
                        null
                }
            );


        await addEventInTransaction(
            connection,
            {
                paymentId:
                    retryPayment.id,

                eventType:
                    "PAYMENT_RETRY_CREATED",

                description:
                    "Nouvelle tentative MTN MoMo créée après un paiement non abouti.",

                payload: {
                    previousPaymentId:
                        latest.id,

                    previousStatus:
                        latest.status
                }
            }
        );


        await connection.commit();


        return {
            payment:
                retryPayment,

            previousPayment:
                latest,

            order
        };
    }
    catch (error) {

        try {
            await connection.rollback();
        }
        catch (rollbackError) {
            console.error(
                "Erreur rollback retry paiement :",
                rollbackError
            );
        }


        throw error;
    }
    finally {

        connection.release();
    }
}


/* =========================================================
   ENCAISSEMENT ESPECES — 13.9.4.5.1
========================================================= */

async function collectCashPayment({
    paymentId,
    collectedBy = null,
    comment = null
}) {
    const id = Number(paymentId);

    if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Paiement espèces invalide.");
    }

    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [paymentRows] = await connection.execute(
            `
                SELECT *
                FROM payments
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
            `,
            [id]
        );

        const payment = paymentRows[0] || null;

        if (!payment) {
            const error = new Error("Paiement introuvable.");
            error.code = "PAYMENT_NOT_FOUND";
            throw error;
        }

        if (String(payment.method || "").toUpperCase() !== METHODS.CASH) {
            const error = new Error(
                "Ce paiement n'est pas un paiement en espèces."
            );
            error.code = "CASH_PAYMENT_METHOD_INVALID";
            throw error;
        }

        if (payment.status === STATUSES.PAID) {
            const error = new Error(
                "Ce paiement en espèces est déjà encaissé."
            );
            error.code = "CASH_PAYMENT_ALREADY_PAID";
            throw error;
        }

        if (payment.status !== STATUSES.PENDING) {
            const error = new Error(
                `Impossible d'encaisser un paiement espèces au statut ${payment.status}.`
            );
            error.code = "CASH_PAYMENT_STATUS_INVALID";
            throw error;
        }

        await connection.execute(
            `
                UPDATE payments
                SET
                    status = ?,
                    provider = COALESCE(provider, ?),
                    paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
                WHERE id = ?
            `,
            [
                STATUSES.PAID,
                PROVIDERS.CASH,
                id
            ]
        );

        await addEventInTransaction(connection, {
            paymentId: id,
            eventType: "CASH_PAYMENT_COLLECTED",
            description:
                "Paiement en espèces confirmé comme encaissé par l'administrateur.",
            payload: {
                previousStatus: payment.status,
                newStatus: STATUSES.PAID,
                amount: Number(payment.amount),
                currency: payment.currency || "XAF",
                collectedBy: collectedBy || null,
                comment: comment || null
            }
        });

        await connection.commit();

        return findById(id);
    }
    catch (error) {
        try {
            await connection.rollback();
        }
        catch (rollbackError) {
            console.error(
                "Erreur rollback encaissement espèces :",
                rollbackError
            );
        }

        throw error;
    }
    finally {
        connection.release();
    }
}


/* =========================================================
   STRIPE WEBHOOK — IDEMPOTENCE 13.8.5

   On ne modifie pas le schéma SQL.
   L'identifiant evt_... de Stripe est conservé dans payload.

   Si Stripe renvoie le même événement plusieurs fois,
   le backend peut l'ignorer sans refaire l'opération.
========================================================= */

async function hasProcessedStripeWebhookEvent(
    paymentId,
    stripeEventId
) {

    const id =
        Number(
            paymentId
        );


    const eventId =
        String(
            stripeEventId || ""
        ).trim();


    if (
        !Number.isInteger(id)
        ||
        id <= 0
        ||
        !eventId
    ) {

        return false;
    }


    const rows =
        await db.query(
            `
            SELECT
                id,
                payload
            FROM payment_events
            WHERE payment_id = ?
              AND event_type = 'STRIPE_WEBHOOK_RECEIVED'
            ORDER BY id DESC
            LIMIT 100
            `,
            [
                id
            ]
        );


    for (
        const row
        of (
            Array.isArray(rows)
                ? rows
                : []
        )
    ) {

        if (!row.payload) {
            continue;
        }


        try {

            const payload =
                typeof row.payload ===
                "string"

                    ? JSON.parse(
                        row.payload
                    )

                    : row.payload;


            if (
                String(
                    payload?.stripeEventId || ""
                ) ===
                eventId
            ) {

                return true;
            }
        }
        catch (_error) {

            /*
             * Un ancien payload non JSON ne doit pas
             * bloquer le traitement des nouveaux webhooks.
             */
        }
    }


    return false;
}


/* =========================================================
   STRIPE WEBHOOK — IDEMPOTENCE ATOMIQUE 13.8.6
========================================================= */

async function registerStripeWebhookEventOnce({
    paymentId,
    stripeEventId,
    stripeEventType,
    providerReference = null,
    stripeStatus = null,
    livemode = false
}) {

    const id = Number(paymentId);
    const eventId = String(stripeEventId || "").trim();
    const eventType = String(stripeEventType || "").trim();

    if (!Number.isInteger(id) || id <= 0 || !eventId || !eventType) {
        throw new Error("Données webhook Stripe invalides.");
    }

    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        const [paymentRows] = await connection.execute(
            `SELECT id FROM payments WHERE id = ? LIMIT 1 FOR UPDATE`,
            [id]
        );

        if (!paymentRows.length) {
            throw new Error("Paiement introuvable.");
        }

        const [rows] = await connection.execute(
            `SELECT id, payload
             FROM payment_events
             WHERE payment_id = ?
               AND event_type = 'STRIPE_WEBHOOK_RECEIVED'
             ORDER BY id DESC
             LIMIT 200`,
            [id]
        );

        for (const row of rows) {
            if (!row.payload) continue;
            try {
                const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
                if (String(payload?.stripeEventId || "") === eventId) {
                    await connection.commit();
                    return { registered:false, duplicate:true, eventRecordId:row.id };
                }
            } catch (_error) {}
        }

        const eventRecordId = await addEventInTransaction(connection, {
            paymentId:id,
            eventType:"STRIPE_WEBHOOK_RECEIVED",
            description:`Webhook Stripe ${eventType} reçu.`,
            payload:{
                stripeEventId:eventId,
                stripeEventType:eventType,
                providerReference:providerReference || null,
                stripeStatus:stripeStatus || null,
                livemode:Boolean(livemode)
            }
        });

        await connection.commit();
        return { registered:true, duplicate:false, eventRecordId };
    } catch (error) {
        try { await connection.rollback(); } catch (rollbackError) {
            console.error("Erreur rollback webhook Stripe :", rollbackError);
        }
        throw error;
    } finally {
        connection.release();
    }
}

async function findStripeContextByProviderReference(providerReference) {
    const reference = String(providerReference || "").trim();
    if (!reference) return null;

    const rows = await db.query(
        `SELECT p.*,
                o.reference AS order_reference,
                o.total_amount AS order_total_amount,
                o.currency AS order_currency,
                o.status AS order_status
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE p.provider_reference = ?
         ORDER BY p.id DESC
         LIMIT 1`,
        [reference]
    );

    return rows[0] || null;
}

async function findRecentStripeCardPayments(limit = 50) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const rows = await db.query(
        `SELECT p.*,
                o.reference AS order_reference,
                o.total_amount AS order_total_amount,
                o.currency AS order_currency,
                o.status AS order_status
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE p.method = 'CARD'
           AND p.provider = 'CARD_SANDBOX'
           AND p.provider_reference IS NOT NULL
         ORDER BY p.id DESC
         LIMIT ${safeLimit}`
    );
    return Array.isArray(rows) ? rows : [];
}


module.exports = {

    METHODS,
    STATUSES,
    PROVIDERS,

    normalizeMethod,
    normalizeStatus,
    getDefaultProvider,

    findById,
    findByPublicId,

    findLatestByOrderId,
    findLatestByOrderReference,
    findAllByOrderId,

    findByProviderReference,
    findPendingMtnMomo,

    create,
    createRetryAttempt,
    createInTransaction,

    addEvent,
    addEventInTransaction,
    getEvents,

    setProvider,
    updateStatus,
    collectCashPayment,

    hasProcessedStripeWebhookEvent,
    registerStripeWebhookEventOnce,
    findStripeContextByProviderReference,
    findRecentStripeCardPayments
};
