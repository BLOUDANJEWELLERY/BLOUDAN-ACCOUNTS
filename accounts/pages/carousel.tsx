import { useEffect, useRef, useState } from "react";

export default function TestCarousel() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActive = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const cards = Array.from(carousel.children) as HTMLElement[];
    const center = window.innerWidth / 2;

    let closestIndex = 0;
    let closestDist = Infinity;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - center);

      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let timeout: NodeJS.Timeout;

    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateActive, 120);
    };

    carousel.addEventListener("scroll", onScroll);
    updateActive();

    return () => carousel.removeEventListener("scroll", onScroll);
  }, []);

  const accountTypes = [
    { title: "Customer", desc: "For regular buyers and clients." },
    { title: "Supplier", desc: "For vendors and gold traders." },
    { title: "Wholesaler", desc: "For large-scale distribution." },
    { title: "Investor", desc: "For high-volume gold holders." },
    { title: "Internal", desc: "For staff and internal accounts." },
  ];

  return (
    <div
      style={{
        background: "#f7f2e9",
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        fontFamily: "sans-serif",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginTop: "25px",
          color: "#5a3e1b",
          fontWeight: 600,
        }}
      >
        Select Account Type
      </h2>

      <div
        ref={carouselRef}
        style={{
          marginTop: "30px",
          padding: "0 10px",
          overflowX: "auto",
          display: "flex",
          gap: "20px",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {accountTypes.map((item, index) => (
          <div
            key={index}
            style={{
              flex: "0 0 80%",
              background: "white",
              borderRadius: "12px",
              padding: "25px",
              border: activeIndex === index
                ? "1px solid #d4a64d"
                : "1px solid #d9c7a6",
              scrollSnapAlign: "center",
              textAlign: "center",
              transform: activeIndex === index ? "scale(1.04)" : "scale(1)",
              transition: "transform 0.25s ease, box-shadow 0.25s ease",
              boxShadow:
                activeIndex === index
                  ? "0 6px 14px rgba(0,0,0,0.15)"
                  : "none",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                marginBottom: "10px",
                color: "#5a3e1b",
                fontWeight: 700,
              }}
            >
              {item.title}
            </div>
            <div
              style={{
                fontSize: "15px",
                color: "#7d674c",
              }}
            >
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}