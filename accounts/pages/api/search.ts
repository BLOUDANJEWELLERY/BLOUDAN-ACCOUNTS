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

    const html = await response.text();

    const results = numbers.map(num => ({
      number: num,
      found: html.includes(num),
      count: (html.match(new RegExp(num, "g")) || []).length,
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: "Server error fetching webpage" });
  }
}