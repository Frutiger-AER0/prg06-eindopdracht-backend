import mongoose from "mongoose";

const comicSchema = new mongoose.Schema(
    {
        title: { type: String },
        description: { type: String },
        author: { type: String },
        date: { type: Date },
        image: { type: String },
    }, {
        toJSON: {
            virtuals: true,
            versionKey: false,
            transform: (doc, ret) => {
                ret._links = {
                    self: {
                        href: `${process.env.BASE_URI}${ret._id}`,
                    },
                    collection: {
                        href: `${process.env.BASE_URI}`,
                    },
                };
                delete ret._id;
            },
        },
    }
);

const Comic = mongoose.model("Comic", comicSchema);

export default Comic;