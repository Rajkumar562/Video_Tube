import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" })); // Allow JSON body parsing with a limit of 16kb
app.use(express.urlencoded({ extended: true, limit: "16kb" })); // Allows url encoding which encodes space characters in url with a limit of 16kb.Extended here allows parsing nested objects in form data. Used for form submissions

app.use(express.static("public")); // Serve static files from the public directory like images and icons
app.use(cookieParser());

// routes
import userRouter from "./routes/user.routes.js";

app.use("api/v1/users", userRouter);

export { app };
