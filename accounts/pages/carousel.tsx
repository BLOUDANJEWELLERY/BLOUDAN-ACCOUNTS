"use client";
import { useEffect, useRef, useState } from "react";

export default function InfiniteWheelPicker() {
  const BASE_ITEMS = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];
  const itemSize = 70;
  const wheelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(BASE_ITEMS[0]);

  // Build infinite loop by cloning items 50 times
  const LOOP_ITEMS = Array(50)
    .fill(0)
    .flatMap(() => BASE_ITEMS);

  const middleStart = BASE_ITEMS.length * 25; // Drop user in the middle of the loop

  const spacer = <div style={{ height: itemSize * 2 }} />;

  const snapToCenter = () => {
    if (!wheelRef.current) return;

    const scroll = wheelRef.current.scrollTop;
    const index = Math.round(scroll / itemSize);
    const item = LOOP_ITEMS[index % LOOP_ITEMS.length];

    setSelected(item);

    wheelRef.current.scrollTo({
      top: index * itemSize,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    if (!wheelRef.current) return;

    // Go to center of infinite list so user can scroll both ways
    wheelRef.current.scrollTo({
      top: middleStart * itemSize,
      behavior: "instant"
    });

    setSelected(BASE_ITEMS[0]);
  }, []);

  return (
    <div
      style={{
        background: "#f7f2e9",
        minHeight: "100vh",
        paddingTop: 60,
        display: "flex",
        justifyContent: "flex-start",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2 style={{ color: "#5a3e1b", marginBottom: 20 }}>Account Type</h2>

      {/* Wheel Container */}
      <div
        style={{
          position: "relative",
          width: 150,
          height: itemSize * 5,
          overflowY: "scroll",
          scrollbarWidth: "none",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
        ref={wheelRef}
        onScroll={() => {
          clearTimeout((wheelRef.current as any)?._scrollTimeout);
          (wheelRef.current as any)._scrollTimeout = setTimeout(snapToCenter, 120);
        }}
      >
        <style>{`div::-webkit-scrollbar { display:none; }`}</style>

        {spacer}

        {LOOP_ITEMS.map((item, i) => {
          const scroll = wheelRef.current?.scrollTop ?? 0;
          const centerIndex = Math.round(scroll / itemSize);
          const isSelected = i === centerIndex;

          return (
            <div
              key={i}
              style={{
                height: itemSize,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",

                transform: isSelected ? "scale(1.08)" : "scale(0.85)",
                opacity: isSelected ? 1 : 0.5,
                transition: "all 0.25s",

                width: itemSize,
                margin: "6px auto",

                background: isSelected ? "#f1e4c2" : "#ede3d1",
                border: isSelected
                  ? "2px solid #d4a64d"
                  : "1px solid rgba(90,62,27,0.25)",

                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: "#5a3e1b",
              }}
            >
              {item}
            </div>
          );
        })}

        {spacer}
      </div>

      {/* Highlight Area Overlay */}
      <div
        style={{
          position: "absolute",
          top: 60 + itemSize * 2, // align in middle of the wheel
          width: 150,
          height: itemSize,
          borderRadius: 12,
          border: "2px dashed #d4a64d",
          pointerEvents: "none",
        }}
      />

      {/* Selected display */}
      <div style={{ marginTop: 40, fontSize: 18, color: "#5a3e1b" }}>
        Selected: <strong>{selected}</strong>
      </div>
    </div>
  );
}