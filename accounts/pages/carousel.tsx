import { useEffect, useRef, useState } from "react";

export default function TestCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const items = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];

  const updateActive = () => {
    const container = carouselRef.current;
    if (!container) return;

    const cards = Array.from(container.children) as HTMLElement[];
    const center = container.getBoundingClientRect().left + container.offsetWidth / 2;

    let closest = 0;
    let closestDist = Infinity;

    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });

    setActive(closest);
  };

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    let t: NodeJS.Timeout;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(updateActive, 80);
    };

    container.addEventListener("scroll", onScroll);
    updateActive();

    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f2e9",
        paddingTop: "40px",
        fontFamily: "sans-serif",
      }}
    >
      {/* Selected card shown clearly above */}
      <div
        style={{
          width: "160px",
          height: "160px",
          margin: "0 auto 35px auto",
          background: "white",
          borderRadius: "14px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#5a3e1b",
          fontWeight: "700",
          border: "2px solid #d4a64d",
          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          fontSize: "18px",
        }}
      >
        {items[active]}
      </div>

      {/* Carousel below */}
      <div
        ref={carouselRef}
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "25px",
          padding: "0 30px 40px 30px",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none;}`}</style>

        {items.map((name, i) => {
          const isActive = active === i;

          return (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: isActive ? "140px" : "110px",
                height: isActive ? "140px" : "110px",
                transition: "0.25s",
                background: "white",
                borderRadius: "14px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: "700",
                color: "#5a3e1b",
                border: isActive ? "2px solid #d4a64d" : "1px solid #d9c7a6",
                opacity: isActive ? 1 : 0.45,
                filter: isActive ? "none" : "blur(2px)",
                transform: isActive ? "scale(1.15)" : "scale(0.9)",
                scrollSnapAlign: "center",
                boxShadow: isActive ? "0 6px 16px rgba(0,0,0,0.15)" : "none",
              }}
            >
              {name}
            </div>
          );
        })}
      </div>
    </div>
  );
}