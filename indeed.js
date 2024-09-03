import express from "express";
import fetch from "node-fetch";
import { gotScraping } from "got-scraping";
import * as cheerio from "cheerio";

const app = express();
const port = 3000;

function jsonify(html) {
  const $ = cheerio.load(html);
  const script = $("#mosaic-data");
  const scriptText = script.html().split("\n");
  const mosaicProviderJobcardsLine = scriptText.find((line) =>
    line.includes("mosaic-provider-jobcards")
  );
  const mosaicProviderJobcardsLineText = mosaicProviderJobcardsLine.slice(
    0,
    mosaicProviderJobcardsLine.length - 1
  );
  const mosaicProviderJobcardsJSON = JSON.parse(
    mosaicProviderJobcardsLineText.replace(
      'window.mosaic.providerData["mosaic-provider-jobcards"]=',
      ""
    )
  );
  const jobs =
    mosaicProviderJobcardsJSON?.metaData?.mosaicProviderJobCardsModel?.results;
  return jobs;
}

async function getIndeedJobs(query, page = 1, retries = 0) {
  try {
    let start = (page - 1) * 10;
    const res = await gotScraping({
      url: `https://www.indeed.com/jobs?q=${encodeURIComponent(
        query.split(" ").join("+")
      )}&l=Austin%2C+TX&radius=50&start=${start}`,
    });

    if (res.statusCode !== 200) {
      throw new Error("status code not 200");
    }

    return jsonify(res.body);
  } catch (err) {
    if (retries < 5) {
      return getIndeedJobs(query, page, retries + 1);
    }
    console.log("Error at getIndeedJobs:", err.message);
    return null;
  }
}

app.get("/jobs", async (req, res) => {
  const query = req.query.query || "architect"; // default to 'architect' if query is not provided
  const page = parseInt(req.query.page, 10) || 1;

  try {
    const jobs = await getIndeedJobs(query, page);
    if (!jobs) {
      return res.status(500).json({ error: "Failed to fetch job data" });
    }
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
