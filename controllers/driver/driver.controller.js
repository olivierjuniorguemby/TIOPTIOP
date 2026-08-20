const Driver =
    require("../../models/driver.model");

const Delivery =
    require("../../models/delivery.model");

const Order =
    require("../../models/order.model");


/* =========================================================
   TIOPTIOP 13.6.2
   CONFIGURATION GPS ANTI-DERIVE RENFORCEE

   Principe :
   ---------------------------------------------------------
   1. Une position stable = ANCRE.
   2. Les petites oscillations GPS autour de cette ancre
      ne déplacent JAMAIS la moto.
   3. La zone d'immobilité dépend de la précision GPS.
   4. Un mouvement sans vitesse GPS fiable doit être
      confirmé par plusieurs points cohérents.
   5. Les candidats doivent progresser dans une direction
      cohérente.
   6. Un heartbeat conserve EXACTEMENT l'ancre.
   7. Aucun driver:location n'est émis pour une dérive.
========================================================= */

/* =========================================================
   CONFIGURATION GPS TIOPTIOP - VERSION 13.6.3

   Objectif :
   - moto stable lorsque le téléphone est immobile
   - petits déplacements réels détectés plus rapidement
   - fonctionnement intérieur / extérieur plus équilibré
   - pas besoin de marcher 10 à 15 mètres
========================================================= */

const GPS_CONFIG = {

    // Au-delà : position trop imprécise
    MAX_ACCURACY_METERS: 50,

    // Déplacement absolu minimum
    MIN_MOVEMENT_METERS: 2,

    // Rayon anti-dérive dynamique
    MIN_STATIONARY_RADIUS_METERS: 2.5,
    MAX_STATIONARY_RADIUS_METERS: 5,

    // On utilise seulement une partie de l'accuracy GPS
    // pour éviter qu'une accuracy de 10 m crée
    // une zone morte de 10 m.
    ACCURACY_RADIUS_FACTOR: 0.45,

    // À partir de 0.5 m/s (~1.8 km/h),
    // le téléphone indique clairement un mouvement.
    MOVING_SPEED_MPS: 0.5,

    // Sans vitesse GPS fiable :
    // deux points cohérents confirment le mouvement.
    REQUIRED_MOVING_POINTS: 2,

    // Un candidat suivant ne doit pas partir
    // complètement ailleurs.
    MAX_CANDIDATE_GAP_METERS: 15,

    // Tolérance permettant de reconnaître
    // une progression cohérente.
    MOVEMENT_PROGRESS_TOLERANCE_METERS: 2,

    // Heartbeat GPS
    MAX_SILENCE_MS: 15000,

    // Protection contre les téléportations GPS
    MAX_SPEED_KMH: 120
};

/* =========================================================
   RAYON ANTI-DERIVE DYNAMIQUE - 13.6.3

   Exemple :
   accuracy = 5 m
   5 × 0.45 = 2.25
   => minimum appliqué = 2.5 m

   accuracy = 8 m
   8 × 0.45 = 3.6 m
   => rayon = 3.6 m

   accuracy = 20 m
   20 × 0.45 = 9 m
   => maximum appliqué = 5 m

   Ainsi une mauvaise accuracy ne crée jamais
   une zone morte énorme.
========================================================= */

/*function getStationaryRadius(
    accuracy
) {

    if (
        !Number.isFinite(
            accuracy
        )
    ) {

        return GPS_CONFIG
            .MIN_STATIONARY_RADIUS_METERS;
    }


    const dynamicRadius =
        accuracy *
        GPS_CONFIG.ACCURACY_RADIUS_FACTOR;


    return Math.min(
        GPS_CONFIG.MAX_STATIONARY_RADIUS_METERS,

        Math.max(
            GPS_CONFIG.MIN_STATIONARY_RADIUS_METERS,
            dynamicRadius
        )
    );
}
*/

/* =========================================================
   MEMOIRE GPS SERVEUR

   Une entrée représente l'ANCRE actuellement visible
   par le client.

   Exemple :

   {
       latitude,
       longitude,
       heading,
       speedKmh,
       accuracy,
       timestamp,
       recordedAt,

       movementCandidates: []
   }

========================================================= */

const gpsStateByDelivery =
    new Map();


/* =========================================================
   ID LIVREUR
========================================================= */

