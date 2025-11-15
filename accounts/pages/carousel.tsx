import { useEffect, useRef, useState } from "react";

export default function WheelCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(2);

  const baseItems = [
    { name: "Customer", color: "#3b82f6" },
    { name: "Supplier", color: "#10b981" },
    { name: "Wholesaler", color: "#f59e0b" },
    { name: "Investor", color: "#ef4444" },
    { name: "Internal", color: "#8b5cf6" },
  ];

  // Create extended array for infinite scroll
  const items = [...baseItems, ...baseItems, ...baseItems];

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

    const baseIndex = closest % baseItems.length;
    setActive(baseIndex);
  };

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // Start in the middle of extended array
    const middleIndex = baseItems.length;
    const firstCard = container.children[middleIndex] as HTMLElement;
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth;
      const gap = 20;
      container.scrollLeft = middleIndex * (cardWidth + gap);
    }

    let t: NodeJS.Timeout;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(updateActive, 50);
    };

    container.addEventListener("scroll", onScroll);
    updateActive();

    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToItem = (index: number) => {
    const container = carouselRef.current;
    if (!container) return;

    const targetIndex = baseItems.length + index;
    const cards = Array.from(container.children) as HTMLElement[];
    if (cards[targetIndex]) {
      const card = cards[targetIndex];
      const scrollLeft = card.offsetLeft - (container.offsetWidth - card.offsetWidth) / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  };

  // Handle infinite scroll reset
  const handleScroll = () => {
    const container = carouselRef.current;
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // Reset to middle when reaching edges
    if (scrollLeft < clientWidth) {
      const jumpPoint = scrollWidth / 3;
      container.scrollLeft = jumpPoint + scrollLeft;
    } else if (scrollLeft > (2 * scrollWidth) / 3) {
      const jumpPoint = scrollWidth / 3;
      container.scrollLeft = scrollLeft - jumpPoint;
    }
  };

  const getCardStyle = (index: number, baseIndex: number) => {
    const isActive = active === baseIndex;
    const container = carouselRef.current;
    
    if (!container) return {};

    const cards = Array.from(container.children) as HTMLElement[];
    const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;
    const cardRect = cards[index]?.getBoundingClientRect();
    
    if (!cardRect) return {};

    const cardCenter = cardRect.left + cardRect.width / 2;
    const distance = Math.abs(cardCenter - containerCenter);
    
    // Wheel effect calculations
    const maxDistance = container.offsetWidth / 2;
    const distanceRatio = Math.min(1, distance / maxDistance);
    
    // Scale decreases with distance
    const scale = 1 - (distanceRatio * 0.4);
    
    // Vertical position - cards further away go lower
    const translateY = distanceRatio * 60;
    
    // Opacity decreases with distance
    const opacity = 1 - (distanceRatio * 0.7);
    
    // Blur increases with distance
    const blur = Math.min(3, distanceRatio * 4);

    if (isActive) {
      return {
        transform: "scale(1) translateY(0px)",
        opacity: 1,
        filter: "none",
        zIndex: 10,
        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.25), 0 8px 24px ${baseItems[baseIndex].color}40`,
      };
    }

    return {
      transform: `scale(${scale}) translateY(${translateY}px)`,
      opacity,
      filter: `blur(${blur}px)`,
      zIndex: Math.floor(10 - distanceRatio * 5),
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "40px 20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <h1
          style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            color: "white",
            marginBottom: "12px",
            letterSpacing: "-0.025em",
          }}
        >
          Business Partners
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "rgba(255, 255, 255, 0.8)",
            maxWidth: "500px",
            lineHeight: "1.6",
          }}
        >
          Scroll to explore different partnership types
        </p>
      </div>

      {/* Wheel Carousel Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          position: "relative",
        }}
      >
        {/* Navigation Arrows */}
        <button
          onClick={() => {
            const newIndex = (active - 1 + baseItems.length) % baseItems.length;
            scrollToItem(newIndex);
          }}
          style={{
            position: "absolute",
            left: "-60px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            color: "#374151",
            zIndex: 20,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.transform = "translateY(-50%) scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.transform = "translateY(-50%) scale(1)";
          }}
        >
          ‹
        </button>

        <button
          onClick={() => {
            const newIndex = (active + 1) % baseItems.length;
            scrollToItem(newIndex);
          }}
          style={{
            position: "absolute",
            right: "-60px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "white",
            border: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            color: "#374151",
            zIndex: 20,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.transform = "translateY(-50%) scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.transform = "translateY(-50%) scale(1)";
          }}
        >
          ›
        </button>

        {/* Wheel Carousel */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "20px",
            padding: "80px 40px 40px 40px",
            scrollSnapType: "x proximity",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            alignItems: "flex-end",
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            minHeight: "200px",
            position: "relative",
          }}
        >
          <style>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>

          {items.map((item, i) => {
            const baseIndex = i % baseItems.length;
            const isActive = active === baseIndex;

            return (
              <div
                key={i}
                onClick={() => scrollToItem(baseIndex)}
                style={{
                  flexShrink: 0,
                  width: "120px",
                  height: "120px",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  background: "white",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  fontWeight: "600",
                  color: isActive ? "#1f2937" : "#6b7280",
                  border: `2px solid ${isActive ? item.color : "rgba(0, 0, 0, 0.1)"}`,
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  ...getCardStyle(i, baseIndex),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = e.currentTarget.style.transform.replace(/scale\([^)]*\)/, "scale(0.9)");
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    setTimeout(() => {
                      if (e.currentTarget) {
                        Object.assign(e.currentTarget.style, getCardStyle(i, baseIndex));
                      }
                    }, 10);
                  }
                }}
              >
                {/* Background Accent */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "3px",
                    background: item.color,
                    opacity: isActive ? 1 : 0.5,
                  }}
                />
                
                {/* Icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: item.color,
                    opacity: isActive ? 0.9 : 0.6,
                    marginBottom: "8px",
                  }}
                />
                
                {item.name}
                
                {/* Active Indicator */}
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: item.color,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Active Item Display */}
        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
            padding: "16px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "600",
              color: "white",
              marginBottom: "4px",
            }}
          >
            {baseItems[active].name}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Currently Selected
          </div>
        </div>

        {/* Dots Indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "8px",
            marginTop: "20px",
          }}
        >
          {baseItems.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToItem(i)}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                border: "none",
                background: i === active ? "white" : "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (i !== active) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.7)";
                }
              }}
              onMouseLeave={(e) => {
                if (i !== active) {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          textAlign: "center",
          marginTop: "40px",
          color: "rgba(255, 255, 255, 0.7)",
          fontSize: "0.9rem",
        }}
      >
        Scroll or click to navigate • Infinite scrolling enabled
      </div>
    </div>
  );
}