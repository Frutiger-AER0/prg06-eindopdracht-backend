import express from "express";
import Comic from "../models/comicSchema.js";
import { faker } from '@faker-js/faker';
import * as fs from "fs";
import * as path from "path";

const router = express.Router();

router.use((req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    console.log(`Method: ${req.method}, URL: ${req.url}`);
    if (req.headers.accept && req.headers.accept === "application/json") {
        next();
    } else {
        if (req.method === "OPTIONS") {
            next();
        } else {
            res.status(406).json({error: "Webservice only supports json."});
        }
    }
});

router.get("/", async (req, res) => {
    const totalItems = await Comic.countDocuments();
    const hasLimit = req.query.limit !== undefined;
    const page = hasLimit ? parseInt(req.query.page) || 1 : 1;
    const limit = hasLimit ? parseInt(req.query.limit) || 6 : totalItems;
    const skip = (page - 1) * limit;
    const totalPages = hasLimit ? Math.ceil(totalItems / limit) : 1;
    const comics = await Comic.find({}, '-description').skip(skip).limit(limit);
    const baseUri = process.env.BASE_URI;
    const paginationLinks = hasLimit ? {
        first: { page: 1, href: `${baseUri}?page=1&limit=${limit}` },
        last: { page: totalPages, href:`${baseUri}?page=${totalPages}&limit=${limit}` },
        previous: page > 1 ? { page: page - 1, href: `${baseUri}?page=${page - 1}&limit=${limit}` } : null,
        next: page < totalPages ? { page: page + 1, href: `${baseUri}?page=${page + 1}&limit=${limit}` } : null,
    } : {
        first: { page: 1, href: `${baseUri}` },
        last: { page: 1, href: `${baseUri}` },
        previous: null,
        next: null,
    };
    const selfHref = hasLimit ? `${baseUri}?page=${page}&limit=${limit}` : baseUri;
    res.json({
        items: comics,
        _links: {
            self: { href: selfHref },
            collection: { href: baseUri }
        },
        pagination: {
            currentPage: page,
            currentItems: comics.length,
            totalPages,
            totalItems,
            _links: paginationLinks
        },
    });
})

router.post("/seed",  async (req, res) => {
    const comics = [];
    await Comic.deleteMany({});
    const amount = req.body?.amount ?? 10;
    for (let i = 0; i < amount; i++) {
        const comic = new Comic({
            title: faker.lorem.slug(),
            description: faker.lorem.text(),
            author: faker.person.fullName(),
            date: faker.date.past()
        });
        comic.save();
        comics.push(comic);
    }
    res.json(comics);
});

router.options("/", (req, res) => {
    res.header("Allow", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.status(204).send();
})

router.post("/", async (req, res) => {
    const { title, description, author, date, image } = req.body;
    let imageUrl = null;
    if (image) {
        const buffer = Buffer.from(image, 'base64');
        const filename = Date.now() + '.png';
        const filepath = path.join('public', 'uploads', filename);
        fs.writeFileSync(filepath, buffer);
        imageUrl = `/uploads/${filename}`;
    }
    if (!title || !description || !author || !date) {
        return res.status(400).json({ error: "Title, description, author and date are required" });
    }
    const comic = new Comic({ title, description, author, date, image: imageUrl });
    try {
        await comic.save();
        res.status(201).json(comic);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
})

router.put("/:id", async (req, res) => {
    const comicId = req.params.id;
    if (!req.body) {
        return res.status(400).json({ error: "Request body is required" });
    }
    const { title, description, author, date, image } = req.body;
    let imageUrl = req.body.image;
    if (image && !image.startsWith('/uploads/')) {
        const buffer = Buffer.from(image, 'base64');
        const filename = Date.now() + '.png';
        const filepath = path.join('public', 'uploads', filename);
        fs.writeFileSync(filepath, buffer);
        imageUrl = `/uploads/${filename}`;
    }
    if (!title || !description || !author || !date) {
        return res.status(400).json({ error: "Title, description, author and date are required" });
    }
    try {
        const comic = await Comic.findByIdAndUpdate(
            comicId,
            { title, description, author, date, image: imageUrl, updatedAt: Date.now() },
            { new: true }
        );
        if (!comic) {
            return res.status(404).json({ error: "Comic not found" });
        }
        res.json(comic);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
})

router.delete("/:id", async (req, res) => {
    const comicId = req.params.id;
    try {
        const result = await Comic.findByIdAndDelete(comicId);
        if (!result) {
            return res.status(404).json({ error: "Comic not found" });
        }
        res.status(204).json({ message: "Comic deleted" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
})

router.get("/:id", async (req, res) => {
    const comicId = req.params.id;
    try {
        const comic = await Comic.findById(comicId);
        if (!comic) {
            return res.status(404).json({ error: "Comic not found" });
        }
        res.json(comic);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
})

router.options("/:id", (req, res) => {
    res.header("Allow", "GET, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.status(204).send();
})

export default router;