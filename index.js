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

function membership(array,element) {
    for (let i=0;i<array.length;i++) {
        if (array[i] == element) {
            return (true);
        }
    }
    return (false);
}

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
        // console.log(user_id)
        if (data === Password) {
            res.redirect('/main/'+user_id)
        }
        else {
            res.redirect('/')
        }
    }
    else {
        res.redirect('/')
    }
    
})

app.get('/main/:id',async (req,res) => {
    let quizzes_obj = await db.query('select * from quizzes where user_id = $1;',[req.params.id])
    // console.log(quizzes_obj.rows)
    res.render('main.ejs',{data: quizzes_obj.rows,id: req.params.id})
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
    res.redirect('/main/'+req.params.id)
})

app.get('/quiz/:id',async (req,res) => {
    let owner_data = await db.query('select user_id from quizzes where id = $1;',[req.params.id]);
    let owner = owner_data.rows[0].user_id;
    let quiz_questions = await db.query('select * from questions where quiz_id = $1 order by id;',[req.params.id])
    quiz_questions = quiz_questions.rows
    let options = [];
    for (let i=0;i<quiz_questions.length;i++) {
        let data = await db.query('select option_number,option_text from options where question_id=$1 order by option_number;',[quiz_questions[i].id]);
        let temp = []
        // console.log(data.rows)
        for (let j=0;j<data.rows.length;j++) {
            temp.push(data.rows[j])
        }
        options.push(temp);
    }
    // console.log(options)
    res.render('Question.ejs',{question_data: quiz_questions,quiz_id: req.params.id,options: options,owner:owner});
})

app.get('/new-question/:id',async (req,res) => {
    let owner_data_4 = await db.query('select user_id from quizzes where id = $1;',[req.params.id]);
    let owner_4 = owner_data_4.rows[0].user_id;
    res.render('new_question.ejs',{quiz_id: req.params.id,owner:owner_4})
})

app.post('/question_submit/:id',async (req,res) => {
    await db.query('insert into questions(quiz_id,question_text,marks) values($1,$2,$3);',[req.params.id,req.body.question_text,req.body.marks]);
    res.redirect('/quiz/'+req.params.id);
})

app.get('/question/:id',async (req,res) => {
    let quiz_id_data = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
    let quiz_id = quiz_id_data.rows[0].quiz_id;
    let owner_data_2 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
    let owner_2 = owner_data_2.rows[0].user_id;
    let question = await db.query('select question_text,marks,correct_option,input_type,correct_answer from questions where id=$1',[req.params.id])
    let option_data = await db.query('select * from options where question_id=$1',[req.params.id])
    // console.log(question.rows[0]);
    res.render('options.ejs',{question_data: question.rows[0],option_data:option_data.rows,question_id:req.params.id,quiz_id:quiz_id,owner:owner_2});
})

app.get('/add_option/:id',async (req,res)=> {
    let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
    let quiz_id = quiz_id_data_2.rows[0].quiz_id;
    let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
    let owner_3 = owner_data_3.rows[0].user_id;
    res.render('add_option.ejs',{quest_id:req.params.id,quiz_id:quiz_id,owner:owner_3})
})

app.post('/add_option/:id',async (req,res) => {
    let option_number = await db.query('select max(option_number) as max from options where question_id=$1;',[req.params.id])
    if (option_number.rows.length > 0) {
        if (option_number.rows[0].max !== null) {
            // console.log(option_number.rows)
            await db.query('Insert into options(option_number,question_id,option_text) values($1,$2,$3);',[option_number.rows[0].max+1,req.params.id,req.body.option_text]);
        }
        else {
            // console.log(1)
            await db.query('Insert into options(option_number,question_id,option_text) values($1,$2,$3);',[1,req.params.id,req.body.option_text]);
        }
    }
    else {
        // console.log(1)
        await db.query('Insert into options(option_number,question_id,option_text) values($1,$2,$3);',[1,req.params.id,req.body.option_text]);
    }
    
    res.redirect('/question/'+req.params.id)
})

