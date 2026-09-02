document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* =====================================================
           ELEMENTS
        ===================================================== */

        const form =
            document.getElementById(
                "checkoutForm"
            );


        const restaurantSelect =
            document.getElementById(
                "restaurantId"
            );


        const deliverySection =
            document.getElementById(
                "deliverySection"
            );


        const addressSelect =
            document.getElementById(
                "deliveryAddressId"
            );


        const addressPreview =
            document.getElementById(
                "addressPreview"
            );


        const zoneSelect =
            document.getElementById(
                "deliveryZoneId"
            );


        const zoneInfo =
            document.getElementById(
                "deliveryZoneInfo"
            );


        const subtotalElement =
            document.getElementById(
                "checkoutSubtotal"
            );


        const deliveryFeeElement =
            document.getElementById(
                "checkoutDeliveryFee"
            );


        const totalElement =
            document.getElementById(
                "checkoutTotal"
            );


        const warningElement =
            document.getElementById(
                "minimumOrderWarning"
            );


        const submitButton =
            document.getElementById(
                "checkoutSubmit"
            );


        const currency =
            window.TIOP_CHECKOUT?.currency
            ||
            "XAF";

        const loyaltyRadios = document.querySelectorAll('input[name="loyalty_redemption_public_id"]');
        const loyaltySummaryRow = document.getElementById('loyaltySummaryRow');
        const loyaltySummaryLabel = document.getElementById('loyaltySummaryLabel');
        const loyaltySummaryAmount = document.getElementById('loyaltySummaryAmount');


        const subtotal =
            Number(
                subtotalElement?.dataset.subtotal
                ||
                0
            );


        /* =====================================================
           MONEY
        ===================================================== */

        function money(value) {

            return (
                Number(value || 0)
                    .toLocaleString(
                        "fr-FR",
                        {
                            maximumFractionDigits:
                                2
                        }
                    )
                +
                " "
                +
                currency
            );
        }


        /* =====================================================
           ORDER TYPE
        ===================================================== */

        function getOrderType() {

            return (
                document.querySelector(
                    'input[name="order_type"]:checked'
                )
                ?.value
                ||
                "DELIVERY"
            );
        }


        /* =====================================================
           RESTAURANT SUPPORT
        ===================================================== */

        function updateRestaurantCapabilities() {

            const selected =
                restaurantSelect
                    ?.selectedOptions?.[0];


            if (!selected) {
                return;
            }


            const capabilities = {

                DELIVERY:
                    Number(
                        selected.dataset
                            .supportsDelivery
                    ) === 1,

                PICKUP:
                    Number(
                        selected.dataset
                            .supportsPickup
                    ) === 1,

                DINE_IN:
                    Number(
                        selected.dataset
                            .supportsDineIn
                    ) === 1
            };


            document
                .querySelectorAll(
                    "[data-order-type-card]"
                )
                .forEach(
                    card => {

                        const type =
                            card.dataset
                                .orderTypeCard;


                        const input =
                            card.querySelector(
                                "input"
                            );


                        const supported =
                            capabilities[type]
                            !== false;


                        input.disabled =
                            !supported;


                        card.classList.toggle(
                            "disabled",
                            !supported
                        );
                    }
                );


            /*
             * Si le mode sélectionné devient
             * indisponible, on choisit le premier
             * mode disponible.
             */

            const checked =
                document.querySelector(
                    'input[name="order_type"]:checked'
                );


            if (
                checked &&
                checked.disabled
            ) {

                const firstAvailable =
                    document.querySelector(
                        'input[name="order_type"]:not(:disabled)'
                    );


                if (firstAvailable) {

                    firstAvailable.checked =
                        true;
                }
            }


            refreshOrderTypeCards();
            updateDeliveryVisibility();
        }


        /* =====================================================
           STYLE ORDER TYPES
        ===================================================== */

        function refreshOrderTypeCards() {

            document
                .querySelectorAll(
                    "[data-order-type-card]"
                )
                .forEach(
                    card => {

                        const input =
                            card.querySelector(
                                "input"
                            );


                        card.classList.toggle(
                            "active",
                            Boolean(
                                input?.checked
                            )
                        );
                    }
                );
        }


        /* =====================================================
           SHOW / HIDE DELIVERY
        ===================================================== */

        function updateDeliveryVisibility() {

            const isDelivery =
                getOrderType()
                ===
                "DELIVERY";


            if (deliverySection) {

                deliverySection.style.display =
                    isDelivery
                        ? ""
                        : "none";
            }


            if (addressSelect) {

                addressSelect.required =
                    isDelivery;
            }


            if (zoneSelect) {

                zoneSelect.required =
                    isDelivery;
            }


            updateTotals();
        }


        /* =====================================================
           ADDRESS PREVIEW
        ===================================================== */

        function updateAddressPreview() {

            if (
                !addressSelect ||
                !addressPreview
            ) {

                return;
            }


            const option =
                addressSelect
                    .selectedOptions?.[0];


            if (
                !option ||
                !option.value
            ) {

                addressPreview.innerHTML =
                    "";

                addressPreview.classList
                    .remove(
                        "visible"
                    );

                return;
            }


            const lines =
                [];


            const recipient =
                option.dataset.recipient;


            const phone =
                option.dataset.phone;


            const address1 =
                option.dataset.address1;


            const address2 =
                option.dataset.address2;


            const district =
                option.dataset.district;


            const city =
                option.dataset.city;


            const instructions =
                option.dataset.instructions;


            if (recipient) {

                lines.push(
                    `<strong>${escapeHtml(recipient)}</strong>`
                );
            }


            if (address1) {

                lines.push(
                    escapeHtml(address1)
                );
            }


            if (address2) {

                lines.push(
                    escapeHtml(address2)
                );
            }


            const locality =
                [
                    district,
                    city
                ]
                    .filter(Boolean)
                    .join(" · ");


            if (locality) {

                lines.push(
                    escapeHtml(locality)
                );
            }


            if (phone) {

                lines.push(
                    `📞 ${escapeHtml(phone)}`
                );
            }


            if (instructions) {

                lines.push(
                    `📝 ${escapeHtml(instructions)}`
                );
            }


            addressPreview.innerHTML =
                lines.join("<br>");


            addressPreview.classList.add(
                "visible"
            );
        }


        /* =====================================================
           ZONE INFO
        ===================================================== */

        function updateZoneInfo() {

            if (
                !zoneSelect ||
                !zoneInfo
            ) {

                return;
            }


            const option =
                zoneSelect
                    .selectedOptions?.[0];


            if (
                !option ||
                !option.value
            ) {

                zoneInfo.innerHTML =
                    "";

                zoneInfo.classList
                    .remove(
                        "visible"
                    );

                updateTotals();

                return;
            }


            const fee =
                Number(
                    option.dataset.fee || 0
                );


            const minOrder =
                Number(
                    option.dataset.minOrder || 0
                );


            const freeFromRaw =
                option.dataset.freeFrom;


            const freeFrom =
                freeFromRaw
                    ? Number(
                        freeFromRaw
                    )
                    : null;


            const minMinutes =
                option.dataset
                    .estimatedMin;


            const maxMinutes =
                option.dataset
                    .estimatedMax;


            const lines =
                [];


            lines.push(
                `🚚 Livraison : ${money(fee)}`
            );


            if (minOrder > 0) {

                lines.push(
                    `🧺 Minimum : ${money(minOrder)}`
                );
            }


            if (
                freeFrom !== null &&
                freeFrom > 0
            ) {

                lines.push(
                    `🎁 Livraison offerte dès ${money(freeFrom)}`
                );
            }


            if (
                minMinutes ||
                maxMinutes
            ) {

                lines.push(
                    `⏱ Environ ${minMinutes || "?"}–${maxMinutes || "?"} min`
                );
            }


            zoneInfo.innerHTML =
                lines.join("<br>");


            zoneInfo.classList.add(
                "visible"
            );


            updateTotals();
        }


        /* =====================================================
           DELIVERY FEE
        ===================================================== */

        function calculateDeliveryFee() {

            if (
                getOrderType()
                !==
                "DELIVERY"
            ) {

                return 0;
            }


            const option =
                zoneSelect
                    ?.selectedOptions?.[0];


            if (
                !option ||
                !option.value
            ) {

                return 0;
            }


            const fee =
                Number(
                    option.dataset.fee || 0
                );


            const freeFromRaw =
                option.dataset.freeFrom;


            const freeFrom =
                freeFromRaw
                    ? Number(
                        freeFromRaw
                    )
                    : null;


            if (
                freeFrom !== null &&
                subtotal >= freeFrom
            ) {

                return 0;
            }


            return fee;
        }


        /* =====================================================
           MINIMUM ORDER
        ===================================================== */

        function checkMinimumOrder() {

            if (
                getOrderType()
                !==
                "DELIVERY"
            ) {

                if (warningElement) {

                    warningElement.classList
                        .remove(
                            "visible"
                        );

                    warningElement.textContent =
                        "";
                }


                return true;
            }


            const option =
                zoneSelect
                    ?.selectedOptions?.[0];


            /*
             * Pas encore de zone sélectionnée.
             */

            if (
                !option ||
                !option.value
            ) {

                if (warningElement) {

                    warningElement.classList
                        .remove(
                            "visible"
                        );
                }


                return true;
            }


            const minimum =
                Number(
                    option.dataset.minOrder
                    ||
                    0
                );


            if (
                minimum > 0 &&
                subtotal < minimum
            ) {

                if (warningElement) {

                    warningElement.textContent =
                        "Minimum de commande pour cette zone : "
                        +
                        money(minimum)
                        +
                        ". Il manque "
                        +
                        money(
                            minimum -
                            subtotal
                        )
                        +
                        ".";


                    warningElement.classList.add(
                        "visible"
                    );
                }


                return false;
            }


            if (warningElement) {

                warningElement.classList.remove(
                    "visible"
                );

                warningElement.textContent =
                    "";
            }


            return true;
        }


        /* =====================================================
           TOTAL
        ===================================================== */

        function updateTotals() {

            const fee =
                calculateDeliveryFee();


            const selectedReward = document.querySelector('input[name="loyalty_redemption_public_id"]:checked');
            const rewardType = String(selectedReward?.dataset.type || '');
            const rewardValue = Number(selectedReward?.dataset.value || 0);
            const rewardName = selectedReward?.dataset.name || 'Avantage Tiop+';
            let previewDiscount = 0;
            let previewFee = fee;

            if (selectedReward?.value) {
                if (rewardType === 'DISCOUNT') previewDiscount = Math.min(subtotal, Math.round(subtotal * rewardValue / 100));
                if (rewardType === 'COUPON') previewDiscount = Math.min(subtotal, rewardValue);
                if (rewardType === 'FREE_DELIVERY' && getOrderType() === 'DELIVERY') previewFee = 0;
            }

            const total = Math.max(0, subtotal - previewDiscount + previewFee);


            if (deliveryFeeElement) {

                deliveryFeeElement.textContent =
                    previewFee === 0
                        ? "0 " + currency
                        : money(previewFee);
            }


            if (loyaltySummaryRow) {
                const active = Boolean(selectedReward?.value);
                loyaltySummaryRow.hidden = !active;
                if (active) {
                    loyaltySummaryLabel.textContent = `🎁 ${rewardName}`;
                    if (rewardType === 'PRODUCT') loyaltySummaryAmount.textContent = 'Produit offert';
                    else if (rewardType === 'FREE_DELIVERY') loyaltySummaryAmount.textContent = getOrderType() === 'DELIVERY' ? 'Livraison offerte' : 'Livraison requise';
                    else loyaltySummaryAmount.textContent = '- ' + money(previewDiscount);
                }
            }

            if (totalElement) {

                totalElement.textContent =
                    money(total);
            }


            const minimumValid =
                checkMinimumOrder();


            if (submitButton) {

                submitButton.disabled =
                    !minimumValid;
            }
        }


        /* =====================================================
           LOAD ZONES
        ===================================================== */

        async function loadRestaurantZones() {

            if (
                !restaurantSelect ||
                !zoneSelect
            ) {

                return;
            }


            const restaurantId =
                Number(
                    restaurantSelect.value
                );


            if (!restaurantId) {

                return;
            }


            const previousValue =
                zoneSelect.value;


            zoneSelect.innerHTML =
                `
                    <option value="">
                        Chargement...
                    </option>
                `;


            zoneSelect.disabled =
                true;


            try {

                const response =
                    await fetch(
                        `/checkout/zones/${restaurantId}`,
                        {
                            headers: {
                                "Accept":
                                    "application/json"
                            },

                            credentials:
                                "same-origin"
                        }
                    );


                const result =
                    await response.json();


                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(
                        result.message
                        ||
                        "Impossible de charger les zones."
                    );
                }


                zoneSelect.innerHTML =
                    `
                        <option value="">
                            Sélectionnez votre zone
                        </option>
                    `;


                result.zones.forEach(
                    zone => {

                        const option =
                            document.createElement(
                                "option"
                            );


                        option.value =
                            zone.id;


                        option.textContent =
                            zone.name;


                        option.dataset.fee =
                            Number(
                                zone.delivery_fee || 0
                            );


                        option.dataset.minOrder =
                            Number(
                                zone.min_order || 0
                            );


                        option.dataset.freeFrom =
                            zone.free_delivery_from
                            ?? "";


                        option.dataset.estimatedMin =
                            zone.estimated_min_minutes
                            ?? "";


                        option.dataset.estimatedMax =
                            zone.estimated_max_minutes
                            ?? "";


                        zoneSelect.appendChild(
                            option
                        );
                    }
                );


                /*
                 * On restaure la sélection
                 * si cette zone existe encore.
                 */

                if (
                    previousValue &&
                    Array.from(
                        zoneSelect.options
                    )
                    .some(
                        option =>
                            option.value
                            ===
                            previousValue
                    )
                ) {

                    zoneSelect.value =
                        previousValue;
                }


                updateRestaurantCapabilities();
                updateZoneInfo();

            }
            catch (error) {

                console.error(
                    "Erreur chargement zones :",
                    error
                );


                zoneSelect.innerHTML =
                    `
                        <option value="">
                            Zones indisponibles
                        </option>
                    `;


                updateTotals();

            }
            finally {

                zoneSelect.disabled =
                    false;
            }
        }


        /* =====================================================
           ESCAPE
        ===================================================== */

        function escapeHtml(value) {

            const div =
                document.createElement(
                    "div"
                );


            div.textContent =
                String(
                    value || ""
                );


            return div.innerHTML;
        }


        /* =====================================================
           EVENTS
        ===================================================== */

        document
            .querySelectorAll(
                'input[name="order_type"]'
            )
            .forEach(
                input => {

                    input.addEventListener(
                        "change",
                        function () {

                            refreshOrderTypeCards();

                            updateDeliveryVisibility();
                        }
                    );
                }
            );


        restaurantSelect
            ?.addEventListener(
                "change",
                function () {

                    updateRestaurantCapabilities();

                    loadRestaurantZones();
                }
            );


        addressSelect
            ?.addEventListener(
                "change",
                updateAddressPreview
            );


        zoneSelect
            ?.addEventListener(
                "change",
                updateZoneInfo
            );


        /* =====================================================
           VALIDATION SUBMIT
        ===================================================== */

        form
            ?.addEventListener(
                "submit",
                function (event) {

                    const orderType =
                        getOrderType();


                    if (
                        orderType ===
                        "DELIVERY"
                    ) {

                        if (
                            !addressSelect ||
                            !addressSelect.value
                        ) {

                            event.preventDefault();

                            alert(
                                "Veuillez sélectionner une adresse de livraison."
                            );

                            return;
                        }


                        if (
                            !zoneSelect ||
                            !zoneSelect.value
                        ) {

                            event.preventDefault();

                            alert(
                                "Veuillez sélectionner une zone de livraison."
                            );

                            return;
                        }


                        if (
                            !checkMinimumOrder()
                        ) {

                            event.preventDefault();

                            return;
                        }
                    }


                    if (submitButton) {

                        submitButton.disabled =
                            true;


                        submitButton.textContent =
                            "Création de la commande...";
                    }
                }
            );


        loyaltyRadios.forEach(radio => radio.addEventListener('change', updateTotals));

        /* =====================================================
           INITIALISATION
        ===================================================== */

        updateRestaurantCapabilities();

        refreshOrderTypeCards();

        updateDeliveryVisibility();

        updateAddressPreview();

        updateZoneInfo();

        updateTotals();

    }
);