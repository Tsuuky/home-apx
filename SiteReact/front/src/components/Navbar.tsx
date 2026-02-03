import { NavLink } from "react-router-dom";
import { IconDashboard, IconSeason, IconStock, IconWater, IconList } from "./icons";

const heatingItems = [
  { to: "/", label: "Dashboard", Icon: IconDashboard },
  { to: "/season", label: "Saisons", Icon: IconSeason },
  { to: "/stock", label: "Stock", Icon: IconStock },
  { to: "/readings", label: "Relèves", Icon: IconList },
];

const waterItems = [{ to: "/water", label: "Eau froide", Icon: IconWater }];

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
        <div className="nav-group">
          <div className="nav-group-title">Chauffage</div>
          <div className="nav-group-links">
            {heatingItems.map(({ to, label, Icon }) => (
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
          </div>
        </div>
        <div className="nav-group">
          <div className="nav-group-title">Eau froide</div>
          <div className="nav-group-links">
            {waterItems.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
                end={to === "/water"}
              >
                <Icon />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
