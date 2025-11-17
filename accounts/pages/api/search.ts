export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url, numbers } = req.body;

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(400).json({ error: "Unable to fetch webpage" });

    const html = await response.text();

    const results = numbers.map(num => ({
      number: num,
      found: html.includes(num.toString()),
      count: (html.match(new RegExp(num.toString(), "g")) || []).length
    }));

    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: "Server error fetching webpage" });
  }
}