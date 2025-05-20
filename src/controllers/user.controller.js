import { AsyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { registerUser };
