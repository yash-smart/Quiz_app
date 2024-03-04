import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import md5 from "md5";
import env from "dotenv"
env.config();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "quiz_app",
    password: process.env.DB_PASSWORD,
    port: 5432,
  });
  db.connect();
  

app.get("/",(req,res) => {
    res.render("index.ejs")
})

app.get('/register',(req,res) => {
    res.render('register.ejs')
})

app.post('/ini',async (req,res) => {
    let Username = req.body.username;
    let Password = md5(req.body.password);
    let data_obj = await db.query('select password from login_credentials where username = $1;',[Username])
    // console.log(data_obj)
    if (data_obj.rows.length != 0) {
        let data = data_obj.rows[0].password
        if (data === Password) {
            res.send('Hello ' + Username+ '!')
        }
        else {
            res.send('Login failed')
        }
    }
    else {
        res.send('Login failed')
    }
    
})

app.post('/register',(req,res) => {
    let Username = req.body.username;
    let Password = md5(req.body.password);
    db.query('insert into login_credentials(username,password) values($1,$2)',[Username,Password])
    res.redirect('/')
})


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