function driverId(req) {

    return Number(
        req.session?.driver?.id
    );
}


/* =========================================================
   REFERENCE COMMANDE
========================================================= */

function getReference(req) {

    return String(
        req.params.reference || ""
    )
        .trim()
        .slice(
            0,
            60
        );
}


/* =========================================================
   CONVERSION NOMBRE
========================================================= */

function nullableNumber(value) {

    if (
        value === null
        ||
        value === undefined
        ||
        value === ""
    ) {

        return null;
    }


    const number =
        Number(
            value
        );


    return Number.isFinite(
        number
    )
        ? number
        : null;
}


/* =========================================================
   DISTANCE HAVERSINE
========================================================= */

function distanceMeters(
    lat1,
    lng1,
    lat2,
    lng2
) {

    const R =
        6371000;


    const toRad =
        value =>
            value *
            Math.PI /
            180;


    const dLat =
        toRad(
            lat2 - lat1
        );


    const dLng =
        toRad(
            lng2 - lng1
        );


    const a =
        Math.sin(
            dLat / 2
        ) ** 2
        +
        Math.cos(
            toRad(
                lat1
            )
        )
        *
        Math.cos(
            toRad(
                lat2
            )
        )
        *
        Math.sin(
            dLng / 2
        ) ** 2;


    return (
        2
        *
        R
        *
        Math.atan2(
            Math.sqrt(
                a
            ),
            Math.sqrt(
                1 - a
            )
        )
    );
}


/* =========================================================
   VALIDATION COORDONNEES
========================================================= */

function coordinatesAreValid(
    latitude,
    longitude
) {

    return (
        Number.isFinite(
            latitude
        )
        &&
        Number.isFinite(
            longitude
        )
        &&
        latitude >= -90
        &&
        latitude <= 90
        &&
        longitude >= -180
        &&
        longitude <= 180
    );
}


/* =========================================================
   CLE MEMOIRE GPS
========================================================= */

function gpsStateKey(
    currentDriverId,
    reference
) {

    return (
        String(
            currentDriverId
        )
        +
        ":"
        +
        String(
            reference
        )
    );
}


/* =========================================================
   RAYON D'IMMOBILITE DYNAMIQUE

   La précision GPS est importante.

   accuracy 4 m  -> rayon minimum 5 m
   accuracy 6 m  -> ~7.5 m
   accuracy 10 m -> ~12.5 m
   accuracy 20 m -> plafonné à 15 m
========================================================= */

function stationaryRadius(
    previous,
    current
) {

    const accuracies =
        [
            previous?.accuracy,
            current?.accuracy
        ]
            .map(
                value =>
                    Number(
                        value
                    )
            )
            .filter(
                value =>
                    Number.isFinite(
                        value
                    )
                    &&
                    value > 0
            );


    let accuracy =
        GPS_CONFIG
            .MIN_STATIONARY_RADIUS_METERS;


    if (
        accuracies.length
    ) {

        /*
         * On utilise la meilleure précision disponible
         * entre l'ancre et le point courant.
         */
        accuracy =
            Math.min(
                ...accuracies
            );
    }


    const calculated =
        accuracy
        *
        GPS_CONFIG
            .ACCURACY_RADIUS_FACTOR;


    return Math.max(
        GPS_CONFIG
            .MIN_STATIONARY_RADIUS_METERS,

        Math.min(
            calculated,

            GPS_CONFIG
                .MAX_STATIONARY_RADIUS_METERS
        )
    );
}


/* =========================================================
   CREATION CANDIDAT MOUVEMENT
========================================================= */

function createMovementCandidate(
    current,
    distanceFromAnchor
) {

    return {

        latitude:
            current.latitude,

        longitude:
            current.longitude,

        accuracy:
            current.accuracy,

        heading:
            current.heading,

        speedMps:
            current.speedMps,

        timestamp:
            current.timestamp,

        distanceFromAnchor
    };
}


/* =========================================================
   RESET CANDIDATS
========================================================= */

function clearMovementCandidates(
    state
) {

    if (!state) {
        return;
    }


    state.movementCandidates =
        [];
}


