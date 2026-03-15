# Portfolio AI Backend

This project is the backend server for my personal portfolio website.  
It powers an **AI-based resume chatbot, visitor analytics tracking, and contact form email service**.

The backend is built with **Node.js and Express** and integrates **LLM APIs** to answer questions about my experience and projects using my resume as context.

---

## Features

### AI Resume Chatbot
- AI chatbot that answers questions about my resume.
- Resume PDF is parsed and injected into the AI prompt.
- The AI is restricted to respond only using information from the resume.

### Resume Parsing
- Automatically loads and extracts text from `resume.pdf`.
- Implemented using **pdf-parse**.

### Visitor Analytics
Tracks portfolio visitors including:
- IP Address
- Country
- Browser
- Operating System
- Device Type
- Referrer
- Page Visited
- Timestamp

### Contact Form Email
Visitors can send messages directly from the portfolio website.  
Emails are delivered using **Nodemailer with Gmail SMTP**.

### Admin Analytics Endpoint
Provides protected analytics access for viewing visitor statistics.

---

## Tech Stack

- Node.js
- Express.js
- Hugging Face Inference API
- JavaScript
- pdf-parse
- Nodemailer
- Axios
- UA Parser
- dotenv

---


---

## Installation

Clone the repository:

git clone https://github.com/your-username/portfolio-ai-backend.git


Environment Variables
HF_TOKEN=your_huggingface_api_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
PORT=3000

