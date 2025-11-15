"use client";
import { useEffect, useRef, useState } from "react";

export default function InfiniteWheelPicker() {
  const BASE_ITEMS = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];
  const itemSize = 70; // square card size
  const wheelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(BASE_ITEMS[0]);

  // Make infinite loop
  const LOOP_ITEMS = Array(50)
    .fill(0)
    .flatMap(() => BASE_ITEMS);

  const middleStart = BASE_ITEMS.length * 25;

  const snapToCenter = () => {
    if (!wheelRef.current) return;

    const scroll = wheelRef.current.scrollTop;

    // CENTER INDEX is the one in the middle of visible area
    const centerIndex = Math.round((scroll + itemSize * 1.5) / itemSize);

    const item = LOOP_ITEMS[centerIndex % LOOP_ITEMS.length];
    setSelected(item);

    // Snap the selected card exactly to center
    wheelRef.current.scrollTo({
      top: centerIndex * itemSize - itemSize * 1.5,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!wheelRef.current) return;

    // Move user to middle of loop
    wheelRef.current.scrollTo({
      top: middleStart * itemSize,
      behavior: "instant",
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
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <h2 style={{ color: "#5a3e1b", marginBottom: 20 }}>Account Type</h2>

      {/* Wheel container */}
      <div
        ref={wheelRef}
        onScroll={() => {
          clearTimeout((wheelRef.current as any)?._scrollTimeout);
          (wheelRef.current as any)._scrollTimeout = setTimeout(snapToCenter, 120);
        }}
        style={{
          position: "relative",
          width: 150,
          height: itemSize * 3, // ONLY show 3 cards full height
          overflowY: "scroll",
          scrollbarWidth: "none",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
        }}
      >
        <style>{`div::-webkit-scrollbar { display:none; }`}</style>

        {LOOP_ITEMS.map((item, i) => {
          const scroll = wheelRef.current?.scrollTop ?? 0;
          
          // The item index at the vertical center
          const centerIndex = Math.round((scroll + itemSize * 1.5) / itemSize);

          const isSelected = i === centerIndex;

          return (
            <div
              key={i}
              style={{
                height: itemSize,
                width: itemSize,
                margin: "8px auto",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",

                background: isSelected ? "#f1e4c2" : "#ede3d1",
                border: isSelected
                  ? "2px solid #d4a64d"
                  : "1px solid rgba(90,62,27,0.25)",
                borderRadius: 10,

                transform: isSelected ? "scale(1.07)" : "scale(0.85)",
                opacity: isSelected ? 1 : 0.5,
                fontWeight: isSelected ? 700 : 500,
                color: "#5a3e1b",
                transition: "all 0.25s",
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* CENTER highlight band */}
      <div
        style={{
          position: "absolute",
          top: 60 + itemSize, // perfectly centers between 3 cards
          width: 150,
          height: itemSize,
          borderRadius: 12,
          border: "2px dashed #d4a64d",
          pointerEvents: "none",
        }}
      />

      <div style={{ marginTop: 40, fontSize: 18, color: "#5a3e1b" }}>
        Selected: <strong>{selected}</strong>
      </div>
    </div>
  );
}