/* =========================================================
   VERIFICATION COHERENCE DES CANDIDATS

   On refuse notamment :

       ANCRE
         |
         | 8 m
         X candidat 1

       puis

       X candidat 2 complètement ailleurs

   Ce genre de dispersion est typique d'une dérive GPS.

   Pour un vrai déplacement :

       ANCRE -> P1 -> P2 -> P3

   les points doivent rester suffisamment proches
   les uns des autres et globalement s'éloigner de l'ancre.
========================================================= */

function candidateIsCoherent(
    previousCandidate,
    currentCandidate
) {

    if (
        !previousCandidate
    ) {

        return true;
    }


    const gap =
        distanceMeters(
            previousCandidate.latitude,
            previousCandidate.longitude,
            currentCandidate.latitude,
            currentCandidate.longitude
        );


    if (
        gap >
        GPS_CONFIG
            .MAX_CANDIDATE_GAP_METERS
    ) {

        return false;
    }


    /*
     * Le nouveau point peut légèrement revenir vers
     * l'ancre à cause du bruit GPS.
     *
     * Mais il ne doit pas revenir brutalement.
     */

    if (
        currentCandidate
            .distanceFromAnchor
        +
        GPS_CONFIG
            .MOVEMENT_PROGRESS_TOLERANCE_METERS
        <
        previousCandidate
            .distanceFromAnchor
    ) {

        return false;
    }


    return true;
}


/* =========================================================
   ANALYSE GPS 13.6.2
========================================================= */

