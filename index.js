const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT;

// 🌐 Cloudinary config
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	secure: true,
});

// 📸 Multer + Cloudinary storage
const storage = new CloudinaryStorage({
	cloudinary: cloudinary,
	params: async (req, file) => ({
		folder: "food-combos",
		public_id: file.fieldname + "-" + Date.now(),
	}),
});
const upload = multer({ storage });

// 📦 MongoDB connection
const mongoUrl = process.env.MONGO_URL;
const client = new MongoClient(mongoUrl);
let combos;

client.connect()
	.then(() => {
		const db = client.db("foodcombo");
		combos = db.collection("combos");
		console.log("✅ MongoDB Connected");
	})
	.catch((err) => console.error("❌ MongoDB Connection Failed", err));

// ➕ POST: Add new combo (with 2 images)
app.post("/create", upload.fields([
	{ name: "imageA", maxCount: 1 },
	{ name: "imageB", maxCount: 1 }
]), async (req, res) => {
	try {
		const { itemA, itemB } = req.body;
		const imageA = req.files.imageA?.[0]?.path;
		const imageB = req.files.imageB?.[0]?.path;

		if (!itemA || !itemB || !imageA || !imageB) {
			return res.status(400).json({ error: "Missing fields or images" });
		}

		const newCombo = { itemA, itemB, imageA, imageB, bite: 0, ban: 0 };
		await combos.insertOne(newCombo);
		res.json({ message: "Combo added successfully" });
	} catch (err) {
		console.error("❌ Create Combo Error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// 📄 GET: All combos
app.get("/combos", async (req, res) => {
	try {
		const all = await combos.find().toArray();
		res.json(all);
	} catch (err) {
		console.error("❌ Fetch Error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// 👍👎 PUT: Vote on a combo
app.put("/vote/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { type } = req.body;

		if (!["bite", "ban"].includes(type)) {
			return res.status(400).json({ error: "Invalid vote type" });
		}

		const result = await combos.updateOne(
			{ _id: new ObjectId(id) },
			{ $inc: { [type]: 1 } }
		);

		res.json({ message: "Vote recorded", result });
	} catch (err) {
		console.error("❌ Voting Error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// 🆕 GET: One random combo
app.get("/random", async (req, res) => {
	try {
		const count = await combos.countDocuments();
		const randomIndex = Math.floor(Math.random() * count);
		const combo = await combos.find().skip(randomIndex).limit(1).toArray();
		res.json(combo[0]);
	} catch (err) {
		console.error("❌ Random Fetch Error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// 🆕 GET: All combos alias (for compatibility)
app.get("/all", async (req, res) => {
	try {
		const all = await combos.find().toArray();
		res.json(all);
	} catch (err) {
		console.error("❌ Fetch All Error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// 🗑 DELETE: Remove a combo
app.delete("/delete/:id", async (req, res) => {
	try {
		const { id } = req.params;
		await combos.deleteOne({ _id: new ObjectId(id) });
		res.json({ message: "Combo deleted" });
	} catch (err) {
		console.error("❌ Delete Error:", err);
		res.status(500).json({ error: "Delete failed" });
	}
});


app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
