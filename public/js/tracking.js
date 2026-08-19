/*
 * TIOPTIOP - 13.5.1
 *
 * ANCIEN FICHIER DE TRACKING DESACTIVE.
 *
 * Le suivi réel est désormais géré directement par :
 * views/client/orders/tracking.ejs
 *
 * Ce fichier contenait auparavant :
 *     const orderId = "TIOP-38651";
 *
 * et créait une DEUXIEME connexion Socket.IO / carte Leaflet.
 *
 * Il ne doit plus :
 * - rejoindre une room codée en dur ;
 * - créer une deuxième carte ;
 * - écouter driver:location ;
 * - simuler les statuts.
 *
 * Vous pouvez également supprimer toute balise :
 *     <script src="/js/tracking.js"></script>
 * si elle existe encore dans un layout/partial.
 */

console.debug(
    "[TiopTiop] public/js/tracking.js legacy désactivé."
);