function analyseGpsPoint(
    previous,
    current
) {

    /* -----------------------------------------------------
       1. Coordonnées invalides
    ----------------------------------------------------- */

    if (
        !coordinatesAreValid(
            current.latitude,
            current.longitude
        )
    ) {

        return {

            accepted:
                false,

            reason:
                "INVALID_COORDINATES",

            distanceMeters:
                null,

            calculatedSpeedKmh:
                null
        };
    }


    /* -----------------------------------------------------
       2. Mauvaise précision
    ----------------------------------------------------- */

    if (
        Number.isFinite(
            current.accuracy
        )
        &&
        current.accuracy >
        GPS_CONFIG
            .MAX_ACCURACY_METERS
    ) {

        return {

            accepted:
                false,

            reason:
                "BAD_ACCURACY",

            distanceMeters:
                null,

            calculatedSpeedKmh:
                null
        };
    }


    /* -----------------------------------------------------
       3. Premier point = création de l'ancre
    ----------------------------------------------------- */

    if (!previous) {

        return {

            accepted:
                true,

            heartbeat:
                false,

            reason:
                "FIRST_POINT",

            distanceMeters:
                0,

            calculatedSpeedKmh:
                0,

            resetCandidates:
                true
        };
    }


    /* -----------------------------------------------------
       4. Distance depuis L'ANCRE STABLE

       IMPORTANT :
       previous représente la dernière position réellement
       acceptée et visible par le client.
    ----------------------------------------------------- */

    const distance =
        distanceMeters(
            previous.latitude,
            previous.longitude,
            current.latitude,
            current.longitude
        );


    const elapsed =
        Math.max(
            0,
            current.timestamp -
            previous.timestamp
        );


    let calculatedSpeedKmh =
        0;


    if (
        elapsed > 0
    ) {

        calculatedSpeedKmh =
            (
                distance
                /
                (
                    elapsed /
                    1000
                )
            )
            *
            3.6;
    }


    /* -----------------------------------------------------
       5. Rayon anti-dérive dynamique
    ----------------------------------------------------- */

    const radius =
        stationaryRadius(
            previous,
            current
        );


    /*
     * On impose également MIN_MOVEMENT_METERS.
     */

    const effectiveRadius =
        Math.max(
            radius,
            GPS_CONFIG
                .MIN_MOVEMENT_METERS
        );


    /* -----------------------------------------------------
       6. Le téléphone indique-t-il un vrai déplacement ?
    ----------------------------------------------------- */

    const phoneSaysMoving =
        Number.isFinite(
            current.speedMps
        )
        &&
        current.speedMps >=
        GPS_CONFIG
            .MOVING_SPEED_MPS;


    /* -----------------------------------------------------
       7. Toujours dans la zone de l'ancre

       => IMMOBILE.

       On détruit les anciens candidats car le GPS vient
       de revenir près de l'ancre.
    ----------------------------------------------------- */

    if (
        distance <=
        effectiveRadius
        &&
        !phoneSaysMoving
    ) {

        clearMovementCandidates(
            previous
        );


        /*
         * Heartbeat :
         *
         * on écrit périodiquement en BDD,
         * mais avec EXACTEMENT les coordonnées de l'ancre.
         */

        if (
            elapsed >=
            GPS_CONFIG
                .MAX_SILENCE_MS
        ) {

            return {

                accepted:
                    true,

                heartbeat:
                    true,

                stationary:
                    true,

                reason:
                    "STATIONARY_HEARTBEAT",

                distanceMeters:
                    distance,

                stationaryRadiusMeters:
                    effectiveRadius,

                calculatedSpeedKmh:
                    0
            };
        }


        return {

            accepted:
                false,

            reason:
                "STATIONARY_NOISE",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh:
                0
        };
    }


    /* -----------------------------------------------------
       8. Protection contre téléportation GPS

       IMPORTANT :
       si elapsed est très petit et que la position saute,
       elle est refusée.
    ----------------------------------------------------- */

    if (
        elapsed > 0
        &&
        calculatedSpeedKmh >
        GPS_CONFIG
            .MAX_SPEED_KMH
    ) {

        clearMovementCandidates(
            previous
        );


        return {

            accepted:
                false,

            reason:
                "IMPOSSIBLE_SPEED",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh
        };
    }


    /* -----------------------------------------------------
       9. VITESSE GPS FIABLE

       Si le téléphone indique clairement que le livreur
       marche/roule, on peut accepter plus rapidement.

       MAIS il faut quand même être sorti du rayon d'ancre.
    ----------------------------------------------------- */

    if (
        phoneSaysMoving
        &&
        distance >
        effectiveRadius
    ) {

        clearMovementCandidates(
            previous
        );


        return {

            accepted:
                true,

            heartbeat:
                false,

            stationary:
                false,

            reason:
                "MOVEMENT_SPEED_CONFIRMED",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh
        };
    }


    /* -----------------------------------------------------
       10. PAS DE VITESSE FIABLE

       On demande plusieurs points cohérents avant
       de déplacer l'ancre.
    ----------------------------------------------------- */

    const candidate =
        createMovementCandidate(
            current,
            distance
        );


    const candidates =
        Array.isArray(
            previous.movementCandidates
        )

            ? previous.movementCandidates

            : [];


    const lastCandidate =
        candidates.length

            ? candidates[
                candidates.length - 1
            ]

            : null;


    /*
     * Si le candidat n'est pas cohérent avec le précédent,
     * on recommence la confirmation à zéro.
     */

    if (
        !candidateIsCoherent(
            lastCandidate,
            candidate
        )
    ) {

        previous.movementCandidates =
            [
                candidate
            ];


        return {

            accepted:
                false,

            reason:
                "MOVEMENT_CANDIDATE_RESET",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh,

            candidateCount:
                1
        };
    }


    candidates.push(
        candidate
    );


    /*
     * On ne garde pas une liste infinie.
     */

    while (
        candidates.length >
        GPS_CONFIG
            .REQUIRED_MOVING_POINTS
    ) {

        candidates.shift();
    }


    previous.movementCandidates =
        candidates;


    /* -----------------------------------------------------
       11. Pas encore assez de confirmations
    ----------------------------------------------------- */

    if (
        candidates.length <
        GPS_CONFIG
            .REQUIRED_MOVING_POINTS
    ) {

        return {

            accepted:
                false,

            reason:
                "MOVEMENT_CONFIRMATION",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh,

            candidateCount:
                candidates.length
        };
    }


    /* -----------------------------------------------------
       12. Vérification finale

       Tous les candidats doivent rester hors du rayon
       d'immobilité.

       Cela évite :

       10 m
       4 m
       11 m

       qui ressemble davantage à une oscillation GPS.
    ----------------------------------------------------- */

    const allOutsideAnchor =
        candidates.every(
            item =>
                item.distanceFromAnchor >
                effectiveRadius
        );


    if (
        !allOutsideAnchor
    ) {

        clearMovementCandidates(
            previous
        );


        return {

            accepted:
                false,

            reason:
                "MOVEMENT_NOT_COHERENT",

            distanceMeters:
                distance,

            stationaryRadiusMeters:
                effectiveRadius,

            calculatedSpeedKmh
        };
    }


    /*
     * Mouvement confirmé.
     *
     * Le point courant devient la nouvelle ancre.
     */

    clearMovementCandidates(
        previous
    );


    return {

        accepted:
            true,

        heartbeat:
            false,

        stationary:
            false,

        reason:
            "MOVEMENT_CONFIRMED",

        distanceMeters:
            distance,

        stationaryRadiusMeters:
            effectiveRadius,

        calculatedSpeedKmh,

        candidateCount:
            GPS_CONFIG
                .REQUIRED_MOVING_POINTS
    };
}


