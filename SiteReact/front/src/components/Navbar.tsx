import { NavLink } from "react-router-dom";
import { IconDashboard, IconSeason, IconStock } from "./icons";

const navItems = [
  { to: "/", label: "Dashboard", Icon: IconDashboard },
  { to: "/season", label: "Saisons", Icon: IconSeason },
  { to: "/stock", label: "Stock", Icon: IconStock },
];

export default function Navbar() {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-dot" />
        <div>
          <strong>Conso Chauffage</strong>
          <div className="brand-sub">Granulés & DJU</div>
        </div>
      </div>

      <nav className="nav-links">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
            end={to === "/"}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
