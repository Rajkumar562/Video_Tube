import { AsyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = AsyncHandler(async (req, res, next) => {
  try {
    // if the cookie has accessToken or the header has Authorization with Bearer token, then use that token
    const token = req.cookies?.accessToken || req.header("Authorization").replace("Bearer ", "");

    if (!token) throw new ApiError(401, "Unauthorized token");

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // this accessToken was created in user model with generateAccessToken method
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) throw new ApiError(401, "Invalid Access Token");

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Unauthorized token");
  }
});
