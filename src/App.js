// src/App.js
import React from "react";
import Maze from "./Maze";
import "./App.css"; // keep your existing styles if any

function App() {
  return (
    <div className="App" style={{fontFamily: "Inter, system-ui, Arial"}}>
      <header style={{textAlign: "center", padding: 20}}>
        <h1 style={{margin: 0}}>🌀 Maze Pathfinding Visualizer</h1>
        <p style={{color: "#555", marginTop: 6}}>Interactive maze — draw walls, set start/end, and visualize the solver</p>
      </header>
      <main style={{display: "flex", justifyContent: "center", paddingBottom: 40}}>
        <Maze />
      </main>
    </div>
  );
}

export default App;
