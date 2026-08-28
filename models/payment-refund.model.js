const db = require("../config/database");

/* =========================================================
   PAYMENT REFUND MODEL
   TIOPTIOP — 13.9.4.3

   IMPORTANT :
   La création d'une demande est validée dans une transaction
   avec verrou FOR UPDATE sur le paiement afin d'éviter qu'une
   concurrence dépasse le montant remboursable.
========================================================= */

function normalizeId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeAmount(value) {
    const amount = Number(value);

    if (
        !Number.isFinite(amount)
        ||
        amount <= 0
    ) {
        const error = new Error("Montant de remboursement invalide.");
        error.code = "REFUND_AMOUNT_INVALID";
        throw error;
    }

    return Math.round(amount);
}

function serializePayload(payload) {
    if (payload === null || payload === undefined) {
        return null;
    }

    return JSON.stringify(payload);
}

async function listByPaymentId(paymentId) {
    const id = normalizeId(paymentId);
    if (!id) return [];

    const rows = await db.query(
        `
        SELECT
            pr.id,
            pr.public_id,
            pr.payment_id,
            pr.provider,
            pr.provider_reference,
            pr.refund_type,
            pr.status,
            pr.amount,
            pr.currency,
            pr.reason_code,
            pr.reason_text,
            pr.idempotency_key,
            pr.requested_by_admin_user_id,
            pr.provider_payload,
            pr.requested_at,
            pr.processed_at,
            pr.created_at,
            pr.updated_at,
            au.name AS requested_by_admin_name
        FROM payment_refunds pr
        LEFT JOIN admin_users au
            ON au.id = pr.requested_by_admin_user_id
        WHERE pr.payment_id = ?
        ORDER BY pr.created_at ASC, pr.id ASC
        `,
        [id]
    );

    return Array.isArray(rows) ? rows : [];
}

async function getSummaryByPaymentId(paymentId) {
    const id = normalizeId(paymentId);

    if (!id) {
        return {
            total_refunded: 0,
            total_pending: 0,
            succeeded_count: 0,
            pending_count: 0,
            failed_count: 0
        };
    }

    const rows = await db.query(
        `
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'SUCCEEDED'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_refunded,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'PENDING'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_pending,

            COALESCE(
                SUM(status = 'SUCCEEDED'),
                0
            ) AS succeeded_count,

            COALESCE(
                SUM(status = 'PENDING'),
                0
            ) AS pending_count,

            COALESCE(
                SUM(status = 'FAILED'),
                0
            ) AS failed_count

        FROM payment_refunds
        WHERE payment_id = ?
        `,
        [id]
    );

    return rows[0] || {
        total_refunded: 0,
        total_pending: 0,
        succeeded_count: 0,
        pending_count: 0,
        failed_count: 0
    };
}

async function findById(id) {
    const refundId = normalizeId(id);
    if (!refundId) return null;

    const rows = await db.query(
        `
        SELECT *
        FROM payment_refunds
        WHERE id = ?
        LIMIT 1
        `,
        [refundId]
    );

    return rows[0] || null;
}

async function findByIdempotencyKey(idempotencyKey) {
    const value = String(idempotencyKey || "").trim();

    if (!value) {
        return null;
    }

    const rows = await db.query(
        `
        SELECT *
        FROM payment_refunds
        WHERE idempotency_key = ?
        LIMIT 1
        `,
        [value]
    );

    return rows[0] || null;
}

/* =========================================================
   CREATION ATOMIQUE D'UNE DEMANDE
========================================================= */

