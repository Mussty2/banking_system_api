import mongoose from "mongoose";
import dns from "node:dns"
import dotenv from "dotenv"

dotenv.config()

export const connectDB = async ()=> {
    try{
        if(process.env.isPublicDns){
            dns.setServers(['8.8.8.8', '8.8.4.4'])
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDb connected Sucessfully")
    }catch(error){
        console.error("❌ DB connection failed: ",error.message)
        process.exit(1)
    }
}