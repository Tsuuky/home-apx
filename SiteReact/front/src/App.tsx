import { BrowserRouter, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Season from "./pages/Season";
import Stock from "./pages/Stock";
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
            <Route path="/season" element={<Season />} />
            <Route path="/stock" element={<Stock />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
