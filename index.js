import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

const app = express();
const port = 3000;
dotenv.config();

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function checkUser() {
  const result = await db.query('SELECT * FROM "users"');
  return result.rows;
}

async function getCurrentUser() {
  const result = await db.query('SELECT * FROM "users" WHERE id = $1', [
    currentUserId,
  ]);
  return result.rows[0];
}

async function userExists(name) {
  const result = await db.query('SELECT * FROM "users" WHERE name = $1', [
    name,
  ]);
  return result.rows.length > 0;
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisisted();
    const users = await checkUser();
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      res.render("new.ejs");
    } else {
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
      });
    }
  } catch (error) {
    console.error("Error fetching data: ", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE  $1 ;",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code,user_id) VALUES ($1 , $2)",
        [countryCode, currentUser.id]
      );
      res.redirect("/");
    } catch (err) {
      console.error(err);
    }
  } catch (err) {
    console.error(err);
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  if (await userExists(req.body.name)) {
    res.status(409).json({ error: "User already exists" });
    return;
  }

  const { name, color } = req.body;
  const result = await db.query(
    'INSERT INTO "users" (name, color) VALUES ($1, $2) RETURNING id',
    [name, color]
  );

  currentUserId = result.rows[0].id;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
