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

    numbers.forEach((num) => {
      let index = 0;
      const regex = new RegExp(num, "g");

      // Replace all occurrences with highlighted mark tags
      html = html.replace(regex, () => {
        index++;
        return `<mark id="mark-${num}-${index}" style="background: yellow; color: black; padding: 2px; border-radius: 3px;">${num}</mark>`;
      });

      results.push({
        number: num,
        found: index > 0,
        count: index,
      });
    });

    return res.status(200).json({
      results,
      highlightedHtml: html,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error fetching webpage" });
  }
}