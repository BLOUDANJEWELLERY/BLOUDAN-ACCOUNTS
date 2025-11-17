import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [file, setFile] = useState(null);
  const [resultHtml, setResultHtml] = useState("");
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const form = new FormData();
    form.append("url", url);
    form.append("numbersText", numbersText);
    if (file) form.append("file", file);

    const res = await fetch("/api/search", { method: "POST", body: form });
    const data = await res.json();

    setResultHtml(data.html);
    setMatches(data.found || []);
    setCurrentIndex(0);

    setTimeout(() => {
      const el = document.getElementById(`match-0`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  };

  const goNext = () => {
    if (currentIndex < matches.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      document
        .getElementById(`match-${newIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      document
        .getElementById(`match-${newIndex}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div style={{ padding: 30, maxWidth: 900, margin: "0 auto" }}>
      <h1>Number Finder</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Enter webpage URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <textarea
          placeholder="Enter numbers separated by commas or new lines"
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          rows={5}
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
        />

        <input
          type="file"
          accept=".csv, .xlsx"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: 10 }}
        />

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            background: "black",
            color: "white",
            border: "none",
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          Search
        </button>
      </form>

      {matches.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={goPrev} style={{ marginRight: 10 }}>
            ⬅ Previous
          </button>
          <button onClick={goNext}>Next ➡</button>
          <p>
            Showing {currentIndex + 1} of {matches.length}
          </p>
        </div>
      )}

      {resultHtml && (
        <div
          dangerouslySetInnerHTML={{ __html: resultHtml }}
          style={{
            border: "1px solid #ddd",
            padding: 20,
            borderRadius: 6,
            background: "#fafafa",
          }}
        />
      )}
    </div>
  );
}