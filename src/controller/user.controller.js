import path from "path";

import { Company, UserGroup, User, OTP } from '../model/index.js';

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { sendOTP } from "../utils/mail.util.js";

export const generateToken = async (_id) => {
    const user = await User.findById(_id);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave: false});

    return {accessToken, refreshToken};
}

export const verifyUserViaOTP = asyncHandler(async (req, res) => {
    try {

        if (!req.user) {
            throw new ApiError(400, "User not logged in");
        }

        const { otp } = req.body;
        if (!otp || otp.length !== 6){
            throw new ApiError(400, "Please provide valid userId and OTP");
        }

        const user = await User.findById(req.user._id);

        if (!user){
            throw new ApiError(400, "User not found");
        }

        const otpData = await OTP.findOne({user: req.user._id, otp: otp});

        if (!otpData){
            throw new ApiError(400, "Invalid OTP");
        }

        user.verified = true;
        await user.save({validateBeforeSave: false});

        await OTP.deleteMany({user: req.user._id});

        return res.status(200).json(new ApiResponse(200, {
            username: user.username
        }, "User verified successfully"));
        
    } catch (err) {
        throw new ApiError(500, err.message);
    }
})

export const getNewOTP = asyncHandler(async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(400, "User not logged in");
        }

        const user = await User.findById(req.user._id);

        if (!user){
            throw new ApiError(400, "User not found");
        }

        if (user.verified){
            throw new ApiError(400, "User already verified");
        }

        const otp = await OTP.findOne({user: req.user._id});

        if (!otp) {
            const newOtp = await OTP.create({
                user: req.user._id,
                otp: Math.floor(100000 + Math.random() * 900000)
            });
            
            if (!newOtp){
                throw new ApiError(500, "Failed to send OTP");
            }

            // TODO: Uncomment this line after integrating mail service
            // await sendOTP(user.email, newOtp.otp);

            return res.status(200).json(new ApiResponse(200, {
                username: user.username
            }, "OTP sent successfully"));
        } else {
            otp.otp = Math.floor(100000 + Math.random() * 900000);
            await otp.save();

            // TODO: Uncomment this line after integrating mail service
            // await sendOTP(user.email, otp.otp);

            return res.status(200).json(new ApiResponse(200, {
                username: user.username
            }, "OTP sent successfully"));
        }
    } catch (err) {
        throw new ApiError(500, err.message);
    }
})

export const login = asyncHandler(async (req, res) => {
    try {
        if (!req.body.username ||!req.body.password){
            throw new ApiError(400, "Please provide username and password");
        }

        const { username, password } = req.body;

        const user = await User.findOne({username: username});

        if (!user){
            throw new ApiError(400, "User not found");
        }

        if (!user.verifyPassword(password)){
            throw new ApiError(400, "Invalid credentials");
        }

        const { accessToken, refreshToken } = await generateToken(user._id);

        const options = {
            httpOnly: true,
            secure: true,
        };

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, {
            username: user.username,
            accessToken: accessToken,
            refreshToken: refreshToken
        }, "User logged in successfully"));

    } catch (err) {
        throw new ApiError(500, err.message);
    }
})

export const registerNewUser = asyncHandler(async (req, res) => {
    try {
        if (!req.params.groupId){
            throw new ApiError(400, "Please provide user group");
        }

        const { username, email, password } = req.body;

        if (!email || !password || !username){
            throw new ApiError(400, "Please fill all default fields for User");
        }

        const groupInfo = await UserGroup.findById(req.params.groupId);

        if (!groupInfo){
            throw new ApiError(400, "User group not found");
        }

        if (groupInfo.accessLevel !== "admin" || groupInfo.accessLevel !== "manager"){
            throw new ApiError(400, "Only admin or manager can add new users");
        }

        const companyInfo = await Company.findById(groupInfo.company);

        const extraFields = {};

        for (let field of groupInfo.userGroupSchema){
            extraFields[field.fieldName] = req.body[field.fieldName];
        }

        const newUser = await User.create({
            username: `${companyInfo.companyId}-${username}`,
            email: email,
            password: password,
            userGroup: groupInfo._id,
            extras: extraFields
        });

        if (!newUser){
            throw new ApiError(500, "Failed to register user");
        }

        const user = await User.findById(newUser._id).populate("userGroup userGroup.company").select("-password -access_token -refresh_token -__v -createdAt -updatedAt");

        return res.status(200)
        .json(new ApiResponse(200, user, "User Added successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const logout = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user){
            throw new ApiError(400, "User not found");
        }

        user.refreshToken = "";
        await user.save({validateBeforeSave: false});

        return res.status(200)
        .clearCookie("accessToken")
        .clearCookie("refreshToken")
        .json(new ApiResponse(200, {}, "User logged out successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getUser = asyncHandler(async (req, res) => {
    try {
        if (!req.user){
            throw new ApiError(401, "Unauthorized");
        }

        const user = await User.findById(req.user._id).populate("userGroup userGroup.company").select("-password -access_token -refresh_token -__v -createdAt -updatedAt");

        if (!user){
            throw new ApiError(400, "User not found");
        }

        return res.status(200)
        .json(new ApiResponse(200, user, "User fetched successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getAllUsers = asyncHandler(async (req, res) => {
    try {
        if (!req.user){
            throw new ApiError(401, "Unauthorized");
        }

        const data = {};
        if (req.query.group){
            data.userGroup = req.query.group;
        }
        if (req.query.verified) {
            data.verified = req.query.verified;
        }

        const allUsers = await User.find(data).populate("userGroup userGroup.company").select("-password -access_token -refresh_token -__v -createdAt -updatedAt");

        if (!allUsers) {
            throw new ApiError(404, "No users found");
        }

        return res.status(200)
        .json(new ApiResponse(200, allUsers, "Users retrieved successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getUserByGroup = asyncHandler( async (req, res) => {
    try {
        if (!req.user){
            throw new ApiError(401, "Unauthorized");
        }

        const group = await UserGroup.findById(req.params.groupId);

        if (!group){
            throw new ApiError(404, "Group not found");
        }

        const allUsers = await User.find({userGroup: req.params.groupId}).populate("userGroup userGroup.company").select("-password -access_token -refresh_token -__v -createdAt -updatedAt");

        if (!allUsers) {
            throw new ApiError(404, "No users found");
        }

        return res.status(200)
        .json(new ApiResponse(200, allUsers, "Users retrieved successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getUserByUsername = asyncHandler(async (req, res) => {
    try {
        if (!req.user){
            throw new ApiError(401, "Unauthorized");
        }

        const user = await User.findOne({username: req.params.username}).populate("userGroup userGroup.company").select("-password -access_token -refresh_token -__v -createdAt -updatedAt");

        if (!user){
            throw new ApiError(404, "User not found");
        }

        return res.status(200)
        .json(new ApiResponse(200, user, "User fetched successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});