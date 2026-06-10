```javascript
const express = require("express");
const app = express();
app.use(express.json());

const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

const PORT = process.env.PORT || 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.post("/generate", async (req, res) => {
  const clientKey = req.headers["x-secret-key"];
  if (!clientKey || clientKey !== SECRET_KEY) {
    return res.status(401).json({ error: "Unauthorized. Invalid secret key." });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in request body." });
  }

  try {
    const startResponse = await fetch(
      "https://api.replicate.com/v1/models/luma/ray-2/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({ input: { prompt: prompt } }),
      }
    );

    let prediction = await startResponse.json();

    if (!prediction.id) {
      return res.status(500).json({ error: "Failed to start prediction.", details: prediction });
    }

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      const status = prediction.status;

      if (status === "succeeded") {
        const videoUrl = Array.isArray(prediction.output)
          ? prediction.output[0]
          : prediction.output;
        return res.json({ success: true, videoUrl });
      }

      if (status === "failed" || status === "canceled") {
        return res.status(500).json({ error: "Video generation failed.", details: prediction.error || status });
      }

      await sleep(5000);
      attempts++;

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` } }
      );
      prediction = await pollResponse.json();
    }

    return res.status(504).json({ error: "Timed out after 5 minutes." });

  } catch (err) {
    return res.status(500).json({ error: "Internal server error.", details: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Video generation server is running!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```
