import { Link } from "react-router-dom"
//import logo from "../assets/img/logo.svg"

function NavbarClient() {
  return (
    <header className="tt-topbar">
      <div className="container py-2 d-flex align-items-center justify-content-between">

        <button
          className="btn btn-sm btn-tt-outline tt-btn d-md-none"
          data-bs-toggle="offcanvas"
          data-bs-target="#ttClientSidebar"
        >
          <i className="bi bi-list"></i>
        </button>

        <Link className="d-flex align-items-center gap-2 text-decoration-none" to="/">
          <img src="/assets/img/logo.svg" alt="TchoTchop" style={{ height: 34 }} />
          <span className="tt-brand-badge d-none d-md-inline">
            Cuisine locale • Livraison
          </span>
        </Link>

        <div className="d-flex align-items-center gap-2">
          <Link className="btn btn-sm btn-tt tt-btn position-relative" to="/cart">
            <i className="bi bi-bag"></i>
          </Link>

          <button className="btn btn-sm btn-tt-outline tt-btn"
          onClick={() => window.showToast("Produit ajouté au panier")}>
            <i className="bi bi-bell"></i>
          </button>
        </div>
      </div>
    </header>
  )
}

export default NavbarClient