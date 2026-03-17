import { Link } from "react-router-dom"

function SidebarClientMobile() {
  return (
    <div className="offcanvas offcanvas-start" id="ttClientSidebar">

      <div className="offcanvas-header">
        <h5 className="offcanvas-title">
          <i className="bi bi-person-circle me-2"></i>
          Mon compte
        </h5>
        <button className="btn-close" data-bs-dismiss="offcanvas"></button>
      </div>

      <div className="offcanvas-body">

        <div className="tt-card p-3 mb-3 text-center">
          <div className="fw-bold">Bienvenue 👋</div>
          <div className="small text-muted">
            Connecté en tant que Client
          </div>
        </div>

        <div className="d-grid gap-2">

          <Link
            to="/menu"
            className="btn btn-sm btn-tt-outline tt-btn text-start py-2"
          >
            <i className="bi bi-book me-2"></i>
            Menu
          </Link>

          <Link
            to="/tracking"
            className="btn btn-sm btn-tt-outline tt-btn text-start py-2"
          >
            <i className="bi bi-geo-alt me-2"></i>
            Suivi commande
          </Link>

          <Link
            to="/history"
            className="btn btn-sm btn-tt-outline tt-btn text-start py-2"
          >
            <i className="bi bi-clock-history me-2"></i>
            Historique
          </Link>

          <Link
            to="/reductions"
            className="btn btn-sm btn-tt-outline tt-btn text-start py-2"
          >
            <i className="bi bi-percent me-2"></i>
            Réductions
          </Link>

          <hr />

          <Link
            to="/auth"
            className="btn btn-tt tt-btn text-start py-2"
          >
            <i className="bi bi-box-arrow-right me-2"></i>
            Se connecter / Compte
          </Link>

        </div>

      </div>
    </div>
  )
}

export default SidebarClientMobile