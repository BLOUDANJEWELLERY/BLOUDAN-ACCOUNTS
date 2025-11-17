import { useState } from "react";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [numbers, setNumbers] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);

    const nums = numbers
      .split(/[\n, ,]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, numbers: nums }),
    });

    const data = await res.json();

    setResults(data.results || []);
    setHighlightedHtml(data.highlightedHtml || "");
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "auto" }}>
      <h1>Search Numbers in Webpage</h1>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      <textarea
        value={numbers}
        onChange={(e) => setNumbers(e.target.value)}
        placeholder="Numbers…"
        rows={5}
        style={{ width: "100%", padding: 10 }}
      />

      <button
        onClick={handleSearch}
        style={{
          marginTop: 20,
          padding: 12,
          width: "100%",
          background: "black",
          color: "white",
          cursor: "pointer",
        }}
      >
        {loading ? "Searching..." : "Search"}
      </button>

      {/* RESULTS TABLE */}
      {results.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>Results</h2>
          <table
            width="100%"
            border={1}
            cellPadding={8}
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th>Number</th>
                <th>Found</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.number}</td>
                  <td>{r.found ? "Yes" : "No"}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* HIGHLIGHTED PAGE PREVIEW */}
          {highlightedHtml && (
            <div style={{ marginTop: 40 }}>
              <h2>Highlighted Page</h2>

              <div
                style={{
                  border: "1px solid #ddd",
                  padding: 20,
                  maxHeight: "600px",
                  overflowY: "scroll",
                  background: "#fff",
                }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}