const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const connectDB = require('./config/db')
const router = require('./routes')
const webhookHandler = require('./controller/order/webhook') // 🟢 Import your webhook controller

const app = express()

// ✅ Stripe needs raw body just for webhook route
app.post('/api/webhook', express.raw({ type: 'application/json' }), webhookHandler)

// ✅ Use JSON body parser for all other routes
app.use(express.json())

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
app.use(cookieParser())

// ✅ Your normal routes
app.use("/api", router)

const PORT = process.env.PORT || 8080

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log("✅ Connected to DB")
        console.log("🚀 Server is running on port " + PORT)
    })
})
