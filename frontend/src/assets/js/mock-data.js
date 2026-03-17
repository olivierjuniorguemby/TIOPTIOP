window.TT_MOCK = {
  categories: [
    { id: "petitdej", name: "Petit-déjeuner", icon: "bi-sunrise" },
    { id: "dejeuner", name: "Déjeuner", icon: "bi-egg-fried" },
    { id: "dessert", name: "Dessert", icon: "bi-cup-straw" },
    { id: "boissons", name: "Boissons", icon: "bi-cup-hot" },
    { id: "grillades", name: "Grillades", icon: "bi-fire" },
  ],
  menus: [
    {
      id: "saka",
      name: "Saka-Saka Premium",
      category: "dejeuner",
      price: 4500,
      rating: 4.7,
      //images: ["bi-basket2-fill","bi-emoji-smile","bi-stars"],
      images: ["saka_saka1.jpg","saka_saka2.jpg","saka_saka3.jpg"],
      ingredients: ["Feuilles de manioc", "Huile de palme", "Arachide", "Poisson fumé (option)", "Épices maison"],
      suggestions: ["Riz blanc", "Banane plantain", "Jus de bissap"],
      customizable: true
    },
    {
      id: "haricots",
      name: "Haricots & Plantain",
      category: "dejeuner",
      price: 3500,
      rating: 4.5,
      //images: ["bi-egg-fried","bi-emoji-heart-eyes","bi-stars"],
      images: ["haricot1.jpg","haricot2.jpg","haricot3.jpg"],
      ingredients: ["Haricots", "Oignons", "Tomates", "Plantain", "Épices"],
      suggestions: ["Poulet braisé", "Frites maison", "Sauce piment"],
      customizable: true
    },
    {
      id: "grillade_mix",
      name: "Grillades Mix",
      category: "grillades",
      price: 6500,
      rating: 4.8,
      images: ["grillade_mix1.jpg","grillade_mix2.jpg","grillade_mix3.jpg"],
      ingredients: ["Poulet", "Poisson", "Brochettes", "Épices", "Citron"],
      suggestions: ["Alloco", "Salade fraîche", "Gingembre"],
      customizable: true
    },
    {
      id: "beignets",
      name: "Beignets (x6)",
      category: "petitdej",
      price: 1200,
      rating: 4.4,
      images: ["Beignets1.jpg","Beignets1.jpg","Beignets1.jpg"],
      ingredients: ["Farine", "Levure", "Sucre", "Huile", "Arachide (option)"],
      suggestions: ["Café au lait", "Bouillie maïs", "Riz au lait"],
      customizable: true
    }
  ],
  ads: [
    { id: 1, title: "Promo Fidélité", body: "Abonne-toi et gagne -10% sur 3 commandes", icon: "bi-bell" },
    { id: 2, title: "Nouveau plat", body: "Essaye notre sauce piment maison 🔥", icon: "bi-fire" },
  ],
  orders: [
    { id: "TT-10021", status: "En préparation", etaMin: 28, total: 9800 },
    { id: "TT-10020", status: "Livrée", etaMin: 0, total: 4500 },
  ],
  admin: {
    kpis: { ordersToday: 42, deliveries: 31, incidents: 3, revenueXAF: 245000 }
  }
};
