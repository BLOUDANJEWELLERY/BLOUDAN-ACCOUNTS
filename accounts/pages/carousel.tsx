import { useEffect, useRef, useState } from "react";

function useWheelSelector(
  containerRef: React.RefObject<HTMLDivElement | null>,
  horizontal = false
) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeout: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const children = Array.from(container.children) as HTMLElement[];

        const center = horizontal
          ? container.getBoundingClientRect().left + container.offsetWidth / 2
          : container.getBoundingClientRect().top + container.offsetHeight / 2;

        let closest = 0;
        let minDist = Infinity;

        children.forEach((child, i) => {
          const rect = child.getBoundingClientRect();
          const childCenter = horizontal
            ? rect.left + rect.width / 2
            : rect.top + rect.height / 2;

          const dist = Math.abs(childCenter - center);
          if (dist < minDist) {
            minDist = dist;
            closest = i;
          }
        });

        setActive(closest);
      }, 50);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, horizontal]);

  return active;
}

export default function WheelBoth() {
  const items = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];

  const verticalRef = useRef<HTMLDivElement | null>(null);
  const horizontalRef = useRef<HTMLDivElement | null>(null);

  const activeVertical = useWheelSelector(verticalRef, false);
  const activeHorizontal = useWheelSelector(horizontalRef, true);

  return (
    <div
      style={{
        background: "#f7f2e9",
        minHeight: "100vh",
        padding: "40px 0",
        fontFamily: "sans-serif",
      }}
    >
      {/* ---------- Vertical Wheel ---------- */}
      <h2 style={{ textAlign: "center", color: "#5a3e1b", marginBottom: "20px" }}>
        Vertical Wheel
      </h2>

      <div
        ref={verticalRef}
        style={{
          width: "200px",
          height: "220px",
          margin: "0 auto 60px auto",
          overflowY: "auto",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
          scrollbarWidth: "none",
          position: "relative",
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {items.map((item, i) => {
          const offset = Math.abs(i - activeVertical);
          const scale = 1 - offset * 0.15;
          const opacity = 1 - offset * 0.3;
          const rotate = (i - activeVertical) * 12;

          return (
            <div
              key={i}
              style={{
                height: "55px",
                margin: "10px 0",
                background: "white",
                borderRadius: "12px",
                border:
                  i === activeVertical
                    ? "2px solid #d4a64d"
                    : "1px solid #d9c7a6",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: 700,
                color: "#5a3e1b",
                fontSize: "17px",
                transform: `
                  scale(${scale})
                  rotateX(${rotate}deg)
                `,
                opacity,
                transition: "0.25s",
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* ---------- Horizontal Wheel ---------- */}
      <h2 style={{ textAlign: "center", color: "#5a3e1b", marginBottom: "20px" }}>
        Horizontal Wheel
      </h2>

      <div
        ref={horizontalRef}
        style={{
          height: "150px",
          display: "flex",
          overflowX: "auto",
          scrollbarWidth: "none",
          gap: "20px",
          padding: "20px 40px",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
      >
        <style>{`div::-webkit-scrollbar { display:none; }`}</style>

        {items.map((item, i) => {
          const offset = Math.abs(i - activeHorizontal);
          const scale = 1 - offset * 0.15;
          const opacity = 1 - offset * 0.3;
          const rotate = (i - activeHorizontal) * -18;

          return (
            <div
              key={i}
              style={{
                width: "110px",
                height: "110px",
                background: "white",
                borderRadius: "12px",
                border:
                  i === activeHorizontal
                    ? "2px solid #d4a64d"
                    : "1px solid #d9c7a6",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: 700,
                color: "#5a3e1b",
                fontSize: "16px",
                transform: `
                  scale(${scale})
                  rotateY(${rotate}deg)
                `,
                opacity,
                transition: "0.25s",
                flexShrink: 0,
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}