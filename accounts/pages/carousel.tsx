import { useEffect, useRef, useState } from "react";

export default function PyramidCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(2); // Start with center item active

  // Extended array for infinite scroll effect
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

    // Map back to base items for the actual active state
    const baseIndex = closest % baseItems.length;
    setActive(baseIndex);
  };

  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    // Start in the middle of the extended array for infinite scroll
    const middleIndex = baseItems.length;
    const cardWidth = 120; // Approximate card width + gap
    container.scrollLeft = middleIndex * cardWidth;

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

    const cards = Array.from(container.children) as HTMLElement[];
    const targetIndex = baseItems.length + index; // Scroll to the middle section
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

    // Reset to middle when reaching edges for infinite effect
    if (scrollLeft < clientWidth) {
      container.scrollLeft = scrollWidth / 3 + scrollLeft;
    } else if (scrollLeft > (2 * scrollWidth) / 3) {
      container.scrollLeft = scrollWidth / 3 - (scrollWidth - scrollLeft);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "60px 20px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "80px" }}>
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

      {/* Carousel Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          position: "relative",
          padding: "40px 0",
        }}
      >
        {/* Navigation Arrows */}
        <button
          onClick={() => scrollToItem((active - 1 + baseItems.length) % baseItems.length)}
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
            zIndex: 10,
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
          onClick={() => scrollToItem((active + 1) % baseItems.length)}
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
            zIndex: 10,
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

        {/* Pyramid Carousel */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          style={{
            display: "flex",
            overflowX: "auto",
            gap: "20px",
            padding: "120px 40px 40px 40px",
            scrollSnapType: "x proximity",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
            alignItems: "flex-end",
            borderRadius: "24px",
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            minHeight: "280px",
            position: "relative",
          }}
        >
          <style>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>

          {items.map((item, i) => {
            const baseIndex = i % baseItems.length;
            const isActive = active === baseIndex;
            
            // Calculate distance from center for pyramid effect
            const container = carouselRef.current;
            let distance = 0;
            if (container) {
              const cardRect = container.children[i]?.getBoundingClientRect();
              const containerCenter = container.getBoundingClientRect().left + container.offsetWidth / 2;
              if (cardRect) {
                const cardCenter = cardRect.left + cardRect.width / 2;
                distance = Math.abs(cardCenter - containerCenter);
              }
            }

            // Pyramid styling based on distance from center
            const scale = Math.max(0.7, 1 - (distance / 400));
            const opacity = Math.max(0.3, 1 - (distance / 500));
            const blur = Math.min(4, (distance / 100));
            const translateY = -Math.min(80, (distance / 2));

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
                  opacity,
                  filter: `blur(${blur}px)`,
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  scrollSnapAlign: "center",
                  boxShadow: isActive
                    ? `0 20px 40px rgba(0, 0, 0, 0.2), 0 8px 24px ${item.color}30`
                    : "0 4px 12px rgba(0, 0, 0, 0.1)",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  zIndex: isActive ? 3 : scale > 0.9 ? 2 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = `scale(${scale * 1.05}) translateY(${translateY}px)`;
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = `scale(${scale}) translateY(${translateY}px)`;
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
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
            marginTop: "32px",
            padding: "20px",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              color: "white",
              marginBottom: "8px",
            }}
          >
            {baseItems[active].name}
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              color: "rgba(255, 255, 255, 0.8)",
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
            marginTop: "24px",
          }}
        >
          {baseItems.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToItem(i)}
              style={{
                width: "10px",
                height: "10px",
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
    </div>
  );
}