async function createPendingValidated({
    publicId,
    paymentId,
    provider,
    refundType,
    amount,
    currency,
    reasonCode = null,
    reasonText = null,
    idempotencyKey,
    requestedByAdminUserId = null
}) {
    const id = normalizeId(paymentId);
    const normalizedAmount = normalizeAmount(amount);
    const normalizedPublicId = String(publicId || "").trim();
    const normalizedKey = String(idempotencyKey || "").trim();
    const normalizedProvider = String(provider || "").trim().slice(0, 80);
    const normalizedType = String(refundType || "").trim().toUpperCase();

    if (!id) {
        const error = new Error("Paiement invalide.");
        error.code = "REFUND_PAYMENT_INVALID";
        throw error;
    }

    if (!normalizedPublicId) {
        const error = new Error("Public ID du remboursement obligatoire.");
        error.code = "REFUND_PUBLIC_ID_REQUIRED";
        throw error;
    }

    if (!normalizedKey) {
        const error = new Error("Clé d'idempotence du remboursement obligatoire.");
        error.code = "REFUND_IDEMPOTENCY_REQUIRED";
        throw error;
    }

    if (!["FULL", "PARTIAL"].includes(normalizedType)) {
        const error = new Error("Type de remboursement invalide.");
        error.code = "REFUND_TYPE_INVALID";
        throw error;
    }

    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        /*
         * Verrou principal :
         * tous les remboursements d'un même paiement passent
         * séquentiellement par cette ligne.
         */
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
            error.code = "REFUND_PAYMENT_NOT_FOUND";
            throw error;
        }

        /*
         * Un double POST du même formulaire doit retrouver
         * la demande existante, pas en créer une seconde.
         */
        const [duplicateRows] = await connection.execute(
            `
            SELECT *
            FROM payment_refunds
            WHERE idempotency_key = ?
            LIMIT 1
            `,
            [normalizedKey]
        );

        if (duplicateRows.length) {
            await connection.commit();

            return {
                created: false,
                duplicate: true,
                refund: duplicateRows[0],
                payment
            };
        }

        if (!["PAID", "PARTIAL"].includes(String(payment.status || "").toUpperCase())) {
            const error = new Error(
                `Le paiement ${payment.status} n'est pas remboursable.`
            );
            error.code = "REFUND_PAYMENT_STATUS_INVALID";
            throw error;
        }

        const [summaryRows] = await connection.execute(
            `
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'SUCCEEDED'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_refunded,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'PENDING'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_pending

            FROM payment_refunds
            WHERE payment_id = ?
            `,
            [id]
        );

        const summary = summaryRows[0] || {};
        const totalRefunded = Number(summary.total_refunded || 0);
        const totalPending = Number(summary.total_pending || 0);
        const paymentAmount = Number(payment.amount || 0);

        const refundableAmount = Math.max(
            0,
            paymentAmount - totalRefunded - totalPending
        );

        if (normalizedAmount > refundableAmount) {
            const error = new Error(
                `Montant trop élevé. Maximum remboursable : ${refundableAmount} ${payment.currency}.`
            );
            error.code = "REFUND_AMOUNT_EXCEEDS_REMAINING";
            error.refundableAmount = refundableAmount;
            throw error;
        }

        if (
            normalizedType === "FULL"
            &&
            normalizedAmount !== Math.round(refundableAmount)
        ) {
            const error = new Error(
                "Un remboursement total doit correspondre exactement au montant restant."
            );
            error.code = "REFUND_FULL_AMOUNT_MISMATCH";
            throw error;
        }

        if (
            normalizedType === "PARTIAL"
            &&
            normalizedAmount >= refundableAmount
        ) {
            const error = new Error(
                "Pour rembourser tout le montant restant, choisissez le type TOTAL."
            );
            error.code = "REFUND_PARTIAL_AMOUNT_INVALID";
            throw error;
        }

        const [result] = await connection.execute(
            `
            INSERT INTO payment_refunds
            (
                public_id,
                payment_id,
                provider,
                provider_reference,
                refund_type,
                status,
                amount,
                currency,
                reason_code,
                reason_text,
                idempotency_key,
                requested_by_admin_user_id,
                provider_payload,
                requested_at,
                processed_at
            )
            VALUES
            (
                ?,
                ?,
                ?,
                NULL,
                ?,
                'PENDING',
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                NULL,
                CURRENT_TIMESTAMP,
                NULL
            )
            `,
            [
                normalizedPublicId,
                id,
                normalizedProvider || "STRIPE",
                normalizedType,
                normalizedAmount,
                String(currency || payment.currency || "XAF").toUpperCase(),
                reasonCode ? String(reasonCode).slice(0, 60) : null,
                reasonText ? String(reasonText).slice(0, 500) : null,
                normalizedKey,
                requestedByAdminUserId
                    ? Number(requestedByAdminUserId)
                    : null
            ]
        );

        const [refundRows] = await connection.execute(
            `
            SELECT *
            FROM payment_refunds
            WHERE id = ?
            LIMIT 1
            `,
            [result.insertId]
        );

        await connection.commit();

        return {
            created: true,
            duplicate: false,
            refund: refundRows[0],
            payment,
            refundableBefore: refundableAmount
        };
    }
    catch (error) {
        try {
            await connection.rollback();
        }
        catch (rollbackError) {
            console.error(
                "Erreur rollback création remboursement :",
                rollbackError
            );
        }

        /*
         * Dernier filet de sécurité pour l'index UNIQUE :
         * si deux INSERT identiques se rencontrent exactement,
         * on retourne la ligne déjà créée.
         */
        if (
            error
            &&
            error.code === "ER_DUP_ENTRY"
        ) {
            const existing = await findByIdempotencyKey(normalizedKey);

            if (existing) {
                return {
                    created: false,
                    duplicate: true,
                    refund: existing,
                    payment: null
                };
            }
        }

        throw error;
    }
    finally {
        connection.release();
    }
}

