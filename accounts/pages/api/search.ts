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
      return res
        .status(400)
        .json({ error: "Unable to fetch webpage" });
    }

    let html = await response.text();
    const results: any[] = [];

    // Highlight every number
    numbers.forEach((num) => {
      const regex = new RegExp(num, "g");

      const matchCount = (html.match(regex) || []).length;

      // Add result info
      results.push({
        number: num,
        found: matchCount > 0,
        count: matchCount,
      });

      // Inject highlighting
      html = html.replace(
        regex,
        `<mark style="background: yellow; color: black; padding: 2px; border-radius: 3px;">${num}</mark>`
      );
    });

    return res.status(200).json({
      results,
      highlightedHtml: html,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Server error fetching webpage",
    });
  }
}