/* =========================================================
   DASHBOARD LIVREUR
========================================================= */

exports.dashboard =
async (
    req,
    res,
    next
) => {

    try {

        const id =
            driverId(
                req
            );


        const [
            stats,
            deliveries
        ] =
            await Promise.all([

                Driver.getDashboardStats(
                    id
                ),

                Delivery.findAllForDriver(
                    id
                )
            ]);


        return res.render(
            "driver/dashboard",
            {

                title:
                    "Espace livreur",

                layout:
                    "layouts/driver",

                driver:
                    req.driver,

                stats,

                deliveries
            }
        );
    }
    catch (
        error
    ) {

        return next(
            error
        );
    }
};


/* =========================================================
   DETAIL LIVRAISON
========================================================= */

exports.detail =
async (
    req,
    res,
    next
) => {

    try {

        const delivery =
            await Delivery
                .findForDriverByReference(
                    driverId(
                        req
                    ),
                    getReference(
                        req
                    )
                );


        if (
            !delivery
        ) {

            return res
                .status(
                    404
                )
                .send(
                    "Livraison introuvable."
                );
        }


        return res.render(
            "driver/delivery-detail",
            {

                title:
                    `Livraison ${delivery.order_reference}`,

                layout:
                    "layouts/driver",

                driver:
                    req.driver,

                delivery,

                success:
                    String(
                        req.query.success
                        ||
                        ""
                    ),

                error:
                    String(
                        req.query.error
                        ||
                        ""
                    )
            }
        );
    }
    catch (
        error
    ) {

        return next(
            error
        );
    }
};


/* =========================================================
   DISPONIBILITE LIVREUR
========================================================= */

exports.availability =
async (
    req,
    res,
    next
) => {

    try {

        const availability =
            String(
                req.body.availability
                ||
                ""
            )
                .trim()
                .toUpperCase();


        await Driver
            .updateAvailability(
                driverId(
                    req
                ),
                availability
            );


        req.session
            .driver
            .availability =
                availability;


        return req.session.save(
            error => {

                if (
                    error
                ) {

                    return next(
                        error
                    );
                }


                return res.redirect(
                    "/livreur"
                );
            }
        );
    }
    catch (
        error
    ) {

        return next(
            error
        );
    }
};


/* =========================================================
   ACCEPTER AFFECTATION
========================================================= */

exports.accept =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const result =
            await Delivery
                .acceptAssignment(
                    driverId(
                        req
                    ),
                    reference
                );


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            result.status,

                        acceptanceStatus:
                            result.acceptanceStatus,

                        message:
                            "Votre livreur a accepté la livraison."
                    }
                );
        }


        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Affectation acceptée`
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   REFUSER AFFECTATION
========================================================= */

exports.reject =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const result =
            await Delivery
                .rejectAssignment(
                    driverId(
                        req
                    ),
                    reference,
                    req.body.reason
                );


        gpsStateByDelivery.delete(
            gpsStateKey(
                driverId(
                    req
                ),
                reference
            )
        );


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            result.status,

                        acceptanceStatus:
                            result.acceptanceStatus,

                        message:
                            "L'affectation du livreur doit être réattribuée."
                    }
                );
        }


        return res.redirect(
            "/livreur"
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   COMMANDE RECUPEREE
========================================================= */

exports.pickup =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const result =
            await Delivery
                .markPickedUp(
                    driverId(
                        req
                    ),
                    reference
                );


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            result.status,

                        message:
                            "Le livreur a récupéré votre commande."
                    }
                );
        }


        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Commande récupérée`
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   DEMARRER LIVRAISON
========================================================= */

