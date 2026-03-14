require("dotenv").config();

const express = require("express");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { HfInference } = require("@huggingface/inference");

const app = express();
const axios = require("axios");
const UAParser = require("ua-parser-js"); 

app.use(express.json());
app.use(cors());

const hf = new HfInference(process.env.HF_TOKEN);

console.log("HF Token:", process.env.HF_TOKEN ? "Loaded" : "Missing");
console.log("Port:", process.env.PORT ? process.env.PORT : "Not specified");

let resumeText = "";
const visits = [];
/* Track visitor */
app.post("/track-visit", async (req, res) => {

  const ip = req.ip === "::1" ? "8.8.8.8" : req.ip; // localhost fix

  let country = "Unknown";

  try {

    const geo = await axios.get(`http://ip-api.com/json/${ip}`);

    country = geo.data.country;

  } catch (err) {
    console.log("Geo lookup failed");
  }

  const parser = new UAParser(req.headers["user-agent"]);
  const browser = parser.getBrowser().name;
  const os = parser.getOS().name;

  const visit = {
    ip: ip,
    userAgent: req.headers["user-agent"],
    page: req.body.page,
    browser: browser,
    os: os,
    device :parser.getDevice().type || "Desktop",
    referrer: req.headers.referer || "Direct",
    country: country,
    time: new Date()
  };

  visits.push(visit);

  res.json({ status: "tracked" });

});

/* -------- Email Transport -------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* -------- Load Resume Once -------- */

async function loadResume() {

  try {

    const buffer = fs.readFileSync("./resume.pdf");

    const data = await pdfParse(buffer);

    resumeText = data.text.substring(0, 6000);

    console.log("Resume loaded successfully");
    console.log("Resume text length:", resumeText.length);

  } catch (err) {

    console.error("Resume loading error:", err);

    resumeText = "Resume not available";

  }

}

/* -------- Chat Endpoint -------- */

app.post("/chat", async (req, res) => {

  try {

    const question = req.body.message;

    const response = await hf.chatCompletion({

      model: "meta-llama/Llama-3.1-70B-Instruct",

      messages: [

        {
          role: "system",
          content: `You are a strict, factual AI assistant for Shubham Pal's portfolio.

RULES:
- ONLY answer using the resume text.
- If information is not present, say "Information not available."
- Shubham graduated in 2023.

Resume:
${resumeText}`
        },

        {
          role: "user",
          content: question
        }

      ],

      max_tokens: 150,
      temperature: 0.7

    });

    const reply = response.choices[0].message.content;

    res.json({ reply });

  } catch (error) {

    console.error("Chat error:", error);

    res.status(500).json({
      reply: "AI service error"
    });

  }

});

/* -------- Contact Form Endpoint -------- */

app.post("/contact", async (req, res) => {

  try {

    const { name, email, message } = req.body;

    await transporter.sendMail({

      from: email,

      to: process.env.EMAIL_USER,

      subject: `Portfolio Message from ${name}`,

      html: `
        <h3>New Portfolio Contact</h3>

        <p><b>Name:</b> ${name}</p>

        <p><b>Email:</b> ${email}</p>

        <p><b>Message:</b></p>

        <p>${message}</p>
      `

    });

    res.json({
      success: true,
      message: "Message sent successfully"
    });

  } catch (error) {

    console.error("Email error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send message"
    });

  }

});

/* -------- Health Endpoint -------- */

app.get("/", (req,res)=>{

  res.send("AI Resume Chatbot Running");

});

/* -------- Analytics Data -------- */
app.get("/analytics", (req, res) => {

  res.json({
    totalVisitors: visits.length,
    visits: visits
  });

});

app.get("/admin-analytics", (req, res) => {

  const password = req.query.password;

  if (password !== "admin123") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({
    totalVisitors: visits.length,
    visits: visits
  });

});

/* -------- Start Server -------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  await loadResume();

  console.log(`AI server running on http://localhost:${PORT}`);

});