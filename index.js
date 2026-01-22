import mongoose from "mongoose";
import express from "express";
import router from "./routes/comicRouter.js";

const app = express();

try {
    await mongoose.connect(process.env.MONGODB_URI || "");
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static('public'));
    app.use("/comics", router)

    app.listen(process.env.EXPRESS_PORT, () => {
        console.log(`Server is listening on port ${process.env.EXPRESS_PORT}`);
    })
} catch (e) {
    console.log('Database connection failed: ${e.message}');
}