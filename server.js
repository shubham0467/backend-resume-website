require("dotenv").config();

const express = require("express");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const cors = require("cors");
const nodemailer = require("nodemailer");
const axios = require("axios");
const UAParser = require("ua-parser-js");
const { HfInference } = require("@huggingface/inference");
const { Pool } = require("pg");

const app = express();

app.use(express.json());
app.use(cors());

/* -------- HuggingFace -------- */

const hf = new HfInference(process.env.HF_TOKEN);

/* -------- PostgreSQL -------- */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max:5
});

/* -------- Email Setup -------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* -------- Load Resume -------- */

let resumeText = "";

async function loadResume() {
  try {
    const buffer = fs.readFileSync("./resume.pdf");
    const data = await pdfParse(buffer);

    resumeText = data.text.substring(0, 6000);

    console.log("Resume loaded");
  } catch (err) {
    console.error("Resume load error:", err);
    resumeText = "Resume not available";
  }
}

/* -------- Track Visitor -------- */

app.post("/track-visit", async (req, res) => {

  try {

    const ip = req.ip === "::1" ? "8.8.8.8" : req.ip;

    let country = "Unknown";

    try {
      const geo = await axios.get(`http://ip-api.com/json/${ip}`);
      country = geo.data.country;
    } catch {
      console.log("Geo lookup failed");
    }

    const parser = new UAParser(req.headers["user-agent"]);

    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    const device = parser.getDevice().type || "Desktop";

    const referrer = req.headers.referer || "Direct";
    const page = req.body.page;

    await pool.query(
      `INSERT INTO visitors 
      (ip,country,browser,os,device,referrer,page)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [ip, country, browser, os, device, referrer, page]
    );

    res.json({ status: "tracked" });

  } catch (err) {

    console.error("Track error:", err);

    res.status(500).json({ error: "Tracking failed" });

  }

});

/* -------- AI Chat -------- */

app.post("/chat", async (req, res) => {

  try {

    const question = req.body.message;

    const response = await hf.chatCompletion({

      model: "meta-llama/Llama-3.1-70B-Instruct",

      messages: [
        {
          role: "system",
          content: `You are a strict assistant for Shubham Pal's portfolio.

RULES:
- Only answer using the resume text.
- If info not present say "Information not available."

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

  } catch (err) {

    console.error("Chat error:", err);

    res.status(500).json({ reply: "AI service error" });

  }

});

/* -------- Contact Form -------- */

app.post("/contact", async (req, res) => {

  try {

    const { name, email, message } = req.body;

    await pool.query(
      `INSERT INTO contacts (name,email,message)
       VALUES ($1,$2,$3)`,
      [name, email, message]
    );

    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Portfolio Message from ${name}`,
      html: `
        <h3>New Portfolio Contact</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p>${message}</p>
      `
    });

    res.json({ success: true });

  } catch (err) {

    console.error("Email error:", err);

    res.status(500).json({ success: false });

  }

});

/* -------- Analytics -------- */

app.get("/analytics", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM visitors ORDER BY visit_time DESC"
    );

    res.json({
      totalVisitors: result.rows.length,
      visits: result.rows
    });

  } catch (err) {

    res.status(500).json({ error: "Analytics error" });

  }

});

/* -------- Admin Analytics -------- */

app.get("/admin-analytics", async (req, res) => {

  const password = req.query.password;

if (password !== process.env.ADMIN_PASSWORD){
      return res.status(401).json({ error: "Unauthorized" });
  }

  const result = await pool.query(
    "SELECT * FROM visitors ORDER BY visit_time DESC"
  );

  res.json({
    totalVisitors: result.rows.length,
    visits: result.rows
  });

});

/* -------- Health -------- */

app.get("/", (req,res)=>{
  res.send("AI Resume Chatbot Running");
});

/* -------- Start Server -------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {

  await loadResume();

  console.log(`Server running on port ${PORT}`);

});