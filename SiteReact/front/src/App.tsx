import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WoodDashboard from "./pages/WoodDashboard";
import Season from "./pages/Season";
import Stock from "./pages/Stock";
import Water from "./pages/Water";
import Readings from "./pages/Readings";
import Navbar from "./components/Navbar";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/wood" element={<WoodDashboard />} />
            <Route path="/season" element={<Season />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/water" element={<Water />} />
            <Route path="/readings" element={<Readings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
