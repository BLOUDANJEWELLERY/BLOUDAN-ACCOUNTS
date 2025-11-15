import { useEffect, useRef, useState } from "react";

export default function TestCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<string[]>([]);

  const original = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];

  useEffect(() => {
    // Duplicate array to fake infinite loop
    setCards([...original, ...original]);
  }, []);

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // start scrolling from middle (for seamless loop)
    container.scrollLeft = container.scrollWidth / 2;
  }, [cards]);

  const handleScroll = () => {
    const container = carouselRef.current;
    if (!container) return;

    const half = container.scrollWidth / 2;

    // Adjust to maintain infinite loop illusion
    if (container.scrollLeft <= 10) {
      container.scrollLeft = half - 20;
    } else if (container.scrollLeft >= half * 1.5) {
      container.scrollLeft = half + 20;
    }
  };

  return (
    <div
      style={{
        background: "#f7f2e9",
        minHeight: "100vh",
        padding: "30px 0",
        display: "flex",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "15px",
          padding: "10px",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {/* hide scrollbar */}
        <style>
          {`
            div::-webkit-scrollbar { display: none; }
          `}
        </style>

        {cards.map((name, i) => (
          <div
            key={i}
            style={{
              width: "110px",
              height: "110px",
              background: "white",
              borderRadius: "12px",
              border: "1px solid #d4a64d",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontWeight: "700",
              color: "#5a3e1b",
              flexShrink: 0,
            }}
          >
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}