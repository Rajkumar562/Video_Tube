import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // Upload file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, { resource_type: "auto" });

    // File Uploaded successfully
    console.log("File uploaded successfully", response.url);

    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the file saved locally on the server as it was failed while uploading to the cloudinary

    return null;
  }
};

export { uploadOnCloudinary };
