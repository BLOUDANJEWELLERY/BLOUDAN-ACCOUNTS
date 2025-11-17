import { useState } from "react";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [numbers, setNumbers] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);

    const nums = numbers
      .split(/[\n, ]+/)
      .map(n => n.trim())
      .filter(Boolean);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, numbers: nums })
    });

    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "auto" }}>
      <h1>Search Numbers in Webpage</h1>

      <label>Webpage URL</label>
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com"
        style={{ width: "100%", padding: "10px", marginBottom: "20px" }}
      />

      <label>Numbers (comma or line separated)</label>
      <textarea
        value={numbers}
        onChange={e => setNumbers(e.target.value)}
        placeholder="12345
67890
24680"
        rows={6}
        style={{ width: "100%", padding: "10px" }}
      />

      <button
        onClick={handleSearch}
        style={{
          marginTop: "20px",
          padding: "12px 24px",
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
          width: "100%"
        }}
      >
        {loading ? "Searching..." : "Search"}
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: "40px" }}>
          <h2>Results</h2>
          <table width="100%" border={1} cellPadding={8} style={{ borderCollapse: "collapse" }}>
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
        </div>
      )}
    </div>
  );
}