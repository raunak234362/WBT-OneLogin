import path from "path";

import { Company, UserGroup, User, OTP } from '../model/index.js';

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { sendOTP } from "../utils/mail.util.js";

export const registerCompanyAndUser = asyncHandler(async (req, res) => {
    try {
        const {
            name, id, email, colorCode, phone,
            address, website, established, type, size, country,
            username, password
        } = req.body;
        const logo = `/uploads/${path.basename(req?.files?.logo[0]?.path)}`;
        
        if (!name || !id || !email || !phone){
            throw new ApiError(400, "Please fill all required fields for Company");
        }

        if (!username || !password){
            throw new ApiError(400, "Please fill all required fields for User");
        }

        if (!req?.files?.logo){
            throw new ApiError(400, "Please upload a logo for the Company");
        }

        const oldCompany = await Company.findOne({$or: [{companyName: name}, {companyId: id}]});

        if (oldCompany){
            throw new ApiError(400, "Company already exists with the same name or id");
        }
        
        const oldUser = await User.findOne({username:`${id}-${username}`});
        if (oldUser){
            throw new ApiError(400, "User already exists with the same username");
        }

        const company_info = {
            companyName: name,
            companyId: id.toUpperCase(),
            companyEmail: email,
            companyPhone: phone,
            companyLogo: logo
        };

        if (address) company_info.companyAddress = address;
        if (colorCode) company_info.colorCode = {primary: colorCode.primary, secondary: colorCode.secondary};
        if (website) company_info.companyWebsite = website;
        if (established) company_info.companyEstablished = established;
        if (type) company_info.companyType = type;
        if (size) company_info.companySize = size;
        if (country) company_info.companyCountry = country;

        const company = await Company.create(company_info);

        if (!company){
            throw new ApiError(500, "Failed to register company");
        }

        const userGroup = await UserGroup.create({
            company: company._id,
            userGroupName: "Admin",
            userGroupDescription: "Admin of the Company",
            accessLevel: "admin",
            userGroupSchema: []
        })

        if (!userGroup){
            throw new ApiError(500, "Failed to create user group");
        }

        const user = await User.create({
            username: `${id}-${username}`,
            password: password,
            email: email,
            userGroup: userGroup._id
        });

        if (!user){
            throw new ApiError(500, "Failed to create user");
        }

        const otp = await OTP.create({
            user: user._id,
            otp: Math.floor(100000 + Math.random() * 900000)
        });

        if (!otp){
            throw new ApiError(500, "Failed to send OTP");
        }

        // TODO: Uncomment this line after integrating mail service
        // await sendOTP(email, name, otp.otp);
        
        return res.status(200).json(new ApiResponse(200, {
            userId: user._id,
            username: user.username
        }, "Company registered successfully, Please enter OTP for verification"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});