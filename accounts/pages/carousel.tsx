import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

export default function WheelCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef(null);

  const cards = [1, 2, 3, 4, 5];

  // Calculate positions for wheel arrangement
  const getCardPosition = (index, total = cards.length) => {
    const angle = (index * 360) / total;
    const radius = 120; // Distance from center
    const radian = (angle * Math.PI) / 180;
    
    return {
      x: Math.sin(radian) * radius,
      y: -Math.cos(radian) * radius,
      rotation: angle,
      scale: index === currentIndex % total ? 1.2 : 0.9,
      zIndex: index === currentIndex % total ? 10 : 1,
      opacity: index === currentIndex % total ? 1 : 0.7
    };
  };

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => prev + 1);
      }, 2000);
    } else {
      clearInterval(autoPlayRef.current);
    }

    return () => clearInterval(autoPlayRef.current);
  }, [isAutoPlaying]);

  // Handle manual navigation
  const navigate = (direction) => {
    setIsAutoPlaying(false);
    setCurrentIndex(prev => prev + direction);
  };

  // Reset auto-play after manual interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAutoPlaying(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const displayedCards = [];
  const totalCards = cards.length;

  // Create infinite loop by displaying multiple sets
  for (let i = -2; i <= 2; i++) {
    const actualIndex = (currentIndex + i + totalCards) % totalCards;
    const position = getCardPosition(i + 2, 5); // Adjust for the 5 visible positions
    
    displayedCards.push({
      number: cards[actualIndex],
      position,
      key: `${currentIndex + i}`
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center p-8">
      <Head>
        <title>Wheel Number Carousel</title>
        <meta name="description" content="Infinite wheel carousel with numbers" />
      </Head>

      <div className="max-w-md w-full">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          Wheel Carousel
        </h1>
        
        {/* Wheel Container */}
        <div className="relative h-80 mb-12">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Center circle */}
            <div className="w-20 h-20 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-purple-600">
                  {cards[(currentIndex + totalCards) % totalCards]}
                </span>
              </div>
            </div>

            {/* Cards arranged in wheel */}
            {displayedCards.map((card, index) => (
              <div
                key={card.key}
                className="absolute w-16 h-16 transition-all duration-500 ease-in-out"
                style={{
                  transform: `translate(${card.position.x}px, ${card.position.y}px) scale(${card.position.scale}) rotate(${card.position.rotation}deg)`,
                  zIndex: card.position.zIndex,
                  opacity: card.position.opacity
                }}
              >
                <div className={`
                  w-full h-full rounded-xl shadow-2xl flex items-center justify-center text-2xl font-bold transition-all duration-500
                  ${index === 2 
                    ? 'bg-white text-purple-600 border-4 border-yellow-400' 
                    : 'bg-gray-800 text-white border-2 border-white/50'
                  }
                `}>
                  {card.number}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center space-x-6 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/50 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/50 transition-colors"
          >
            {isAutoPlaying ? (
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => navigate(1)}
            className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/50 transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Indicators */}
        <div className="flex justify-center space-x-3">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsAutoPlaying(false);
                setCurrentIndex(index);
              }}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === (currentIndex % totalCards) 
                  ? 'bg-white w-8' 
                  : 'bg-white/50'
              }`}
            />
          ))}
        </div>

        {/* Info */}
        <div className="text-center mt-8">
          <p className="text-white/80 text-sm">
            {isAutoPlaying ? 'Auto-playing' : 'Paused'} • Current: {cards[(currentIndex % totalCards + totalCards) % totalCards]}
          </p>
        </div>
      </div>
    </div>
  );
}