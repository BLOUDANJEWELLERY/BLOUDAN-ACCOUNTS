import { useState } from "react";
import * as XLSX from "xlsx";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [numbers, setNumbers] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState(0);
  const [totalHighlights, setTotalHighlights] = useState(0);

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

  const scrollToHighlight = (index: number) => {
    const container = document.getElementById("preview-container");
    if (!container) return;

    const el = container.querySelector(`#highlight-${index}`) as HTMLElement;
    if (!el) return;

    const containerTop = container.getBoundingClientRect().top;
    const elementTop = el.getBoundingClientRect().top;

    container.scrollBy({
      top: elementTop - containerTop - 20,
      behavior: "smooth",
    });
  };

  const goNext = () => {
    if (currentHighlight < totalHighlights) {
      const next = currentHighlight + 1;
      setCurrentHighlight(next);
      scrollToHighlight(next);
    }
  };

  const goPrev = () => {
    if (currentHighlight > 0) {
      const prev = currentHighlight - 1;
      setCurrentHighlight(prev);
      scrollToHighlight(prev);
    }
  };

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
    setTotalHighlights(data.totalHighlights || 0);
    setCurrentHighlight(data.totalHighlights > 0 ? 1 : 0);
    setLoading(false);

    if (data.totalHighlights > 0) {
      setTimeout(() => scrollToHighlight(1), 300);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Webpage Number Search
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Extract and highlight numbers from any webpage. Upload a spreadsheet or enter numbers manually.
          </p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-200">
          <div className="space-y-6">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Webpage URL
              </label>
              <input
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400"
              />
            </div>

            {/* Numbers Textarea */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Numbers (one per line or comma separated)
              </label>
              <textarea
                value={numbers}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNumbers(e.target.value)}
                placeholder="12345&#10;67890&#10;11223"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 resize-vertical"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Upload Spreadsheet
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">XLSX, XLS, CSV (MAX. 10MB)</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              {file && (
                <p className="mt-2 text-sm text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Selected: {file.name}
                </p>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </div>
              ) : (
                "Search Numbers"
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="space-y-8">
            {/* Results Table */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">Search Results</h2>
              
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Number</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Found</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Count</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((r, i) => (
                      <tr
                        key={i}
                        onClick={() => {
                          const firstHighlight = document.querySelector(
                            `mark[data-number="${r.number}"]`
                          ) as HTMLElement;
                          if (firstHighlight) {
                            firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {r.number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.found 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {r.found ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            {r.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Navigation */}
              {totalHighlights > 0 && (
                <div className="flex items-center justify-between mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={goPrev}
                      disabled={currentHighlight <= 1}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    
                    <button
                      onClick={goNext}
                      disabled={currentHighlight >= totalHighlights}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      Next
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  
                  <span className="text-sm text-gray-600 font-medium">
                    Highlight <span className="text-blue-600 font-bold">{currentHighlight}</span> of <span className="text-blue-600 font-bold">{totalHighlights}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Preview Section */}
            {highlightedHtml && (
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">Highlighted Page Preview</h2>
                
                <div className="relative">
                  <div
                    id="preview-container"
                    className="border-2 border-gray-200 rounded-xl p-6 max-h-96 overflow-y-auto bg-white shadow-inner prose prose-blue max-w-none"
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                  
                  {/* Scroll hint */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                    Scroll to see more content
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}