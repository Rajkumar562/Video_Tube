import { AsyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken; // adding a field to the user object to store the refresh token
    await user.save({ validateBeforeSave: false }); // saving the user object with the refresh token
    // this is done so that the validations added in the User model are not applied when saving the user object

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating Access and Refresh Tokens");
  }
};

const registerUser = AsyncHandler(async (req, res) => {
  const { username, email, fullName, password } = req.body;
  // console.log("req.body", req.body);

  if ([fullName, email, username, password].some((field) => field?.trim() === ""))
    throw new ApiError(400, "All fields are required");

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) throw new ApiError(409, "User already exists with this username or email");

  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
    coverImageLocalPath = req.files.coverImage[0].path;
  else coverImageLocalPath = null;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar is required");

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : "";

  if (!avatar) throw new ApiError(400, "Avatar is required");

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select("-password -refreshToken");
  // remove password and refreshToken from the user object

  if (!createdUser) throw new ApiError(500, "User not created");

  return res.status(201).json(new ApiResponse(201, createdUser, "User created successfully"));
});

const loginUser = AsyncHandler(async (req, res) => {
  const { username, password, email } = req.body;

  if (!username && !email) throw new ApiError(400, "Username or Email is required");

  // user instance
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) throw new ApiError(404, "User does not exist");

  // User is a model that exists in mongoDb and can only use functions defined explicitly in mongoose like findOne or findById
  // user is an instance of User model, so we can use methods defined in the userSchema by us like isPasswordCorrect,generateRefreshTokens and generateAccessToken
  // password extracted from req.body
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) throw new ApiError(401, "Invalid User Credentials");

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  // finding a user again because we didn't have the refreshToken for the user we found earlier, we could also have added the refreshToken to the previous user instance instead of querying again to the database
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true, // cookie will not be accessible by client-side scripts
    secure: true, // cookie will only be sent over HTTPS in production
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = AsyncHandler(async (req, res) => {
  // user is found and for the update operation we are using set to update the user and new option returns the updated user
  await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined } }, { new: true });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized Request: Refresh Token is required");

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(401, "Invalid Refresh Token");

    if (incomingRefreshToken !== user?.refreshToken) throw new ApiError(401, "Refresh Token is expired");

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access Token refreshed successfully")
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Unauthorized Request: Invalid Refresh Token");
  }
});

const changeCurrentPassword = AsyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id); // req.user is setup in auth middleware in verifyJWT
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword); // calling the method in user model

  if (!isPasswordCorrect) throw new ApiError(400, "Old Password is not correct");

  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); // save the user with the new password, bypassing validations

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = AsyncHandler(async (req, res) => {
  return res.status(200).json(200, req.user, "Current user fetched successfully");
});

const updateAccountDetails = AsyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) throw new ApiError(400, "Both fullName and email are required");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullName, email },
    },
    {
      new: true,
    }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200, user, "User details updated successfully"));
});

const updateAvatar = AsyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) throw new ApiError(400, "Avatar file is missing");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) throw new ApiError(400, "Error uploading avatar file");

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateCoverImage = AsyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) throw new ApiError(400, "Cover Image file is missing");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) throw new ApiError(400, "Error uploading Cover Image file");

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200, user, "Cover Image updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
};
