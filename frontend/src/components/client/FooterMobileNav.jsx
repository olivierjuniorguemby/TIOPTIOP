import { Link } from "react-router-dom"

function FooterMobileNav() {
  return (
    <nav className="tt-bottom-nav">
      <div className="container">
        <ul className="nav nav-justified py-2">

          <li className="nav-item">
            <Link className="nav-link" to="/">
              <i className="bi bi-house"></i>
              <div className="small">Accueil</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" to="/menu">
              <i className="bi bi-grid"></i>
              <div className="small">Menus</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" to="/tracking">
              <i className="bi bi-geo-alt"></i>
              <div className="small">Suivi</div>
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" to="/profile">
              <i className="bi bi-person"></i>
              <div className="small">Profil</div>
            </Link>
          </li>

        </ul>
      </div>
    </nav>
  )
}

export default FooterMobileNav