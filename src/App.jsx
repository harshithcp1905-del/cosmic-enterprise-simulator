import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';

// --- FIREBASE CONFIGURATION (Replace with your actual Firebase project config) ---
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-universe-simulator.firebaseapp.com",
  projectId: "your-universe-simulator",
  storageBucket: "your-universe-simulator.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.log("Firebase offline mode active.");
}

// Procedural texture generator for realistic surface details & storm bands
function createPlanetTexture(type, baseColor, detailColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = detailColor;
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 45 + 10;

    if (type === 'gas') {
      ctx.fillRect(0, Math.random() * canvas.height, canvas.width, Math.random() * 35 + 5);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(canvas);
}

// Full Solar System Database
const INITIAL_PLANETS = [
  { name: 'Mercury', color: '#888888', detail: '#444444', type: 'terrestrial', size: 0.6, distance: 8, speed: 1.0, desc: 'The smallest planet in our solar system and closest to the Sun.' },
  { name: 'Venus', color: '#e3bb76', detail: '#b8860b', type: 'terrestrial', size: 1.0, distance: 14, speed: 0.8, desc: 'The hottest planet in the solar system due to a runaway greenhouse effect.' },
  { name: 'Earth', color: '#1a4371', detail: '#228b22', type: 'terrestrial', size: 1.2, distance: 22, speed: 0.6, hasAtmosphere: true, desc: 'Our home planet with vast oceans of liquid water and abundant life.' },
  { name: 'Mars', color: '#cc4400', detail: '#8b0000', type: 'terrestrial', size: 0.9, distance: 30, speed: 0.5, desc: 'A dusty, cold desert world with massive volcanoes and canyons.' },
  { name: 'Jupiter', color: '#d4a373', detail: '#bc6c25', type: 'gas', size: 2.5, distance: 42, speed: 0.3, desc: 'The massive gas giant featuring the iconic Great Red Spot storm.' },
  { name: 'Saturn', color: '#f4e2bb', detail: '#d4a373', type: 'gas', size: 2.0, distance: 56, speed: 0.2, hasRings: true, desc: 'Adorned with a dazzling, complex system of icy rings.' },
  { name: 'Uranus', color: '#7393B3', detail: '#4682B4', type: 'ice', size: 1.6, distance: 70, speed: 0.15, hasRings: true, desc: 'An ice giant that spins completely on its side.' },
  { name: 'Neptune', color: '#3065AC', detail: '#1D3979', type: 'ice', size: 1.6, distance: 84, speed: 0.1, desc: 'Dark, cold, and whipped by supersonic winds at the solar system edge.' },
  { name: 'Pluto', color: '#b0c4de', detail: '#778899', type: 'terrestrial', size: 0.5, distance: 98, speed: 0.07, desc: 'A distant dwarf world of ice mountains and nitrogen glaciers.' }
];

// Sprawling Asteroid Belt for deep space realism
function AsteroidField() {
  const beltRef = useRef();
  const count = 400;

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 34 + Math.random() * 4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (Math.random() - 0.5) * 2;
      const scale = Math.random() * 0.08 + 0.02;
      temp.push({ x, y, z, scale, speed: Math.random() * 0.1 + 0.02 });
    }
    return temp;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (beltRef.current) {
      beltRef.current.rotation.y = time * 0.03;
    }
  });

  return (
    <group ref={beltRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} scale={[p.scale, p.scale, p.scale]}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#777777" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Procedural Surface Terrain when landed on a planet
function PlanetSurface({ planet }) {
  return (
    <group position={[0, -5, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200, 32, 32]} />
        <meshStandardMaterial color={planet.color} roughness={0.9} />
      </mesh>
      <fog attach="fog" args={[planet.color, 10, 90]} />
    </group>
  );
}

// Traveller Rig managing Free-Flight vs Orbit-Lock vs Surface Landing
function SpaceTraveller({ targetPlanet, isLanded, planetRefs }) {
  const { camera } = useThree();
  const keys = useRef({});

  useEffect(() => {
    const handleKeyDown = (e) => { keys.current[e.code] = true; };
    const handleKeyUp = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (isLanded && targetPlanet) {
      camera.position.set(0, 1, 5);
      camera.lookAt(0, 1, -10);
    } else if (targetPlanet && planetRefs.current[targetPlanet.name]) {
      const planetMesh = planetRefs.current[targetPlanet.name];
      const worldPos = new THREE.Vector3();
      planetMesh.getWorldPosition(worldPos);

      const targetCamPos = new THREE.Vector3(worldPos.x + targetPlanet.size * 3, worldPos.y + targetPlanet.size * 1.5, worldPos.z + targetPlanet.size * 3);
      camera.position.lerp(targetCamPos, 0.08);
      camera.lookAt(worldPos);
    } else {
      const speed = 25 * delta;
      const direction = new THREE.Vector3();

      if (keys.current['KeyW'] || keys.current['ArrowUp']) direction.z -= 1;
      if (keys.current['KeyS'] || keys.current['ArrowDown']) direction.z += 1;
      if (keys.current['KeyA'] || keys.current['ArrowLeft']) direction.x -= 1;
      if (keys.current['KeyD'] || keys.current['ArrowRight']) direction.x += 1;
      if (keys.current['Space']) direction.y += 1;
      if (keys.current['ShiftLeft']) direction.y -= 1;

      direction.normalize();
      camera.translateOnAxis(direction, speed);
    }
  });

  return null;
}

function CelestialBody({ data, onSelect, planetRefs }) {
  const meshRef = useRef();
  const orbitRef = useRef();

  const planetTexture = useMemo(() => {
    return createPlanetTexture(data.type, data.color, data.detail);
  }, [data]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (orbitRef.current) {
      orbitRef.current.rotation.y = time * data.speed * 0.08;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      planetRefs.current[data.name] = meshRef.current;
    }
  });

  return (
    <group ref={orbitRef}>
      <mesh 
        ref={meshRef} 
        position={[data.distance, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(data);
        }}
      >
        <sphereGeometry args={[data.size, 64, 64]} />
        <meshStandardMaterial map={planetTexture} roughness={0.7} metalness={0.1} />

        {data.hasAtmosphere && (
          <mesh scale={[1.12, 1.12, 1.12]}>
            <sphereGeometry args={[data.size, 32, 32]} />
            <meshStandardMaterial color="#33bbff" transparent opacity={0.35} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
          </mesh>
        )}

        {data.hasRings && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[data.size * 1.3, data.size * 2.2, 64]} />
            <meshStandardMaterial color={data.name === 'Uranus' ? '#87CEEB' : '#c2b280'} side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
        )}
      </mesh>
    </group>
  );
}

