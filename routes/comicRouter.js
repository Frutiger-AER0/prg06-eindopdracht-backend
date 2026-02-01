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
    const filter = {};
    if (req.query.title) filter.title = new RegExp(req.query.title, 'i');
    if (req.query.author) filter.author = new RegExp(req.query.author, 'i');
    if (req.query.date) filter.date = new Date(req.query.date);

    const totalItems = await Comic.countDocuments(filter);
    const hasLimit = req.query.limit !== undefined;
    const page = hasLimit ? parseInt(req.query.page) || 1 : 1;
    const limit = hasLimit ? parseInt(req.query.limit) || 6 : totalItems;
    const skip = (page - 1) * limit;
    const totalPages = hasLimit ? Math.ceil(totalItems / limit) : 1;
    const comics = await Comic.find(filter, '-description').skip(skip).limit(limit);
    const latestComic = await Comic.findOne(filter).sort({ updatedAt: -1 });
    const lastModified = latestComic ? latestComic.updatedAt.toUTCString() : new Date().toUTCString();

    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(lastModified)) {
        return res.status(304).set('Last-Modified', lastModified).send();
    }

    // Basis URI voor de links omgebouwd vanwege issues met een trailing slash
    const base = process.env.BASE_URI || `${req.protocol}://${req.get('host')}${req.baseUrl}`;
    const baseUri = String(base).replace(/\/+$/, '');

    const baseQuery = {};
    if (req.query.title) baseQuery.title = req.query.title;
    if (req.query.author) baseQuery.author = req.query.author;
    if (req.query.date) baseQuery.date = req.query.date;

    // Helper functie voor het maken van hrefs voor mijn pagination omdat het anders onoverzichtelijk werdt.
    const makeHref = (opts = {}) => {
        const params = { ...baseQuery };
        if (opts.addPage && opts.page !== undefined) params.page = String(opts.page);
        if (opts.addLimit && opts.limit !== undefined) params.limit = String(opts.limit);
        const qs = new URLSearchParams(params).toString();
        return `${baseUri}${qs ? '?' + qs : ''}`;
    };

    const paginationLinks = hasLimit ? {
        first: { page: 1, href: makeHref({ addPage: true, page: 1, addLimit: true, limit }) },
        last: { page: totalPages, href: makeHref({ addPage: true, page: totalPages, addLimit: true, limit }) },
        previous: page > 1 ? { page: page - 1, href: makeHref({ addPage: true, page: page - 1, addLimit: true, limit }) } : null,
        next: page < totalPages ? { page: page + 1, href: makeHref({ addPage: true, page: page + 1, addLimit: true, limit }) } : null,
    } : {
        first: { page: 1, href: makeHref({}) },
        last: { page: 1, href: makeHref({}) },
        previous: null,
        next: null,
    };

    const selfHref = hasLimit ? makeHref({ addPage: true, page, addLimit: true, limit }) : makeHref({});

    const items = comics.map(c => {
        const obj = (typeof c.toJSON === 'function') ? c.toJSON() : JSON.parse(JSON.stringify(c));
        obj._links = obj._links || {};
        obj._links.collection = { href: baseUri };
        return obj;
    });

    res.set({
        'Cache-Control': 'max-age=3600',
        'Last-Modified': lastModified
    });
    res.json({
        items,
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

        const lastModified = (comic.updatedAt || comic.createdAt || new Date()).toUTCString();

        const imsHeader = req.headers['if-modified-since'];
        if (imsHeader) {
            const ims = new Date(imsHeader);
            if (!isNaN(ims.getTime()) && ims >= new Date(lastModified)) {
                return res.status(304).set('Last-Modified', lastModified).send();
            }
        }

        res.set({
            'Cache-Control': 'max-age=3600',
            'Last-Modified': lastModified
        });

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