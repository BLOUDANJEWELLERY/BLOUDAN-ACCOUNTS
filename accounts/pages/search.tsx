import { useState } from "react";
import * as XLSX from "xlsx";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [numbers, setNumbers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [loading, setLoading] = useState(false);

  // Extract numbers from spreadsheet
  const extractNumbersFromSheet = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

    const nums: string[] = [];

    json.flat().forEach((value: any) => {
      if (value !== undefined && value !== null) {
        const cleaned = value.toString().trim();
        if (/^\d+$/.test(cleaned)) nums.push(cleaned);
      }
    });

    return nums;
  };

  // Scroll preview to highlight
  const scrollToHighlight = (num: string) => {
    const container = document.getElementById("preview-container");
    if (!container) return;

    const el = container.querySelector(`#mark-${num}-1`) as HTMLElement;

    if (!el) return;

    container.scrollTo({
      top: el.offsetTop - 100,
      behavior: "smooth",
    });
  };

  // Handle search logic
  const handleSearch = async () => {
    setLoading(true);

    let nums: string[] = [];

    if (file) {
      nums = await extractNumbersFromSheet(file);
    } else {
      nums = numbers
        .split(/[\n, ]+/)
        .map((n) => n.trim())
        .filter(Boolean);
    }

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

      <label>Webpage URL</label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      <label>Numbers (optional if uploading file)</label>
      <textarea
        value={numbers}
        onChange={(e) => setNumbers(e.target.value)}
        placeholder="12345
67890"
        rows={5}
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      <label>Upload Spreadsheet (xlsx, xls, csv)</label>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ display: "block", marginBottom: "20px" }}
      />

      <button
        onClick={handleSearch}
        style={{
          marginTop: 20,
          padding: "12px 24px",
          width: "100%",
          background: "black",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Searching..." : "Search"}
      </button>

      {/* RESULTS */}
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
                <tr
                  key={i}
                  onClick={() => scrollToHighlight(r.number)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{r.number}</td>
                  <td>{r.found ? "Yes" : "No"}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PREVIEW */}
          {highlightedHtml && (
            <div style={{ marginTop: 40 }}>
              <h2>Highlighted Page</h2>

              <div
                id="preview-container"
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