async function updateProviderResultAtomic({
    refundId,
    status,
    providerReference = null,
    providerPayload = null,
    processed = false,
    expectedCurrentStatus = null
}) {
    const id = normalizeId(refundId);

    if (!id) {
        const error = new Error("Remboursement invalide.");
        error.code = "REFUND_ID_INVALID";
        throw error;
    }

    const normalizedStatus = String(status || "").trim().toUpperCase();

    if (![
        "PENDING",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED"
    ].includes(normalizedStatus)) {
        const error = new Error("Statut remboursement invalide.");
        error.code = "REFUND_STATUS_INVALID";
        throw error;
    }

    const expected = expectedCurrentStatus
        ? String(expectedCurrentStatus).trim().toUpperCase()
        : null;

    const connection = await db.pool.getConnection();

    try {
        await connection.beginTransaction();

        /*
         * 13.9.5.2 — VERROU ATOMIQUE
         * Confirmation / annulation / résultat provider d'un même refund
         * sont sérialisés sur la ligne payment_refunds.
         */
        const [rows] = await connection.execute(
            `SELECT *
             FROM payment_refunds
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [id]
        );

        const current = rows[0] || null;

        if (!current) {
            const error = new Error("Remboursement introuvable.");
            error.code = "REFUND_NOT_FOUND";
            throw error;
        }

        const currentStatus = String(current.status || "").toUpperCase();

        /*
         * Si l'appelant exige PENDING et qu'un autre POST a déjà gagné,
         * on ne réécrit jamais l'état terminal.
         */
        if (expected && currentStatus !== expected) {
            await connection.commit();

            return {
                refund: current,
                updated: false,
                duplicate: currentStatus === normalizedStatus,
                conflict: currentStatus !== normalizedStatus,
                previousStatus: currentStatus
            };
        }

        if (currentStatus === normalizedStatus) {
            /*
             * 13.9.5.4 — idempotence enrichissante.
             * Un replay du même statut ne doit pas recréer l'opération,
             * mais il peut apporter une référence/payload provider qui
             * manquait après un timeout ou une reprise 13.9.5.3.
             *
             * Exemple : PENDING local créé avant l'appel Stripe, puis la
             * réponse Stripe PENDING arrive avec re_... : on conserve le
             * statut PENDING tout en enregistrant la vérité provider.
             */
            const hasMetadataToPersist =
                Boolean(providerReference)
                || providerPayload !== null && providerPayload !== undefined
                || Boolean(processed);

            if (hasMetadataToPersist) {
                await connection.execute(
                    `UPDATE payment_refunds
                     SET
                         provider_reference = COALESCE(?, provider_reference),
                         provider_payload = CASE
                             WHEN ? IS NULL THEN provider_payload
                             ELSE ?
                         END,
                         processed_at = CASE
                             WHEN ? THEN COALESCE(processed_at, CURRENT_TIMESTAMP)
                             ELSE processed_at
                         END
                     WHERE id = ?
                       AND status = ?`,
                    [
                        providerReference || null,
                        providerPayload === null || providerPayload === undefined
                            ? null
                            : 1,
                        serializePayload(providerPayload),
                        processed ? 1 : 0,
                        id,
                        currentStatus
                    ]
                );
            }

            const [sameStatusRows] = await connection.execute(
                `SELECT *
                 FROM payment_refunds
                 WHERE id = ?
                 LIMIT 1`,
                [id]
            );

            await connection.commit();

            return {
                refund: sameStatusRows[0] || current,
                updated: hasMetadataToPersist,
                duplicate: true,
                conflict: false,
                previousStatus: currentStatus
            };
        }

        /*
         * Une ligne terminale ne doit jamais revenir vers un autre état.
         */
        if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(currentStatus)) {
            await connection.commit();

            return {
                refund: current,
                updated: false,
                duplicate: false,
                conflict: true,
                previousStatus: currentStatus
            };
        }

        const [result] = await connection.execute(
            `UPDATE payment_refunds
             SET
                 status = ?,
                 provider_reference = COALESCE(?, provider_reference),
                 provider_payload = ?,
                 processed_at =
                    CASE
                        WHEN ?
                        THEN COALESCE(processed_at, CURRENT_TIMESTAMP)
                        ELSE processed_at
                    END
             WHERE id = ?
               AND status = ?`,
            [
                normalizedStatus,
                providerReference || null,
                serializePayload(providerPayload),
                processed ? 1 : 0,
                id,
                currentStatus
            ]
        );

        if (result.affectedRows !== 1) {
            const error = new Error(
                "Le remboursement a été modifié entre-temps. Rechargez la page."
            );
            error.code = "REFUND_STATUS_CONFLICT";
            throw error;
        }

        const [updatedRows] = await connection.execute(
            `SELECT *
             FROM payment_refunds
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        await connection.commit();

        return {
            refund: updatedRows[0] || current,
            updated: true,
            duplicate: false,
            conflict: false,
            previousStatus: currentStatus
        };
    }
    catch (error) {
        try {
            await connection.rollback();
        }
        catch (rollbackError) {
            console.error(
                "Erreur rollback statut remboursement :",
                rollbackError
            );
        }

        throw error;
    }
    finally {
        connection.release();
    }
}


async function updateProviderResult(data) {
    const result = await updateProviderResultAtomic(data);

    if (result.conflict) {
        const error = new Error(
            `Le remboursement a déjà été traité (${result.previousStatus}).`
        );
        error.code = "REFUND_STATUS_CONFLICT";
        error.currentStatus = result.previousStatus;
        throw error;
    }

    return result.refund;
}

/*
 * Compatibilité 13.9.4.x :
 * les services historiques attendent directement la ligne refund.
 * Ce wrapper conserve cette forme tout en utilisant le verrou 13.9.5.2.
 */
async function transitionProviderResult(data) {
    return updateProviderResultAtomic(data);
}


async function transitionPendingOnce({
    refundId,
    status,
    providerReference = null,
    providerPayload = null,
    processed = true
}) {
    const result = await updateProviderResultAtomic({
        refundId,
        status,
        providerReference,
        providerPayload,
        processed,
        expectedCurrentStatus: "PENDING"
    });

    return result;
}



/* =========================================================
   ESPACE CLIENT — 13.9.4.6

   Ces lectures sont volontairement limitées aux informations
   que le client peut voir. Aucune donnée technique sensible :
   - pas de provider_payload
   - pas d'idempotency_key
   - pas d'identifiant administrateur
========================================================= */

async function listClientByPaymentId(paymentId) {
    const id = normalizeId(paymentId);

    if (!id) {
        return [];
    }

    const rows = await db.query(
        `
        SELECT
            id,
            payment_id,
            refund_type,
            status,
            amount,
            currency,
            reason_code,
            reason_text,
            requested_at,
            processed_at,
            created_at,
            updated_at
        FROM payment_refunds
        WHERE payment_id = ?
        ORDER BY created_at ASC, id ASC
        `,
        [id]
    );

    return Array.isArray(rows)
        ? rows
        : [];
}


async function getClientSummaryByPaymentId(paymentId) {
    const id = normalizeId(paymentId);

    if (!id) {
        return {
            total_refunded: 0,
            total_pending: 0,
            total_failed: 0,
            total_cancelled: 0,
            refund_count: 0
        };
    }

    const rows = await db.query(
        `
        SELECT
            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'SUCCEEDED'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_refunded,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'PENDING'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_pending,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'FAILED'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_failed,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'CANCELLED'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS total_cancelled,

            COUNT(*) AS refund_count

        FROM payment_refunds
        WHERE payment_id = ?
        `,
        [id]
    );

    return rows[0] || {
        total_refunded: 0,
        total_pending: 0,
        total_failed: 0,
        total_cancelled: 0,
        refund_count: 0
    };
}


module.exports = {
    listByPaymentId,
    getSummaryByPaymentId,
    listClientByPaymentId,
    getClientSummaryByPaymentId,
    findById,
    findByIdempotencyKey,
    createPendingValidated,
    updateProviderResult,
    transitionProviderResult,
    transitionPendingOnce
};
