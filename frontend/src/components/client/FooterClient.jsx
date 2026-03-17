import { Link } from "react-router-dom"

function FooterClient() {
  return (
    <footer className="tt-footer mt-5">
      <div className="container py-4">

        <div className="row g-4">

          <div className="col-md-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <img src="/assets/img/logo.svg" alt="logo" style={{ height: 34 }} />
            </div>

            <div className="small text-muted">
              TchoTchop valorise la cuisine du Congo-Brazzaville :
              plats locaux, grillades, petit-déj, desserts.
              Commande sur place ou à distance.
            </div>

            <div className="mt-3 d-flex gap-2 flex-wrap">
              <span className="tt-badge">
                <i className="bi bi-shield-check me-1"></i>Paiement sécurisé
              </span>

              <span className="tt-badge">
                <i className="bi bi-box-seam me-1"></i>Emballages propres
              </span>

              <span className="tt-badge">
                <i className="bi bi-bell me-1"></i>Notifications
              </span>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div className="fw-bold mb-2">Menus</div>
            <div className="d-grid gap-1 small">
              <Link to="/menu">Petit-déjeuner</Link>
              <Link to="/menu">Déjeuner</Link>
              <Link to="/menu">Desserts</Link>
              <Link to="/menu">Grillades</Link>
              <Link to="/menu">Boissons</Link>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div className="fw-bold mb-2">Compte</div>
            <div className="d-grid gap-1 small">
              <Link to="/profile">Profil</Link>
              <Link to="/history">Historique</Link>
              <Link to="/reductions">Réductions</Link>
              <Link to="/subscriptions">Abonnement</Link>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div className="fw-bold mb-2">Assistance</div>
            <div className="d-grid gap-1 small">
              <Link to="/help">Aide</Link>
              <Link to="/incidents">Incidents</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/about">À propos</Link>
            </div>
          </div>

          <div className="col-6 col-md-2">
            <div className="fw-bold mb-2">Admin</div>
            <div className="d-grid gap-1 small">
              <Link to="/admin">Dashboard</Link>
              <Link to="/admin/orders">Commandes</Link>
              <Link to="/admin/deliveries">Livraisons</Link>
              <Link to="/admin/geo">Géolocalisation</Link>
            </div>
          </div>

        </div>

        <hr className="my-4" />

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 small text-muted">
          <div>© 2026 TchoTchop • Template UI</div>

          <div className="d-flex gap-3">
            <span><i className="bi bi-instagram me-1"></i>Instagram</span>
            <span><i className="bi bi-tiktok me-1"></i>TikTok</span>
            <span><i className="bi bi-youtube me-1"></i>YouTube</span>
          </div>
        </div>

      </div>
    </footer>
  )
}

export default FooterClient