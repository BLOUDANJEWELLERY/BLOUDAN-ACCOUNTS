"use client";

import { useEffect } from "react";

export default function AccountPickerPage() {
  useEffect(() => {
    createAccountPicker();
  }, []);

  const createAccountPicker = () => {
    const items = ["Customer", "Supplier", "Wholesaler", "Investor", "Internal"];

    const container = document.getElementById("wheel-container");
    const highlight = document.getElementById("highlight-bar");

    // Make infinite list
    const loopItems = [];
    for (let i = 0; i < 40; i++) loopItems.push(...items);

    const render = () => {
      container.innerHTML = "";

      // Top spacer for centering
      const topSpacer = document.createElement("div");
      topSpacer.className = "spacer";
      container.appendChild(topSpacer);

      loopItems.forEach((name) => {
        const card = document.createElement("div");
        card.className = "wheel-card";
        card.textContent = name;
        container.appendChild(card);
      });

      // Bottom spacer
      const bottomSpacer = document.createElement("div");
      bottomSpacer.className = "spacer";
      container.appendChild(bottomSpacer);
    };

    render();

    const cardHeight = 80; // one square card height
    const centerOffset = cardHeight * 1.5; // middle of 3 cards shown

    // Start in the middle of the infinite loop
    container.scrollTo({
      top: (loopItems.length / 2) * cardHeight,
      behavior: "instant",
    });

    const updateSelection = () => {
      const scroll = container.scrollTop;
      const index = Math.round((scroll + centerOffset) / cardHeight);
      const cards = container.querySelectorAll(".wheel-card");

      cards.forEach((c, i) => {
        if (i === index) {
          c.classList.add("selected");
          animateSelection(c);
        } else {
          c.classList.remove("selected");
        }
      });

      // Snap card into perfect center
      container.scrollTo({
        top: index * cardHeight - centerOffset,
        behavior: "smooth",
      });
    };

    container.addEventListener("scroll", () => {
      clearTimeout(container._scrollTimeout);
      container._scrollTimeout = setTimeout(updateSelection, 120);
    });

    container.addEventListener("wheel", (e) => {
      e.preventDefault();
      container.scrollTop += e.deltaY;
    }, { passive: false });

    container.addEventListener("touchend", updateSelection);
    container.addEventListener("mouseup", updateSelection);
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.title}>Account Picker</h2>

      <div id="picker-wrapper" style={styles.wrapper}>
        <div id="wheel-container" style={styles.wheel}></div>

        <div id="highlight-bar" style={styles.highlight}></div>
      </div>
    </div>
  );
}

function animateSelection(card) {
  card.style.transition = "transform 0.1s ease";
  card.style.transform = "scale(1.2)";
  setTimeout(() => {
    card.style.transform = "scale(1.1)";
  }, 100);
}

const styles = {
  page: {
    background: "#f7f2e9",
    minHeight: "100vh",
    paddingTop: "60px",
    textAlign: "center",
    fontFamily: "sans-serif",
  },
  title: {
    color: "#5a3e1b",
    marginBottom: "25px",
  },
  wrapper: {
    position: "relative",
    width: "180px",
    margin: "0 auto",
  },
  wheel: {
    height: "240px", // shows 3 cards perfectly
    overflowY: "scroll",
    scrollbarWidth: "none",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, black 35%, black 65%, transparent 100%)",
  },
  highlight: {
    position: "absolute",
    top: "80px", // center card
    width: "100%",
    height: "80px",
    border: "2px dashed #d4a64d",
    borderRadius: "12px",
    pointerEvents: "none",
  },
};