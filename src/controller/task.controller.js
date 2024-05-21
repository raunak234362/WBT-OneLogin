import path from "path";

import { 
    UserGroup, User, Project, Fabricator, Task
 } from '../model/index.js';

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

export const createTask = asyncHandler(async (req, res) => {
    try {

        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const { project, assignedUser, title, description, startDate, dueDate } = req.body;

        if (!project || !assignedUser || !title || !description || !startDate || !dueDate) {
            throw new ApiError(400, "All fields are required");
        }

        const projectObject = await Project.findById(project);

        if (!projectObject) {
            throw new ApiError(404, "Project not found");
        }

        const assignedTo = await User.findById(assignedUser);

        if (!assignedTo) {
            throw new ApiError(404, "Assigned user not found");
        }

        const task = await Task.create({
            project: projectObject._id,
            createdBy: req.user._id,
            currentUser: assignedTo._id,
            title: title.trim(),
            description: description.trim(),
            startDate: new Date(startDate),
            dueDate : new Date(dueDate),
        });

        task.assign.push({
            assignedTo: assignedTo._id,
            assignedBy: req.user._id,
            approved: true
        });

        await task.save();

        return res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
    } catch (error) {
        throw new ApiError(500, error.message);
    }
});

export const getTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.find({currentUser: req.user._id}).sort({priority: -1}).populate('project').populate('createdBy').populate('currentUser').populate('assign.assignedTo').populate('assign.assignedBy').populate('comments.commentedBy');

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        return res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getAllTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const data = {}

        if ("project" in req.query) {
            data.project = req.query.project;
        }

        if ("createdBy" in req.query) {
            data.createdBy = req.query.createdBy;
        }

        if ("priority" in req.query) {
            switch (req.query.priority.toLowerCase()) {
                case "critical":
                    data.priority = 4;
                    break;

                case "high":
                    data.priority = 3;
                    break;

                case "medium":
                    data.priority = 2;
                    break;
            
                default:
                    data.priority = 1;
                    break;
            }
        }

        if ("status" in req.query) {
            data.status = req.query.status;
        }

        const task = await Task.find(data).sort({priority: -1}).populate('project').populate('createdBy').populate('currentUser').populate('assign.assignedTo').populate('assign.assignedBy').populate('comments.commentedBy');

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        return res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const acceptTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.findById(req.params.taskId);

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        if (task.currentUser.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not allowed to perform this action");
        }

        task.status = "in progress";
        await task.save();

        return res.status(200).json(new ApiResponse(200, task, "Task accepted successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const approveTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.findById(req.params.taskId);

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        const project = await Project.findById(task.project);

        if (req.user._id.toString() !== task.createdBy.toString() || req.user._id.toString() !== project.teamLeader.toString()) {
            throw new ApiError(403, "You are not allowed to perform this action");
        }

        const taskAssign = await task.assign.find(assign => assign._id === req.body.assignId);

        if (!taskAssign) {
            throw new ApiError(404, "Task assign request not found");
        }

        taskAssign.approved = true;
        task.currentUser = taskAssign.assignedTo;
        await taskAssign.save();
        await task.save();

        return res.status(200).json(new ApiResponse(200, task, "Task approved successfully"));

    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const assignTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.findById(req.params.taskId);

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        const project = await Project.findById(task.project);

        if (task.currentUser.toString() !== req.user._id.toString() 
            || task.createdBy.toString() !== req.user._id.toString()
            || project.teamLeader.toString() !== req.user._id.toString()){
            throw new ApiError(403, "You are not allowed to perform this action");
        }

        const {assignedUser} = req.body;

        const user = await User.findById(assignedUser);

        if (!user) {
            throw new ApiError(404, "User not found");
        }

        task.assign.push({
            assignedTo: user._id,
            assignedBy: req.user._id,
            approved: false
        });

        await task.save();

        return res.status(200).json(new ApiResponse(200, task, "Task assigned successfully, waiting for approval"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const getTaskComments = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.findById(req.params.taskId).populate('comments.commentedBy');

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        return res.status(200).json(new ApiResponse(200, task.comments, "Task comments fetched successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});

export const commentTask = asyncHandler( async (req, res) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }

        const task = await Task.findById(req.params.taskId);

        if (!task) {
            throw new ApiError(404, "Task not found");
        }

        const {text} = req.body;
        const files = req.files.map(file => path.join("/uploads", file.filename));

        task.comments.push({
            commentedBy: req.user._id,
            text: text.trim(),
            files: files
        });

        await task.save();

        return res.status(200).json(new ApiResponse(200, task, "Task comment added successfully"));
    } catch (err) {
        throw new ApiError(500, err.message);
    }
});