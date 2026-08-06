document.addEventListener("DOMContentLoaded", function () {

    const mapElement = document.getElementById("trackingMap");

    if (!mapElement) return;


    /* ==========================================
       COORDONNÉES DE DÉMONSTRATION BRAZZAVILLE
    ========================================== */

    const restaurant = {
        lat: -4.2634,
        lng: 15.2429
    };

    const client = {
        lat: -4.2505,
        lng: 15.2650
    };

    let driverPosition = {
        lat: -4.2585,
        lng: 15.2505
    };


    /* ==========================================
       CRÉATION CARTE
    ========================================== */

    const map = L.map("trackingMap", {
        zoomControl: true
    }).setView(
        [driverPosition.lat, driverPosition.lng],
        14
    );


    /* ==========================================
       OPEN STREET MAP
    ========================================== */

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap"
        }
    ).addTo(map);


    /* ==========================================
       RESTAURANT
    ========================================== */

    const restaurantIcon = L.divIcon({
        className: "tiop-driver-marker",
        html: `
            <div class="tiop-driver-icon">
                🍽️
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    const restaurantMarker = L.marker(
        [restaurant.lat, restaurant.lng],
        { icon: restaurantIcon }
    )
    .addTo(map)
    .bindPopup("<strong>TiopTiop</strong><br>Restaurant");


    /* ==========================================
       CLIENT
    ========================================== */

    const clientIcon = L.divIcon({
        className: "tiop-driver-marker",
        html: `
            <div class="tiop-driver-icon">
                🏠
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    const clientMarker = L.marker(
        [client.lat, client.lng],
        { icon: clientIcon }
    )
    .addTo(map)
    .bindPopup("<strong>Destination</strong><br>Adresse client");


    /* ==========================================
       LIVREUR
    ========================================== */

    const driverIcon = L.divIcon({
        className: "tiop-driver-marker",
        html: `
            <div class="tiop-driver-icon">
                🛵
            </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
    });

    const driverMarker = L.marker(
        [driverPosition.lat, driverPosition.lng],
        {
            icon: driverIcon,
            zIndexOffset: 1000
        }
    )
    .addTo(map)
    .bindPopup(
        "<strong>Junior</strong><br>Votre livreur"
    );


    /* ==========================================
       TRAJET
    ========================================== */

    const route = L.polyline(
        [
            [restaurant.lat, restaurant.lng],
            [driverPosition.lat, driverPosition.lng],
            [client.lat, client.lng]
        ],
        {
            weight: 5,
            opacity: .8
        }
    ).addTo(map);


    /* Afficher tout le trajet */

    const group = L.featureGroup([
        restaurantMarker,
        clientMarker,
        driverMarker,
        route
    ]);

    map.fitBounds(
        group.getBounds().pad(0.20)
    );


    /* ==========================================
       SOCKET.IO
    ========================================== */

    if (typeof io !== "undefined") {

        const socket = io();

        const orderId = "TIOP-38651";

        socket.emit(
            "order:join",
            orderId
        );


        socket.on(
            "driver:location",
            function (data) {

                if (!data) return;

                if (
                    data.orderId !== orderId ||
                    typeof data.lat !== "number" ||
                    typeof data.lng !== "number"
                ) {
                    return;
                }

                updateDriverPosition(
                    data.lat,
                    data.lng
                );
            }
        );
    }


    /* ==========================================
       DÉPLACEMENT DU LIVREUR
    ========================================== */

    function updateDriverPosition(lat, lng) {

        driverPosition.lat = lat;
        driverPosition.lng = lng;

        driverMarker.setLatLng([
            lat,
            lng
        ]);

        route.setLatLngs([
            [restaurant.lat, restaurant.lng],
            [lat, lng],
            [client.lat, client.lng]
        ]);

        document.getElementById(
            "gpsStatus"
        ).textContent = "Position GPS mise à jour";
    }


    /* ==========================================
       SIMULATION STATUT COMMANDE
    ========================================== */

    let currentStep = 1;

    const nextButton =
        document.getElementById("nextTrackingStep");

    if (nextButton) {

        nextButton.addEventListener(
            "click",
            function () {

                if (currentStep >= 6) return;

                currentStep++;

                updateTrackingSteps(currentStep);
            }
        );
    }


    function updateTrackingSteps(step) {

        document
            .querySelectorAll(".tracking-step")
            .forEach(function (element) {

                const elementStep =
                    Number(element.dataset.step);

                element.classList.remove(
                    "active",
                    "completed"
                );

                if (elementStep < step) {
                    element.classList.add("completed");
                }

                if (elementStep === step) {
                    element.classList.add("active");

                    const small =
                        element.querySelector("small");

                    if (small) {
                        small.textContent =
                            "Étape actuelle";
                    }
                }
            });
    }

});