exports.start =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const delivery =
            await Delivery
                .findForDriverByReference(
                    driverId(
                        req
                    ),
                    reference
                );


        if (
            !delivery
        ) {

            throw new Error(
                "Livraison introuvable."
            );
        }


        if (
            delivery.status !==
            "PICKED_UP"
        ) {

            throw new Error(
                "Vous devez d'abord récupérer la commande."
            );
        }


        const result =
            await Order
                .updateStatus({

                    reference,

                    nextStatus:
                        "ON_THE_WAY",

                    comment:
                        "Le livreur a quitté le restaurant.",

                    adminUserId:
                        null
                });


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "order:status",
                    {

                        reference,

                        previousStatus:
                            result.previousStatus,

                        status:
                            result.status,

                        statusLabel:
                            result.statusLabel,

                        comment:
                            result.comment,

                        changedAt:
                            result.changedAt
                    }
                );


            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            "ON_THE_WAY",

                        message:
                            "Votre livreur est en route."
                    }
                );
        }


        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Livraison démarrée`
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   LIVREUR ARRIVE
========================================================= */

exports.arrived =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const result =
            await Delivery
                .markArrived(
                    driverId(
                        req
                    ),
                    reference
                );


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            result.status,

                        message:
                            "Le livreur est arrivé à destination."
                    }
                );
        }


        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Arrivée confirmée`
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   LIVRAISON TERMINEE
========================================================= */

