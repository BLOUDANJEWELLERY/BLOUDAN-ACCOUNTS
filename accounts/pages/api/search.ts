import formidable from "formidable";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import xlsx from "xlsx";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.json({ error: "Form parse error" });

    const url = fields.url;
    let numbersText = fields.numbersText || "";
    let file = files.file;

    let numbers = [];

    if (numbersText.trim() !== "") {
      numbers.push(
        ...numbersText.split(/[\n,]/).map((n) => n.trim()).filter(Boolean)
      );
    }

    if (file) {
      const data = fs.readFileSync(file.filepath);
      const workbook = xlsx.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const content = xlsx.utils.sheet_to_json(sheet, { header: 1 }).flat();
      numbers.push(...content.map(String));
    }

    numbers = [...new Set(numbers)];

    const page = await fetch(url);
    let html = await page.text();

    const $ = cheerio.load(html);

    let index = 0;
    let found = [];

    $("body *").each((_, el) => {
      let node = $(el);
      let text = node.html();
      if (!text) return;

      numbers.forEach((num) => {
        const regex = new RegExp(`(${num})`, "gi");
        if (regex.test(text)) {
          text = text.replace(regex, (m) => {
            const id = `match-${index}`;
            found.push({ id, value: m });
            index++;
            return `<mark id="${id}" style="background:yellow; padding:2px;">${m}</mark>`;
          });
        }
      });

      node.html(text);
    });

    res.json({
      html: $.html(),
      found,
    });
  });
}