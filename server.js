import express from "express"
import cors from "cors";
import dotenv from "dotenv"
import { connectDB } from "./config/db.js"
import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import beneficiaryRoutes from "./routes/beneficiary.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import cardRoutes from "./routes/card.routes.js";
import tellerRoutes from "./routes/teller.routes.js";
import auditLogRoutes from "./routes/auditlog.routes.js";
import documentRoutes from "./routes/document.routes.js";

dotenv.config()

const app = express()

app.use(cors());
app.use(express.urlencoded({ extended : true}))
app.use(express.json())

//Routes
app.use("/api/v1/auth", authRoutes); 
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/beneficiaries", beneficiaryRoutes);
app.use("/api/v1/loans", loanRoutes);
app.use("/api/v1/cards", cardRoutes);
app.use("/api/v1/teller", tellerRoutes);
app.use("/api/v1/audit-logs", auditLogRoutes);
app.use("/api/v1/documents", documentRoutes);

connectDB()
const PORT = process.env.PORT || 5000;
app.listen(PORT,() => console.log(`SERVER RUNNING  ON PORT ${PORT}`))