export default function App() {
  const [planets, setPlanets] = useState(INITIAL_PLANETS);
  const [selectedBody, setSelectedBody] = useState(null);
  const [isLanded, setIsLanded] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Live Telemetry from Python WebSocket Backend
  const [telemetry, setTelemetry] = useState({ hullTemp: 0.0, radiation: 0.0, status: 'CONNECTING...' });
  const [chatMessages, setChatMessages] = useState([
    { sender: 'AI Astrogator', text: 'Connected to Python ML Telemetry stream.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const planetRefs = useRef({});

  // Connect to Python FastAPI WebSocket backend
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTelemetry(data);
    };

    ws.onerror = () => {
      setTelemetry({ hullTemp: 24.5, radiation: 0.12, status: 'OFFLINE (Fallback Active)' });
    };

    return () => ws.close();
  }, []);

  const handleSaveUniverse = async () => {
    if (!db) {
      setSaveStatus('⚠️ Firebase not connected');
      setTimeout(() => setSaveStatus(''), 3000);
      return;
    }
    try {
      setSaveStatus('Saving to Cloud...');
      await addDoc(collection(db, "universes"), {
        planets: planets,
        createdAt: Timestamp.now()
      });
      setSaveStatus('✅ Universe Saved!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('❌ Save Failed');
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'Commander', text: userText }]);
    setChatInput('');

    setTimeout(() => {
      let aiReply = `Python ML engine reports hull stability at ${telemetry.hullTemp}°C.`;
      setChatMessages((prev) => [...prev, { sender: 'AI Astrogator', text: aiReply }]);
    }, 800);
  };

  const handleGenerateExoplanet = (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    setTimeout(() => {
      const newPlanetName = `Exoplanet-${Math.floor(Math.random() * 899 + 100)}`;
      const newPlanet = {
        name: newPlanetName,
        color: '#ff0055',
        detail: '#770022',
        type: 'gas',
        size: 1.8,
        distance: planets[planets.length - 1].distance + 12,
        speed: 0.04,
        hasRings: true,
        desc: `AI-Forged Deep Space World from prompt: "${aiPrompt}".`
      };

      setPlanets((prev) => [...prev, newPlanet]);
      setSelectedBody(newPlanet);
      setIsLanded(false);
      setAiPrompt('');
      setIsGenerating(false);
      setChatMessages((prev) => [...prev, { sender: 'AI Astrogator', text: `Synthesized ${newPlanetName}!` }]);
    }, 1000);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', margin: 0, overflow: 'hidden', position: 'relative' }}>
      
      {/* Enterprise Hybrid HUD */}
      <div style={{ 
        position: 'absolute', top: 20, left: 20, zIndex: 10, color: 'white', 
        fontFamily: 'monospace', background: 'rgba(10, 10, 20, 0.92)', padding: '18px', 
        borderRadius: '10px', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,255,255,0.4)',
        maxWidth: '380px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', maxHeight: '92vh', overflowY: 'auto'
      }}>
        <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#00ffff' }}>⚡ Full-Stack Hybrid HUD</h2>
        
        {/* Live Python ML Telemetry Panel */}
        <div style={{ background: 'rgba(0,255,255,0.08)', padding: '8px', borderRadius: '6px', fontSize: '11px', marginBottom: '8px', border: '1px solid rgba(0,255,255,0.2)' }}>
          <div><b>Python ML Stream:</b> Connected (Port 8000)</div>
          <div><b>Hull Temp:</b> {telemetry.hullTemp}°C | <b>Radiation:</b> {telemetry.radiation} Sv</div>
          <div style={{ color: telemetry.status.includes('ANOMALY') ? '#ff4444' : '#00ff88', fontWeight: 'bold' }}>{telemetry.status}</div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={handleSaveUniverse}
            style={{ background: '#7928ca', color: '#fff', border: 'none', padding: '7px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '11px' }}
          >
            💾 Save Universe to Firebase Cloud
          </button>
          {saveStatus && <div style={{ fontSize: '10px', color: '#00ff88', marginTop: '4px', textAlign: 'center' }}>{saveStatus}</div>}
        </div>

        <form onSubmit={handleGenerateExoplanet} style={{ marginBottom: '10px' }}>
          <input 
            type="text" 
            placeholder="Forge exoplanet..." 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff', fontSize: '11px', marginBottom: '5px', boxSizing: 'border-box' }}
          />
          <button 
            type="submit" 
            disabled={isGenerating}
            style={{ background: '#00ccff', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '11px' }}
          >
            {isGenerating ? 'Synthesizing...' : '✨ Forge AI Exoplanet'}
          </button>
        </form>

        {selectedBody && (
          <div style={{ background: 'rgba(255,255,255,0.08)', padding: '8px', borderRadius: '6px', marginBottom: '10px' }}>
            <h3 style={{ margin: '0 0 3px 0', color: '#ffcc00', fontSize: '13px' }}>{selectedBody.name}</h3>
            <p style={{ fontSize: '10px', lineHeight: '1.2', margin: '0 0 8px 0', color: '#ddd' }}>{selectedBody.desc}</p>
            
            {!isLanded ? (
              <button 
                onClick={() => setIsLanded(true)} 
                style={{ background: '#00ff88', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '10px', marginBottom: '4px' }}
              >
                🛬 Land on Surface
              </button>
            ) : (
              <button 
                onClick={() => setIsLanded(false)} 
                style={{ background: '#ffaa00', color: '#000', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '10px', marginBottom: '4px' }}
              >
                🚀 Launch Back to Orbit
              </button>
            )}
          </div>
        )}

        {selectedBody && (
          <button 
            onClick={() => { setSelectedBody(null); setIsLanded(false); }} 
            style={{ background: '#ff4444', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '10px', marginBottom: '10px' }}
          >
            Release Lock & Free Roam
          </button>
        )}

        <div style={{ borderTop: '1px solid #333', paddingTop: '8px' }}>
          <div style={{ fontSize: '11px', color: '#00ffff', marginBottom: '4px', fontWeight: 'bold' }}>💬 AI Astrogator Copilot</div>
          <div style={{ background: '#05050a', height: '70px', overflowY: 'auto', padding: '6px', borderRadius: '4px', fontSize: '10px', marginBottom: '6px', border: '1px solid #222' }}>
            {chatMessages.map((m, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>
                <span style={{ color: m.sender === 'Commander' ? '#00ff88' : '#ffcc00' }}>{m.sender}:</span> {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '4px' }}>
            <input 
              type="text" 
              placeholder="Ask Astrogator..." 
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{ flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #444', background: '#111', color: '#fff', fontSize: '10px' }}
            />
            <button type="submit" style={{ background: '#00ffff', color: '#000', border: 'none', padding: '5px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px', cursor: 'pointer' }}>Send</button>
          </form>
        </div>
      </div>

      <Canvas camera={{ position: [0, 40, 100], fov: 60 }}>
        <ambientLight intensity={isLanded ? 0.8 : 0.4} />
        <pointLight position={[0, 0, 0]} intensity={5} decay={0} />
        {!isLanded && <Stars radius={600} depth={100} count={20000} factor={6} fade />}

        {!isLanded && (
          <mesh>
            <sphereGeometry args={[4.5, 64, 64]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ff5500" emissiveIntensity={3.5} />
          </mesh>
        )}

        {/* Asteroid Field for Deep Space Realism */}
        {!isLanded && <AsteroidField />}

        {isLanded && selectedBody ? (
          <PlanetSurface planet={selectedBody} />
        ) : (
          planets.map((planet, index) => (
            <CelestialBody key={index} data={planet} onSelect={(p) => { setSelectedBody(p); setIsLanded(false); }} planetRefs={planetRefs} />
          ))
        )}

        <SpaceTraveller targetPlanet={selectedBody} isLanded={isLanded} planetRefs={planetRefs} />
      </Canvas>
    </div>
  );
}