app.post('/correct/:id',async (req,res) => {
    // console.log(req.body.correct_option)
    let options = [];
    let data_options = await db.query('select option_number from options where question_id = $1;',[req.params.id]);
    for (let i=0;i<data_options.rows.length;i++) {
        options.push(data_options.rows[i].option_number);
    }
    // console.log(options)
    // console.log(membership(options,req.body.correct_option))
    if (membership(options,req.body.correct_option)) {
        await db.query('update questions set correct_option=$1 where id=$2;',[req.body.correct_option,req.params.id]);
    }
    res.redirect('/question/'+req.params.id)
})

app.get('/form/:id',async(req,res) => {

    res.render('index.ejs',{signin: true,form_id:req.params.id});
})

app.get('/form/:id/:stud_id',async (req,res) => {
    let user_data = await db.query('select id from login_credentials;');
    // console.log(user_data)
    let users = [];
    for (let i=0;i<user_data.rows.length;i++) {
        users.push(user_data.rows[0].id);
    }
    // console.log(users)
    if (membership(users,req.params.stud_id)) {
        let quiz_data = await db.query('select * from quizzes where id=$1 and status = 0;',[req.params.id])
        if (quiz_data.rows.length > 0) {
            let quiz_name = quiz_data.rows[0].quiz_name;
            let quiz_id = quiz_data.rows[0].id;
            let questions_data = await db.query('select * from questions where quiz_id=$1 order by id;',[quiz_id]);
            questions_data = questions_data.rows;
            let questions = [];
            let marks = [];
            let options = [];
            let ids = [];
            let text_box = [];
            for (let i=0;i<questions_data.length;i++) {
                questions.push(questions_data[i].question_text);
                marks.push(questions_data[i].marks);
                ids.push(questions_data[i].id)
                text_box.push(questions_data[i].input_type);
                let options_data = await db.query('select * from options where question_id=$1 order by option_number;',[questions_data[i].id]);
                options_data = options_data.rows;
                let temp = [];
                for (let j=0;j<options_data.length;j++) {
                    temp.push(options_data[j].option_text);
                }
                options.push(temp);
            }
            res.render('form.ejs',{quiz_name:quiz_name,questions:questions,marks:marks,options:options,stud_id:req.params.stud_id,form_id:req.params.id,question_ids:ids,text_box:text_box});
        } else {
            res.send('Form doesn\'t exist');
        }
    } else {
        res.send('User not found.')
    }
})

app.post('/form-login/:form_id',async (req,res) => {
    let Username = req.body.username;
    let Password = md5(req.body.password);
    let data_obj = await db.query('select id,password from login_credentials where username = $1;',[Username])
    // console.log(data_obj)
    if (data_obj.rows.length != 0) {
        let data = data_obj.rows[0].password;
        let user_id = data_obj.rows[0].id;
        // console.log(user_id)
        if (data === Password) {
            res.redirect('/form/'+req.params.form_id+'/'+user_id)
        }
        else {
            res.redirect('/form/'+req.params.form_id)
        }
    }
    else {
        res.redirect('/form/'+req.params.form_id)
    }
    
})

app.post('/form-submit/:form_id/:stud_id',(req,res)=> {
    console.log(req.body)
    let qustions_ids = [];
    let option_selected = [];
    for (let i in req.body) {
        qustions_ids.push(i);
        option_selected.push(req.body[i]);
    }
    console.log(qustions_ids);
    console.log(option_selected);
    res.redirect('/form/'+req.params.form_id+'/'+req.params.stud_id);
})

app.get('/add-text-box/:quest_id',async (req,res) => {
    await db.query('update questions set input_type=1 where id=$1;',[req.params.quest_id]);
    await db.query('delete from options where question_id=$1;',[req.params.quest_id]);
    res.redirect('/question/'+req.params.quest_id)
})

app.post('/correct-answer/:quest_id',async (req,res)=> {
    let test = await db.query('update questions set correct_answer=$1 where id=$2;',[req.body.correct_answer,req.params.quest_id]);
    // console.log(test)
    res.redirect('/question/'+req.params.quest_id)
}) 

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});