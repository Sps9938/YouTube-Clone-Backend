import { asyncHandler } from "../utils/asyncHandler.js"

import { ApiError } from "../utils/ApiError.js"

import { User } from "../models/user.models.js"

import { uploadOnCloudinary } from "../utils/cloudinary.js"
import bcrypt from "bcrypt";
import { ApiResponse } from "../utils/ApiResponse.js"

import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken

        await user.save({ validateBeforeSave: false })
        // console.log(refreshToken);


        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }

}

const registerUser = asyncHandler(async (req, res) => {

    //get user details from frontend
    //validation - not empty
    //check if user already exists: username, email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return response

    /*getting user details */

    const { fullname, email, username, password } = req.body
    // console.log("email: ", email);

    /* check empty condition */

    // if(fullname === "") {  
    //     throw new ApiError(400, "fullname is required")
    // }

    //??-> extract
    if (
        [fullname, email, username, password].some((field) => (field ?? "").trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }


    /* check either username or email exist or not */

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }



    /* check avatar and images Uploaded Sucessfully or  not */


    let avatarLocalPath;
    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path
    }
    // console.log(avatarLocalPath);

    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    /* then upload them cloudinary */

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // console.log(avatar);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required on Cloudinary")

    }

    /* create user object - create entry in db */

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    /* remove password and refresh token field from response */

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    /* check for user creation */

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    /* return response */

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Sucessfully")
    )

})

const loginUser = asyncHandler(async (req, res) => {
    //req.body
    //user name or email
    //find user
    //password check
    //access and refresh token generate
    //send cookie
    //send response
    /* get user detiails */
    const { email, username, password } = req.body
    // console.log(email);

    if (!(username || email)) {
        throw new ApiError(400, "username or email is required");
    }
    /* check username or email exist or not */
    //here we forget to using await keyword 
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }
    // console.log(password);

    /* check password correct or not */
    const isPasswordValid = await user.isPasswordCorrect(password)

    // console.log(isPasswordValid);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user Password")
    }
    /*generate access and refresh token */
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
    // console.log({accessToken});
    // console.log({refreshToken});



    // console.log("Generated sucessfully");

    /*send cookies */
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken ")
    // console.log(loggedInUser);

    const options = {
        httpOnly: true,
        secure: true
    }

    // console.log(req.cookies.refreshToken);
    // console.log(req.cookies.accessToken);


    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken,
                    refreshToken
                },
                "User logged in Sucessfully"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined

            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
 
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    // console.log(req.cookies.refreshToken);
    // console.log(req.cookies.accessToken);
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request, refreshToken is not available on cookies")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)
        // console.log(refreshToken);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        accessToken, refreshToken
                    },
                    "Login Sucessfullry With refresh Token"

                )
            )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh Token on decodedToken Part")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword, renewPassword} = req.body
    if(newPassword !== renewPassword )
    {
        throw new ApiError(401, "newPassword is not Match with renewPassword")
    }
    const user = await User.findById(req.user?._id)
    
    // console.log(user);
    
    // console.log("user object has generated Successfully");
    

    //to check user object->password and refreshtoeken are not mentioned
    if(!user)
    {
        throw new ApiError(401, "User Not Found")
    }
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect)
    {
        throw new ApiError(401, "Invalid old Password")

    }
    user.password = newPassword

    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        {},
        "Password changed Sucessfully"
    ))
})

//khud sai forget Password ka controller banao
const forgetPassword = asyncHandler(async(req, res) => {
    const {username, email, newPassword,renewPassword} = req.body
    // if(!user && !email)
    if(!(username || email))
    {
        throw new ApiError(401, "username or email required")
    }
    //check user or email match with user Database
    const user = await User.findById(req.user?._id)
    if(!((user.username === username) || (user.email === email)))
    {
        throw new ApiError(401, "User Not Found,Enter Corret username or email")
    }

    if(newPassword !== renewPassword)
    {
        throw new ApiError(401, "oldPassword is not Match with renewPassword")
    }
    //this line indicate that ,you should carry to change your currentPassword
    user.password = newPassword

    user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json( new ApiResponse(
        200,
        {},
        "User changed Password Successfull with the help of ForgetPassword"
    ))

})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    forgetPassword
}