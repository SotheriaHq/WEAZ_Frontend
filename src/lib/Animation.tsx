import { useEffect, useState } from "react";

  const AnimatedBackground = () => {
    const [doodles, setDoodles] = useState<Array<{id: number, x: number, y: number, delay: number}>>([]);

    useEffect(() => {
      const generateDoodles = () => {
        const newDoodles = [];
        for (let i = 0; i < 15; i++) {
          newDoodles.push({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            delay: Math.random() * 20,
          });
        }
        setDoodles(newDoodles);
      };

      generateDoodles();
    }, []);

    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {doodles.map((doodle) => (
          <div
            key={doodle.id}
            className="absolute text-white/5 font-bold text-6xl animate-pulse"
            style={{
              left: `${doodle.x}%`,
              top: `${doodle.y}%`,
              animationDelay: `${doodle.delay}s`,
              transform: `rotate(${Math.random() * 30 - 15}deg)`,
            }}
          >
            voguely
          </div>
        ))}
      </div>
    );
  };

  export default AnimatedBackground;