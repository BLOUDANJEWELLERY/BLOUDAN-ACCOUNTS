import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, numbers } = req.body as {
    url: string;
    numbers: string[];
  };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: "Unable to fetch webpage" });
    }

    let html = await response.text();
    const results: any[] = [];
    let highlightIndex = 0;

    numbers.forEach((num) => {
      const regex = new RegExp(num, "g");
      let count = 0;

      html = html.replace(regex, () => {
        count++;
        highlightIndex++;
        return `<mark id="highlight-${highlightIndex}" data-number="${num}" style="background: yellow; color: black; padding: 2px; border-radius: 3px;">${num}</mark>`;
      });

      results.push({
        number: num,
        found: count > 0,
        count,
      });
    });

    return res.status(200).json({
      results,
      highlightedHtml: html,
      totalHighlights: highlightIndex,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error fetching webpage" });
  }
}