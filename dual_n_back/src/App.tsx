import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css'; 
import eye_pic from './assets/eye_pic.jpg'; 
import hearing from './assets/hearing.jpg'; 

function App() {
  // We create an array of 9 items to map through for our grid
  const gridCells = Array(9).fill(null);
  const level =1; 

  return (
    <div className="container">

      <header className="header">
        <h1>N = {level}</h1>
      </header>

      <main className="grid-container">
        {gridCells.map((_, index) => (
          <div key={index} className="grid-cell">
            {/* You can add icons or numbers here later */}
          </div>
        ))}
      </main>

      <footer className="footer">
        <button className="btn secondary">
          <img className= "action_button" src = {eye_pic} alt = "seen"></img>
        </button>
        <button className="btn secondary">
          <img className= "action_button" src= {hearing} alt= "hear"></img>
        </button>
      </footer>
    </div>
  );
}

export default App
