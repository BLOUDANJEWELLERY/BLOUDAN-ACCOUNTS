import { useEffect, useRef, useState } from "react";

export default function ProfessionalCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const items = [
    { name: "Customer", color: "#3b82f6" },
    { name: "Supplier", color: "#10b981" },
    { name: "Wholesaler", color: "#f59e0b" },
    { name: "Investor", color: "#ef4444" },
    { name: "Internal", color: "#8b5cf6" },
  ];

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

  const scrollToItem = (index: number) => {
    const container = carouselRef.current;
    if (!container) return;

    const cards = Array.from(container.children) as HTMLElement[];
    if (cards[index]) {
      const card = cards[index];
      const scrollLeft = card.offsetLeft - (container.offsetWidth - card.offsetWidth) / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
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
      {/* Main Content Container */}
      <div
        style={{
          maxWidth: "1200px",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "60px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center" }}>
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
            Select a partner type to explore tailored solutions and services
          </p>
        </div>

        {/* Selected Card - Prominently Displayed */}
        <div
          style={{
            width: "320px",
            height: "200px",
            background: "white",
            borderRadius: "20px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "#1f2937",
            fontWeight: "600",
            border: `3px solid ${items[active].color}`,
            boxShadow: `
              0 20px 40px rgba(0, 0, 0, 0.1),
              0 8px 24px rgba(0, 0, 0, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.6)
            `,
            fontSize: "1.5rem",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          {/* Background Accent */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: items[active].color,
            }}
          />
          
          {/* Icon Placeholder */}
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${items[active].color}20, ${items[active].color}40)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "16px",
              border: `2px solid ${items[active].color}30`,
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                background: items[active].color,
                opacity: 0.8,
              }}
            />
          </div>
          
          {items[active].name}
          <div
            style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              fontWeight: "400",
              marginTop: "8px",
            }}
          >
            Currently Selected
          </div>
        </div>

        {/* Carousel Container */}
        <div
          style={{
            width: "100%",
            maxWidth: "900px",
            position: "relative",
          }}
        >
          {/* Navigation Arrows */}
          <button
            onClick={() => scrollToItem(active > 0 ? active - 1 : items.length - 1)}
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
            onClick={() => scrollToItem(active < items.length - 1 ? active + 1 : 0)}
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

          {/* Carousel */}
          <div
            ref={carouselRef}
            style={{
              display: "flex",
              overflowX: "auto",
              gap: "20px",
              padding: "60px 40px",
              scrollSnapType: "x mandatory",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              alignItems: "center",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            <style>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>

            {items.map((item, i) => {
              const isActive = active === i;
              const distance = Math.abs(i - active);
              const scale = Math.max(0.8, 1 - distance * 0.1);
              const opacity = Math.max(0.3, 1 - distance * 0.3);
              const blur = distance > 1 ? "4px" : distance > 0 ? "2px" : "0px";

              return (
                <div
                  key={i}
                  onClick={() => scrollToItem(i)}
                  style={{
                    flexShrink: 0,
                    width: "160px",
                    height: "120px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: "white",
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    fontWeight: "600",
                    color: isActive ? "#1f2937" : "#6b7280",
                    border: `2px solid ${isActive ? item.color : "rgba(0, 0, 0, 0.1)"}`,
                    opacity,
                    filter: `blur(${blur})`,
                    transform: `scale(${scale})`,
                    scrollSnapAlign: "center",
                    boxShadow: isActive
                      ? `0 12px 32px rgba(0, 0, 0, 0.15), 0 4px 8px ${item.color}20`
                      : "0 4px 12px rgba(0, 0, 0, 0.1)",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.transform = `scale(${scale * 1.05})`;
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.transform = `scale(${scale})`;
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
                </div>
              );
            })}
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
            {items.map((_, i) => (
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
    </div>
  );
}