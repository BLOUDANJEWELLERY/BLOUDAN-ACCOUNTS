"use client";
import { useEffect, useRef, useState } from "react";

export default function WheelPickerPage() {
  const items = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];
  const itemSize = 70; // square side
  const wheelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(items[0]);

  const spacer = <div style={{ height: itemSize * 2 }} />;

  const scrollToValue = (value: string) => {
    const index = items.indexOf(value);
    if (index === -1 || !wheelRef.current) return;
    wheelRef.current.scrollTo({
      top: index * itemSize,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!wheelRef.current) return;
    const index = Math.round(wheelRef.current.scrollTop / itemSize);
    const value = items[index];
    if (value !== selected) setSelected(value);
  };

  useEffect(() => {
    scrollToValue(selected);
  }, []);

  return (
    <div
      style={{
        background: "#f7f2e9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        padding: "60px 0",
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h2 style={{ color: "#5a3e1b", marginBottom: "20px" }}>Account Type Picker</h2>

      <div
        ref={wheelRef}
        style={{
          position: "relative",
          width: "150px",
          height: itemSize * 5,
          overflowY: "scroll",
          borderRadius: "12px",
          scrollbarWidth: "none",
          textAlign: "center",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        }}
        onScroll={() => {
          clearTimeout((wheelRef.current as any)?._scrollTimeout);
          (wheelRef.current as any)._scrollTimeout = setTimeout(handleScroll, 100);
        }}
      >
        <style>{`div::-webkit-scrollbar { display:none; }`}</style>

        {spacer}
        {items.map((item) => {
          const isSelected = item === selected;

          return (
            <div
              key={item}
              style={{
                height: itemSize,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",

                transform: isSelected ? "scale(1.05)" : "scale(0.85)",
                opacity: isSelected ? 1 : 0.5,
                transition: "all 0.25s",

                // Square card styling
                background: isSelected ? "#f1e4c2" : "#ede3d1",
                border:
                  isSelected
                    ? "2px solid #d4a64d"
                    : "1px solid rgba(90,62,27,0.2)",
                borderRadius: "10px",
                margin: "6px auto",
                width: itemSize,

                fontSize: "14px",
                fontWeight: isSelected ? 700 : 500,
                color: "#5a3e1b",
              }}
            >
              {item}
            </div>
          );
        })}
        {spacer}
      </div>

      <div style={{ marginTop: "30px", fontSize: "18px", color: "#5a3e1b" }}>
        Selected: <strong>{selected}</strong>
      </div>
    </div>
  );
}