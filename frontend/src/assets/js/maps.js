window.TT_MAPS = (function(){

  const api = {}; // ✅ objet interne SAFE

  api.initClientTracking = function(mapId="map"){
    const el = document.getElementById(mapId);
    if(!el) return;

    const map = L.map(mapId).setView([-4.2634, 15.2429], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const client = L.marker([-4.267, 15.246]).addTo(map).bindPopup("Client");
    const rider  = L.marker([-4.24, 15.20]).addTo(map).bindPopup("Livreur");
    const shop   = L.marker([-4.2634, 15.2429]).addTo(map).bindPopup("TchoTchop");

    L.polyline([shop.getLatLng(), rider.getLatLng(), client.getLatLng()]).addTo(map);

    return map;
  };

  api.initAdminGeo = function(mapId="adminMap"){
    const el = document.getElementById(mapId);
    if(!el) return;

    const map = L.map(mapId).setView([-4.2634, 15.2429], 12);
    api._adminMap = map;            // ✅ CORRECT
    api._adminMarkers = [];         // ✅ CORRECT

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const points = [
      {
        name:"Boutique TchoTchop",
        lat:-4.2634,
        lng:15.2429,
        meta:{ type:"shop", sector:"centre" }
      },
      {
        name:"Client A",
        lat:-4.267,
        lng:15.246,
        meta:{ type:"customer", category:"dejeuner", menu:"saka", courier:"ldv1", sector:"centre" }
      },
      {
        name:"Livreur 1",
        lat:-4.24,
        lng:15.20,
        meta:{ type:"courier", courier:"ldv1", sector:"centre" }
      }
    ];

    points.forEach(p => {
      const marker = L.marker([p.lat, p.lng])
        .addTo(map)
        .bindPopup(`<strong>${p.name}</strong><br>${p.meta.type}`);

      api._adminMarkers.push({ marker, meta:p.meta });
    });

    const btn = document.getElementById("ttGeolocBtn");
    if (btn && navigator.geolocation) {
      btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          L.marker([pos.coords.latitude, pos.coords.longitude])
            .addTo(map)
            .bindPopup("Ma position")
            .openPopup();
        });
      };
    }

    return map;
  };

  api.applyAdminGeoFilters = function(filters){
    if (!api._adminMarkers || !api._adminMap) return 0;

    let visible = 0;

    api._adminMarkers.forEach(item => {
      const { marker, meta } = item;

      const typeOk =
        (meta.type === "customer" && filters.show.customers) ||
        (meta.type === "courier"  && filters.show.couriers)  ||
        (meta.type === "shop"     && filters.show.shop);

      const ok =
        typeOk &&
        (filters.category === "all" || meta.category === filters.category) &&
        (filters.menu     === "all" || meta.menu === filters.menu) &&
        (filters.courier  === "all" || meta.courier === filters.courier) &&
        (filters.sector   === "all" || meta.sector === filters.sector);

      if (ok) {
        if (!marker._map) marker.addTo(api._adminMap);
        visible++;
      } else {
        marker.remove();
      }
    });

    return visible;
  };

  return api; // ✅ EXPOSITION PROPRE
})();
