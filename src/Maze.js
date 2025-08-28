// src/Maze.js
import React, { useState, useCallback } from "react";
import "./Maze.css";

const DEFAULT_ROWS = 12;
const DEFAULT_COLS = 18;

// helper: create grid filled with 0
const createGrid = (rows = DEFAULT_ROWS, cols = DEFAULT_COLS) =>
  Array.from({ length: rows }, () => Array(cols).fill(0));

const copyGrid = (g) => g.map(row => row.slice());

// cell codes: 0 empty, 1 wall, 2 start, 3 end, 4 visited, 5 path

export default function Maze() {
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [grid, setGrid] = useState(() => {
    const g = createGrid(DEFAULT_ROWS, DEFAULT_COLS);
    g[0][0] = 2;
    g[DEFAULT_ROWS - 1][DEFAULT_COLS - 1] = 3;
    return g;
  });

  const [mode, setMode] = useState("wall"); // "wall" | "erase" | "start" | "end"
  const [isRunning, setIsRunning] = useState(false);
  const [algo, setAlgo] = useState("bfs"); // "bfs" | "astar"
  const [speed, setSpeed] = useState(50); // 1..100 (higher = faster)
  const [metrics, setMetrics] = useState({ visited: 0, pathLen: 0, timeMs: 0 });

  const findCell = (type, g = grid) => {
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < g[0].length; c++) {
        if (g[r][c] === type) return [r, c];
      }
    }
    return null;
  };

  const handleCellClick = (r, c) => {
    if (isRunning) return;
    setGrid(prev => {
      const g = copyGrid(prev);
      const cell = g[r][c];
      const startPos = findCell(2, g);
      const endPos = findCell(3, g);

      if (mode === "wall") {
        if (cell === 2 || cell === 3) return prev;
        g[r][c] = cell === 1 ? 0 : 1;
      } else if (mode === "erase") {
        if (cell !== 2 && cell !== 3) g[r][c] = 0;
      } else if (mode === "start") {
        if (startPos) g[startPos[0]][startPos[1]] = 0;
        if (g[r][c] === 3) return prev;
        g[r][c] = 2;
      } else if (mode === "end") {
        if (endPos) g[endPos[0]][endPos[1]] = 0;
        if (g[r][c] === 2) return prev;
        g[r][c] = 3;
      }
      return g;
    });
  };

  const clearVisitedAndPath = useCallback(() => {
    setGrid(prev => {
      const g = copyGrid(prev);
      for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
        if (g[r][c] === 4 || g[r][c] === 5) g[r][c] = 0;
      }
      // ensure start/end exist
      if (!findCell(2, g)) g[0][0] = 2;
      if (!findCell(3, g)) g[g.length - 1][g[0].length - 1] = 3;
      return g;
    });
  }, [grid]);

  const randomMaze = (density = 0.28) => {
    if (isRunning) return;
    setGrid(() => {
      const g = createGrid(rows, cols);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (Math.random() < density) g[r][c] = 1;
      }
      g[0][0] = 2;
      g[rows - 1][cols - 1] = 3;
      return g;
    });
  };

  const resetGrid = () => {
    if (isRunning) return;
    const g = createGrid(rows, cols);
    g[0][0] = 2;
    g[rows - 1][cols - 1] = 3;
    setGrid(g);
    setMetrics({ visited: 0, pathLen: 0, timeMs: 0 });
  };

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // BFS algorithm: returns {path, visitedOrder}
  const bfs = (gridLocal, start, end) => {
    const R = gridLocal.length, C = gridLocal[0].length;
    const visited = Array.from({ length: R }, () => Array(C).fill(false));
    const queue = [];
    const visitedOrder = [];
    queue.push([start]); // path array
    visited[start[0]][start[1]] = true;

    while (queue.length) {
      const path = queue.shift();
      const [x, y] = path[path.length - 1];
      visitedOrder.push([x, y]);

      if (x === end[0] && y === end[1]) return { path, visitedOrder };

      const neighbors = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= R || ny >= C) continue;
        if (visited[nx][ny]) continue;
        if (gridLocal[nx][ny] === 1) continue;
        visited[nx][ny] = true;
        queue.push([...path, [nx, ny]]);
      }
    }
    return { path: [], visitedOrder };
  };

  // A* algorithm (Manhattan heuristic). returns {path, visitedOrder}
  const aStar = (gridLocal, start, end) => {
    const R = gridLocal.length, C = gridLocal[0].length;
    const inBounds = (x,y) => x>=0 && y>=0 && x<R && y<C;
    const manhattan = (a,b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]);

    const openSet = new Set();
    const cameFrom = new Map();
    const gScore = Array.from({ length: R }, () => Array(C).fill(Infinity));
    const fScore = Array.from({ length: R }, () => Array(C).fill(Infinity));
    const visitedOrder = [];

    const key = (x,y) => `${x},${y}`;

    gScore[start[0]][start[1]] = 0;
    fScore[start[0]][start[1]] = manhattan(start, end);

    // simple open list as array of [f, [x,y]]
    const openList = [[fScore[start[0]][start[1]], start]];
    openSet.add(key(start[0],start[1]));

    while (openList.length) {
      // get node with smallest f
      openList.sort((a,b) => a[0]-b[0]);
      const [, current] = openList.shift();
      openSet.delete(key(current[0], current[1]));
      visitedOrder.push(current);

      if (current[0] === end[0] && current[1] === end[1]) {
        // reconstruct path
        const path = [];
        let curKey = key(current[0], current[1]);
        while (cameFrom.has(curKey)) {
          const [x,y] = curKey.split(",").map(Number);
          path.unshift([x,y]);
          curKey = cameFrom.get(curKey);
        }
        path.unshift(start);
        return { path, visitedOrder };
      }

      const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx,dy] of neighbors) {
        const nx = current[0] + dx, ny = current[1] + dy;
        if (!inBounds(nx,ny)) continue;
        if (gridLocal[nx][ny] === 1) continue; // wall

        const tentativeG = gScore[current[0]][current[1]] + 1;
        if (tentativeG < gScore[nx][ny]) {
          cameFrom[key(nx,ny)] = key(current[0], current[1]);
          gScore[nx][ny] = tentativeG;
          fScore[nx][ny] = tentativeG + manhattan([nx,ny], end);
          if (!openSet.has(key(nx,ny))) {
            openSet.add(key(nx,ny));
            openList.push([fScore[nx][ny], [nx,ny]]);
          }
        }
      }
    }
    return { path: [], visitedOrder }; // no path
  };

  const solveAndAnimate = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setMetrics({ visited: 0, pathLen: 0, timeMs: 0 });

    // clear previous visited/path
    setGrid(prev => {
      const g = copyGrid(prev);
      for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
        if (g[r][c] === 4 || g[r][c] === 5) g[r][c] = 0;
      }
      return g;
    });

    const start = findCell(2);
    const end = findCell(3);
    if (!start || !end) {
      alert("Please ensure both Start and End are set.");
      setIsRunning(false);
      return;
    }

    // copy grid for algorithm
    const gridCopy = copyGrid(grid);
    const t0 = performance.now();
    let result;
    if (algo === "bfs") result = bfs(gridCopy, start, end);
    else result = aStar(gridCopy, start, end);
    const t1 = performance.now();

    const visitedOrder = result.visitedOrder || [];
    const path = result.path || [];

    // compute metrics early
    setMetrics(prev => ({ ...prev, visited: visitedOrder.length, timeMs: Math.round(t1 - t0) }));

    // animation speed logic: speed slider gives 1..100 (higher => faster)
    // map to delays in ms: higher speed => smaller delay
    const visitDelay = Math.max(8, 120 - speed); // min 8ms
    const pathDelay = Math.max(12, 160 - speed * 1.5);

    // animate visited
    for (let i = 0; i < visitedOrder.length; i++) {
      const [r, c] = visitedOrder[i];
      setGrid(prev => {
        const g = copyGrid(prev);
        if (g[r][c] === 0) g[r][c] = 4;
        return g;
      });
      await sleep(visitDelay);
    }

    if (!path.length) {
      alert("No path found.");
      setIsRunning(false);
      return;
    }

    // animate final path
    for (let i = 0; i < path.length; i++) {
      const [r, c] = path[i];
      setGrid(prev => {
        const g = copyGrid(prev);
        if (g[r][c] !== 2 && g[r][c] !== 3) g[r][c] = 5;
        return g;
      });
      await sleep(pathDelay);
    }

    setMetrics(prev => ({ ...prev, pathLen: path.length }));
    setIsRunning(false);
  };

  const handleResize = () => {
    if (isRunning) return;
    const r = parseInt(prompt("Rows (6 - 30)", `${rows}`), 10);
    const c = parseInt(prompt("Cols (6 - 50)", `${cols}`), 10);
    if (!isNaN(r) && !isNaN(c) && r >= 6 && c >= 6) {
      setRows(r);
      setCols(c);
      const g = createGrid(r, c);
      g[0][0] = 2;
      g[r - 1][c - 1] = 3;
      setGrid(g);
    }
  };

  return (
    <div className="maze-root">
      <div className="controls-card">
        <div style={{display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap"}}>
          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button className="btn" onClick={() => setMode("wall")} disabled={isRunning} aria-pressed={mode==="wall"}>🧱 Draw Walls</button>
            <button className="btn" onClick={() => setMode("erase")} disabled={isRunning} aria-pressed={mode==="erase"}>🧹 Erase</button>
            <button className="btn" onClick={() => setMode("start")} disabled={isRunning} aria-pressed={mode==="start"}>🟢 Set Start</button>
            <button className="btn" onClick={() => setMode("end")} disabled={isRunning} aria-pressed={mode==="end"}>🔴 Set End</button>
          </div>

          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <label style={{display:"flex",alignItems:"center",gap:8}}>
              Algorithm:
              <select value={algo} onChange={(e)=>setAlgo(e.target.value)} disabled={isRunning} style={{marginLeft:6,padding:6,borderRadius:6}}>
                <option value="bfs">BFS (Shortest path on unweighted)</option>
                <option value="astar">A* (Heuristic search)</option>
              </select>
            </label>

            <label style={{display:"flex",alignItems:"center",gap:8}}>
              Speed:
              <input type="range" min="1" max="100" value={speed} onChange={(e)=>setSpeed(parseInt(e.target.value,10))} disabled={isRunning} />
            </label>

            <button className="btn primary" onClick={solveAndAnimate} disabled={isRunning}>▶ Solve</button>
            <button className="btn" onClick={() => randomMaze(0.30)} disabled={isRunning}>🎲 Random</button>
            <button className="btn" onClick={resetGrid} disabled={isRunning}>♻ Reset</button>
            <button className="btn" onClick={clearVisitedAndPath} disabled={isRunning}>🧾 Clear Path</button>
            <button className="btn small" onClick={handleResize} disabled={isRunning}>🔧 Resize</button>
          </div>
        </div>

        <div className="info-row" style={{marginTop:10, justifyContent:"space-between"}}>
          <div>Mode: <b>{mode}</b></div>
          <div>Grid: <b>{rows} × {cols}</b></div>
          <div>Status: <b style={{color: isRunning ? "#d9534f" : "#28a745"}}>{isRunning ? "Solving..." : "Idle"}</b></div>
        </div>

        <div style={{display:"flex", gap:12, marginTop:10, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{fontSize:13, color:"#374151"}}>Visited: <b>{metrics.visited}</b></div>
          <div style={{fontSize:13, color:"#374151"}}>Path length: <b>{metrics.pathLen}</b></div>
          <div style={{fontSize:13, color:"#374151"}}>Time: <b>{metrics.timeMs} ms</b></div>
        </div>
      </div>

      <div className="maze-grid" style={{gridTemplateColumns: `repeat(${cols}, 28px)`, gridTemplateRows: `repeat(${rows}, 28px)`}}>
        {grid.map((row, rIdx) =>
          row.map((cell, cIdx) => {
            const classes = ["cell"];
            if (cell === 1) classes.push("cell-wall");
            if (cell === 2) classes.push("cell-start");
            if (cell === 3) classes.push("cell-end");
            if (cell === 4) classes.push("cell-visited");
            if (cell === 5) classes.push("cell-path");
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={classes.join(" ")}
                onClick={() => handleCellClick(rIdx, cIdx)}
                title={`(${rIdx},${cIdx})`}
              />
            );
          })
        )}
      </div>

      <div style={{marginTop:12, textAlign:"center", color:"#555"}}>
        <small>Tip: Draw walls, set start/end, choose algorithm, and click Solve. Speed slider controls animation speed.</small>
      </div>
    </div>
  );
}