exports.delivered =
async (
    req,
    res
) => {

    const reference =
        getReference(
            req
        );


    try {

        const delivery =
            await Delivery
                .findForDriverByReference(
                    driverId(
                        req
                    ),
                    reference
                );


        if (
            !delivery
        ) {

            throw new Error(
                "Livraison introuvable."
            );
        }


        if (
            ![
                "ON_THE_WAY",
                "ARRIVED"
            ].includes(
                delivery.status
            )
        ) {

            throw new Error(
                "La livraison ne peut pas encore être finalisée."
            );
        }


        const result =
            await Order
                .updateStatus({

                    reference,

                    nextStatus:
                        "DELIVERED",

                    comment:
                        "Livraison confirmée par le livreur.",

                    adminUserId:
                        null
                });


        await Delivery
            .releaseDriver(
                driverId(
                    req
                )
            );


        gpsStateByDelivery.delete(
            gpsStateKey(
                driverId(
                    req
                ),
                reference
            )
        );


        const io =
            req.app.get(
                "io"
            );


        if (
            io
        ) {

            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "order:status",
                    {

                        reference,

                        previousStatus:
                            result.previousStatus,

                        status:
                            result.status,

                        statusLabel:
                            result.statusLabel,

                        comment:
                            result.comment,

                        changedAt:
                            result.changedAt
                    }
                );


            io
                .to(
                    `order:${reference}`
                )
                .emit(
                    "delivery:status",
                    {

                        reference,

                        status:
                            "DELIVERED",

                        message:
                            "Votre commande a été livrée."
                    }
                );
        }


        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?success=Livraison terminée`
        );
    }
    catch (
        error
    ) {

        return res.redirect(
            `/livreur/livraisons/${encodeURIComponent(reference)}?error=${encodeURIComponent(error.message)}`
        );
    }
};


/* =========================================================
   GPS REEL LIVREUR
   VERSION 13.6.3

   POST /livreur/livraisons/:reference/position
========================================================= */

exports.position =
async function (
    req,
    res
) {

    const reference =
        getReference(
            req
        );


    const currentDriverId =
        driverId(
            req
        );


    try {

        /* =================================================
           DONNEES DU TELEPHONE
        ================================================= */

        const latitude =
            nullableNumber(
                req.body.latitude
            );


        const longitude =
            nullableNumber(
                req.body.longitude
            );


        const accuracy =
            nullableNumber(
                req.body.accuracy_meters
            );


        const heading =
            nullableNumber(
                req.body.heading
            );


        const phoneSpeedMps =
            nullableNumber(
                req.body.speed_mps
            );


        const now =
            Date.now();


        const stateKey =
            gpsStateKey(
                currentDriverId,
                reference
            );


        let previous =
            gpsStateByDelivery.get(
                stateKey
            )
            ||
            null;


        const current = {

            latitude,

            longitude,

            accuracy,

            heading,

            speedMps:
                phoneSpeedMps,

            timestamp:
                now
        };


        /* =================================================
           ANALYSE 13.6.2
        ================================================= */

        const analysis =
            analyseGpsPoint(
                previous,
                current
            );


        /*
         * Les candidats sont stockés directement
         * dans previous.
         *
         * On remet donc l'état dans la Map même lorsque
         * le point est filtré.
         */

        if (
            previous
        ) {

            gpsStateByDelivery.set(
                stateKey,
                previous
            );
        }


        /* =================================================
           POINT REFUSE

           IMPORTANT :
           - aucune écriture BDD ;
           - aucun driver:location ;
           - aucune modification de l'ancre ;
           - la moto reste EXACTEMENT au même endroit.
        ================================================= */

        if (
            !analysis.accepted
        ) {

            let message =
                "Position GPS ignorée.";


            switch (
                analysis.reason
            ) {

                case "STATIONARY_NOISE":

                    message =
                        "Dérive GPS ignorée : livreur immobile.";

                    break;


                case "MOVEMENT_CONFIRMATION":

                    message =
                        `Déplacement en confirmation (${analysis.candidateCount || 0}/${GPS_CONFIG.REQUIRED_MOVING_POINTS}).`;

                    break;


                case "MOVEMENT_CANDIDATE_RESET":

                    message =
                        "Mouvement GPS incohérent : confirmation recommencée.";

                    break;


                case "MOVEMENT_NOT_COHERENT":

                    message =
                        "Mouvement GPS non cohérent ignoré.";

                    break;


                case "BAD_ACCURACY":

                    message =
                        "Position GPS trop imprécise.";

                    break;


                case "IMPOSSIBLE_SPEED":

                    message =
                        "Saut GPS incohérent ignoré.";

                    break;


                case "INVALID_COORDINATES":

                    message =
                        "Coordonnées GPS invalides.";

                    break;
            }


            return res
                .status(
                    200
                )
                .json({

                    ok:
                        true,

                    inserted:
                        false,

                    filtered:
                        true,

                    filterReason:
                        analysis.reason,

                    message,

                    distanceMeters:
                        analysis.distanceMeters,

                    stationaryRadiusMeters:
                        analysis.stationaryRadiusMeters
                        ??
                        null,

                    calculatedSpeedKmh:
                        analysis.calculatedSpeedKmh,

                    candidateCount:
                        analysis.candidateCount
                        ??
                        (
                            previous
                            &&
                            Array.isArray(
                                previous.movementCandidates
                            )

                                ? previous
                                    .movementCandidates
                                    .length

                                : 0
                        ),

                    point:
                        previous

                            ? {

                                latitude:
                                    previous.latitude,

                                longitude:
                                    previous.longitude,

                                heading:
                                    previous.heading,

                                speedKmh:
                                    previous.speedKmh,

                                accuracyMeters:
                                    previous.accuracy,

                                recordedAt:
                                    previous.recordedAt
                            }

                            : null
                });
        }


        /* =================================================
           COORDONNEES A STOCKER

           HEARTBEAT :
           on conserve EXACTEMENT l'ancre précédente.

           MOUVEMENT :
           le nouveau point devient la nouvelle ancre.
        ================================================= */

        const isHeartbeat =
            Boolean(
                analysis.heartbeat
            );


        const latitudeToStore =
            isHeartbeat
            &&
            previous

                ? previous.latitude

                : latitude;


        const longitudeToStore =
            isHeartbeat
            &&
            previous

                ? previous.longitude

                : longitude;


        const headingToStore =
            isHeartbeat
            &&
            previous

                ? previous.heading

                : heading;


        let speedMpsToStore =
            isHeartbeat

                ? 0

                : phoneSpeedMps;


        /*
         * Élimination des vitesses fantômes très faibles.
         */

        if (
            analysis.calculatedSpeedKmh !==
                null
            &&
            analysis.calculatedSpeedKmh <
                2
        ) {

            speedMpsToStore =
                0;
        }


        /* =================================================
           ENREGISTREMENT BDD
        ================================================= */

        const result =
            await Delivery
                .recordTrackingPoint({

                    driverId:
                        currentDriverId,

                    reference,

                    latitude:
                        latitudeToStore,

                    longitude:
                        longitudeToStore,

                    heading:
                        headingToStore,

                    speedMps:
                        speedMpsToStore,

                    accuracyMeters:
                        accuracy
                });


        /* =================================================
           NOUVELLE ANCRE

           Seulement si MySQL a réellement accepté le point.
        ================================================= */

        if (
            result.inserted
        ) {

            const oldCandidates =
                previous
                &&
                Array.isArray(
                    previous.movementCandidates
                )

                    ? previous.movementCandidates

                    : [];


            gpsStateByDelivery.set(
                stateKey,
                {

                    latitude:
                        Number(
                            result.latitude
                        ),

                    longitude:
                        Number(
                            result.longitude
                        ),

                    heading:
                        result.heading !== null
                        &&
                        result.heading !== undefined

                            ? Number(
                                result.heading
                            )

                            : null,

                    speedKmh:
                        result.speedKmh !== null
                        &&
                        result.speedKmh !== undefined

                            ? Number(
                                result.speedKmh
                            )

                            : 0,

                    accuracy:
                        result.accuracyMeters !== null
                        &&
                        result.accuracyMeters !== undefined

                            ? Number(
                                result.accuracyMeters
                            )

                            : accuracy,

                    timestamp:
                        now,

                    recordedAt:
                        result.recordedAt,

                    /*
                     * Une fois accepté, on repart avec
                     * zéro candidat.
                     */
                    movementCandidates:
                        []
                }
            );
        }


        /* =================================================
           SOCKET.IO

           Point filtré :
               AUCUN EVENT.

           Point accepté :
               driver:location.

           Heartbeat :
               mêmes coordonnées que l'ancre précédente.
               Donc même si l'événement est reçu,
               la moto ne bouge pas.
        ================================================= */

        if (
            result.inserted
        ) {

            const io =
                req.app.get(
                    "io"
                );


            if (
                io
            ) {

                io
                    .to(
                        `order:${reference}`
                    )
                    .emit(
                        "driver:location",
                        {

                            orderId:
                                reference,

                            reference,

                            deliveryId:
                                result.deliveryId,

                            lat:
                                Number(
                                    result.latitude
                                ),

                            lng:
                                Number(
                                    result.longitude
                                ),

                            heading:
                                result.heading,

                            speedKmh:
                                isHeartbeat
                                    ? 0
                                    : result.speedKmh,

                            accuracyMeters:
                                result.accuracyMeters,

                            recordedAt:
                                result.recordedAt,

                            gpsFiltered:
                                true,

                            gpsVersion:
                                "13.6.3",

                            gpsReason:
                                analysis.reason,

                            stationary:
                                isHeartbeat
                        }
                    );
            }
        }


        /* =================================================
           REPONSE TELEPHONE
        ================================================= */

        return res
            .status(
                result.inserted
                    ? 201
                    : 200
            )
            .json({

                ok:
                    true,

                inserted:
                    result.inserted,

                filtered:
                    false,

                heartbeat:
                    isHeartbeat,

                stationary:
                    isHeartbeat,

                gpsVersion:
                    "13.6.3",

                filterReason:
                    analysis.reason,

                distanceMeters:
                    analysis.distanceMeters,

                stationaryRadiusMeters:
                    analysis.stationaryRadiusMeters
                    ??
                    null,

                calculatedSpeedKmh:
                    analysis.calculatedSpeedKmh,

                rateLimited:
                    result.rateLimited,

                point: {

                    latitude:
                        result.latitude,

                    longitude:
                        result.longitude,

                    heading:
                        result.heading,

                    speedKmh:
                        isHeartbeat
                            ? 0
                            : result.speedKmh,

                    accuracyMeters:
                        result.accuracyMeters,

                    recordedAt:
                        result.recordedAt
                }
            });
    }
    catch (
        error
    ) {

        console.error(
            "Erreur GPS livreur 13.6.3 :",
            error
        );


        const businessCodes =
            [

                "GPS_INVALID_COORDINATES",

                "GPS_DELIVERY_NOT_FOUND",

                "GPS_DELIVERY_NOT_ACCEPTED",

                "GPS_DELIVERY_NOT_ACTIVE"
            ];


        return res
            .status(
                businessCodes.includes(
                    error.code
                )

                    ? 400

                    : 500
            )
            .json({

                ok:
                    false,

                message:
                    error.message
                    ||
                    "Impossible d'enregistrer la position."
            });
    }
};