import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`MongoDB Connected: ${connectInstance.connection.host}`);
  } catch (error) {
    console.log("Failed to Connect to MongoDB ", error);
    process.exit(1); // 0 means success, any non-zero means failure / something went wrong
  }
};

export default connectDB;
// connectInstance provides the connection object which has host, port, name keys
