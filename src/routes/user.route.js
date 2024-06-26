import express from 'express';
import { upload } from "../middleware/multer.middleware.js";
import { auth } from '../middleware/auth.middleware.js';
import { 
    verifyUserViaOTP, getNewOTP, login, registerNewUser, updateUser,
    logout, getUser, getAllUsers, getUserByGroup, getUserByUsername
 } from '../controller/user.controller.js';

export const userRouter = express.Router();

userRouter.get('/newOtp/', auth, getNewOTP);

userRouter.post('/login/', login);
userRouter.get('/logout/', auth, logout);

userRouter.post('/regsiter/:groupId/', auth, registerNewUser);
userRouter.post('/verifyOtp/', auth, verifyUserViaOTP);

userRouter.get('/', auth, getUser);
userRouter.get('/all/', auth, getAllUsers);
userRouter.get('/all/:groupId/', auth, getUserByGroup);
userRouter.get('/:username/', auth, getUserByUsername);
userRouter.put('/:username/update', auth, upload.single('profileImage'), updateUser);