"use client";
import { useEffect, useRef, useState } from "react";

export default function WheelPickerPage() {
  const items = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];
  const itemHeight = 50;
  const wheelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(items[0]);

  const spacer = <div style={{ height: itemHeight * 2 }} />;

  const scrollToValue = (value: string) => {
    const index = items.indexOf(value);
    if (index === -1 || !wheelRef.current) return;
    wheelRef.current.scrollTo({
      top: index * itemHeight,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!wheelRef.current) return;
    const index = Math.round(wheelRef.current.scrollTop / itemHeight);
    const value = items[index];
    if (value !== selected) setSelected(value);
  };

  // Initialize scroll to selected
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
          height: itemHeight * 5,
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
                height: itemHeight,
                lineHeight: `${itemHeight}px`,
                fontSize: isSelected ? "20px" : "16px",
                fontWeight: isSelected ? 700 : 400,
                color: isSelected ? "#d4a64d" : "#5a3e1b",
                transition: "all 0.2s",
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