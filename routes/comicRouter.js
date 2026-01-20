import express from "express";
import Comic from "../models/comicSchema.js";
import { faker } from '@faker-js/faker';

const router = express.Router();

router.use((req, res, next) => {
    console.log("check accept header");
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
    res.header("Access-Control-Allow-Origin", "*");
    const comics = await Comic.find({}, '-description');
    res.json({
        items: comics,
        _links: {
            self: {
                href: `${process.env.BASE_URI}`,
            },
            collection: {
                href: `${process.env.BASE_URI}`,
            }
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
    const { title, description, author, date } = req.body;
    if (!title || !description || !author || !date) {
        return res.status(400).json({ error: "Title, description, author and date are required" });
    }
    const comic = new Comic({ title, description, author, date });
    try {
        await comic.save();
        res.status(201).json(comic);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
})

router.put("/:id", async (req, res) => {
    const comicId = req.params.id;
    const { title, description, author, date } = req.body;
    if (!title || !description || !author || !date) {
        return res.status(400).json({ error: "Title, description, author and date are required" });
    }
    try {
        const comic = await Comic.findByIdAndUpdate(
            comicId,
            { title, description, author, date, updatedAt: Date.now() },
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
    res.header("Access-Control-Allow-Origin", "*");
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