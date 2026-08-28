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




/* =========================================================
   13.9.5.1 — TRANSITIONS DE STATUT SECURISEES
========================================================= */

const PAYMENT_STATUS_TRANSITIONS = Object.freeze({

    PENDING: Object.freeze([
        STATUSES.AUTHORIZED,
        STATUSES.PAID,
        STATUSES.FAILED,
        STATUSES.CANCELLED
    ]),

    AUTHORIZED: Object.freeze([
        STATUSES.PAID,
        STATUSES.FAILED,
        STATUSES.CANCELLED
    ]),

    /*
     * Un provider peut parfois confirmer tardivement un paiement
     * que l'application avait classé FAILED/CANCELLED.
     * On autorise donc PAID comme état de réconciliation finale.
     */
    FAILED: Object.freeze([
        STATUSES.PENDING,
        STATUSES.PAID,
        STATUSES.CANCELLED
    ]),

    CANCELLED: Object.freeze([
        STATUSES.PAID
    ]),

    /*
     * Après encaissement réel, seules les transitions financières
     * de remboursement sont permises.
     */
    PAID: Object.freeze([
        STATUSES.PARTIAL,
        STATUSES.REFUNDED
    ]),

    PARTIAL: Object.freeze([
        STATUSES.REFUNDED
    ]),

    REFUNDED: Object.freeze([])
});


function getAllowedPaymentNextStatuses(currentStatus) {

    const current =
        normalizeStatus(
            currentStatus
        );


    return Array.isArray(
        PAYMENT_STATUS_TRANSITIONS[current]
    )
        ? [
            ...PAYMENT_STATUS_TRANSITIONS[current]
        ]
        : [];
}


function canTransitionPaymentStatus(
    currentStatus,
    nextStatus
) {

    const current =
        normalizeStatus(
            currentStatus
        );


    const next =
        normalizeStatus(
            nextStatus
        );


    if (
        current ===
        next
    ) {
        return true;
    }


    return getAllowedPaymentNextStatuses(
        current
    ).includes(
        next
    );
}


function assertPaymentStatusTransition(
    currentStatus,
    nextStatus
) {

    const current =
        normalizeStatus(
            currentStatus
        );


    const next =
        normalizeStatus(
            nextStatus
        );


    if (
        !canTransitionPaymentStatus(
            current,
            next
        )
    ) {

        const error =
            new Error(
                `Transition paiement interdite : ${current} → ${next}.`
            );

        error.code =
            "PAYMENT_STATUS_INVALID_TRANSITION";

        error.currentStatus =
            current;

        error.nextStatus =
            next;

        throw error;
    }


    return true;
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

    const id =
        Number(
            paymentId
        );


    if (
        !Number.isInteger(id)
        ||
        id <= 0
    ) {

        const error =
            new Error(
                "Paiement invalide."
            );

        error.code =
            "PAYMENT_ID_INVALID";

        throw error;
    }


    const normalizedStatus =
        normalizeStatus(
            status
        );


    const connection =
        await db.pool.getConnection();


    try {

        await connection.beginTransaction();


        const [
            rows
        ] =
            await connection.execute(
                `
                SELECT *
                FROM payments
                WHERE id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [
                    id
                ]
            );


        const payment =
            rows[0]
            ||
            null;


        if (!payment) {

            const error =
                new Error(
                    "Paiement introuvable."
                );

            error.code =
                "PAYMENT_NOT_FOUND";

            throw error;
        }


        const currentStatus =
            normalizeStatus(
                payment.status
            );


        if (
            currentStatus ===
            normalizedStatus
        ) {

            await connection.commit();

            return payment;
        }


        assertPaymentStatusTransition(
            currentStatus,
            normalizedStatus
        );


        const [
            result
        ] =
            await connection.execute(
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
                  AND status = ?
                `,
                [
                    normalizedStatus,
                    normalizedStatus,
                    id,
                    currentStatus
                ]
            );


        if (
            result.affectedRows !== 1
        ) {

            const error =
                new Error(
                    "Le paiement a été modifié entre-temps. Rechargez la page."
                );

            error.code =
                "PAYMENT_STATUS_CONFLICT";

            throw error;
        }


        await connection.commit();


        return findById(
            id
        );
    }
    catch (error) {

        try {
            await connection.rollback();
        }
        catch (rollbackError) {

            console.error(
                "Erreur rollback statut paiement :",
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
    receivedAmount = null,
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
            /*
             * 13.9.5.2 — IDEMPOTENCE CASH
             * Un double clic / double POST attend ici à cause du FOR UPDATE.
             * Le premier appel a déjà encaissé le paiement ; le second
             * retourne donc un succès idempotent SANS recréer d'événement.
             */
            await connection.commit();

            return {
                payment,
                duplicate: true
            };
        }

        if (payment.status !== STATUSES.PENDING) {
            const error = new Error(
                `Impossible d'encaisser un paiement espèces au statut ${payment.status}.`
            );
            error.code = "CASH_PAYMENT_STATUS_INVALID";
            throw error;
        }

        const expectedAmount = Number(payment.amount || 0);
        const received = Number(receivedAmount);

        if (!Number.isFinite(received) || received < 0) {
            const error = new Error("Le montant reçu en espèces est invalide.");
            error.code = "CASH_RECEIVED_AMOUNT_INVALID";
            throw error;
        }

        if (received < expectedAmount) {
            const error = new Error(
                `Montant insuffisant : ${received.toLocaleString("fr-FR")} ${payment.currency || "XAF"} reçu(s) pour ${expectedAmount.toLocaleString("fr-FR")} ${payment.currency || "XAF"} attendu(s).`
            );
            error.code = "CASH_RECEIVED_AMOUNT_INSUFFICIENT";
            throw error;
        }

        const changeAmount = Number((received - expectedAmount).toFixed(2));
        const collectorId = Number(collectedBy);
        const safeCollectorId = Number.isInteger(collectorId) && collectorId > 0
            ? collectorId
            : null;

        await connection.execute(
            `
                UPDATE payments
                SET
                    status = ?,
                    provider = COALESCE(provider, ?),
                    collected_by_admin_user_id = ?,
                    cash_received_amount = ?,
                    cash_change_amount = ?,
                    paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
                WHERE id = ?
            `,
            [
                STATUSES.PAID,
                PROVIDERS.CASH,
                safeCollectorId,
                received,
                changeAmount,
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
                amount: expectedAmount,
                receivedAmount: received,
                changeAmount,
                currency: payment.currency || "XAF",
                collectedBy: safeCollectorId,
                comment: String(comment || "").trim().slice(0, 500) || null
            }
        });

        await connection.commit();

        return {
            payment: await findById(id),
            duplicate: false
        };
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
    PAYMENT_STATUS_TRANSITIONS,
    getAllowedPaymentNextStatuses,
    canTransitionPaymentStatus,
    assertPaymentStatusTransition,

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
