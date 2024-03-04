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
    let data_obj = await db.query('select id,password from login_credentials where username = $1;',[Username])
    // console.log(data_obj)
    if (data_obj.rows.length != 0) {
        let data = data_obj.rows[0].password;
        let user_id = data_obj.rows[0].id;
        console.log(user_id)
        if (data === Password) {
            let quizzes_obj = await db.query('select * from quizzes where user_id = $1;',[user_id])
            console.log(quizzes_obj.rows)
            res.render('main.ejs',{data: quizzes_obj.rows,id: user_id})
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

app.get('/add_quiz/:id',(req,res) => {
    res.render('add quiz.ejs',{id:req.params.id})
})

app.post('/add_quiz/:id',async (req,res) => {
    await db.query('Insert into quizzes(user_id,quiz_name,status) values($1,$2,0);',[req.params.id,req.body.quiz_name]);
    let quizzes_obj = await db.query('select * from quizzes where user_id = $1;',[req.params.id])
    res.render('main.ejs',{data: quizzes_obj.rows,id: req.params.id})
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
