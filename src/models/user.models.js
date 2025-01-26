import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/ApiError.js";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullname: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        avatar: {
            type: String,//cloudinary url
            required: true,


        },
        coverImage: {
            type: String,

        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
        password: {
            type: String,
            required: [true, 'Password is required']
        },
        refreshToken: {
            type: String,
        },



    },{timestamps: true}

)

userSchema.pre("save", async function (next) {
    // console.log("Hased entry");
    
    try {
        if(!this.isModified("password")) return next();
    
        this.password = await bcrypt.hash(this.password, 10)
        console.log("Hashed password in pre-save:", this.password);
    
        next();
    } catch (error) {
        console.error("Error while hashing password:", error);
        next(error);
        
        
    }
})

userSchema.methods.isPasswordCorrect = async function (password) {
    
    // console.log("Input password:",password);
    
    // console.log("Stored password hash in DB:",this.password);
    
    const result = password === this.password

    // console.log(`result is: ${result}`);
    
    return result

}


userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            //payload : //database

            _id: this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            //payload : //database

            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
} 
export const User = mongoose.model("User", userSchema)
