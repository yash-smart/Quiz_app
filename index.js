import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import md5 from "md5";
import env from "dotenv"
import session from "express-session";
import cookieParser from "cookie-parser";
env.config();

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: { 
    secure: false, 
    maxAge: 3600000
} // Set secure to true in production with HTTPS
}));

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

async function check_membership (quest_id,user_id) {
    try {
        
        let data = await db.query('select * from marks where quest_id = $1 and user_id=$2;',[quest_id,user_id]);
        // console.log(data)
        if (quest_id == '1' && user_id == '1') {
            console.log(data.rows)   
        }
        if (data.rows.length == 0) {
            return false;
        } else {
            return data.rows[0].awarded_marks;
        }
    } catch {
        return false;
    }
}

async function generate_marks(quiz_id) {
    let data = await db.query('select * from marks where quest_id in (select id from questions where quiz_id = $1);',[quiz_id]);
    let obj = {}
    for (let i=0;i<data.rows.length;i++) {
        obj[data.rows[i].quest_id + ':' + data.rows[i].user_id] = data.rows[i].awarded_marks;
    }
    return obj;
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
            req.session.user = user_id;
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
    try {
        let quizzes_obj = await db.query('select * from quizzes where user_id = $1 order by status,id;',[req.params.id])
        // console.log(quizzes_obj.rows)
        if (req.session.user == req.params.id) {
            res.render('main.ejs',{data: quizzes_obj.rows,id: req.params.id})
        } else {
            res.send("Unauthorized")
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/register',async (req,res) => {
    let Username = req.body.username;
    let Password = md5(req.body.password);
    let user_data = await db.query('select username from login_credentials;')
    let users_exist = false;
    for (let i=0;i<user_data.rows.length;i++) {
        if (user_data.rows[i].username == Username) {
            users_exist = true;
        }
    }
    console.log(users_exist)
    if (users_exist == false) {
        await db.query('insert into login_credentials(username,password) values($1,$2)',[Username,Password])
        res.redirect('/')
    } else {
        res.render('index.ejs',{users_exist:true})
    }
})

app.get('/add_quiz/:id',(req,res) => {
    if (req.session.user == req.params.id) {
        res.render('add quiz.ejs',{id:req.params.id})
    } else {
        res.send('Unauthorized')
    }
})

app.post('/add_quiz/:id',async (req,res) => {
    try {
        if (req.session.user == req.params.id) {
            await db.query('Insert into quizzes(user_id,quiz_name,status) values($1,$2,0);',[req.params.id,req.body.quiz_name]);
            res.redirect('/main/'+req.params.id)
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.get('/quiz/:id',async (req,res) => {
    try {
        let owner_data = await db.query('select user_id,status from quizzes where id = $1;',[req.params.id]);
        let login_details = await db.query('select * from login_credentials;');
        login_details = login_details.rows;
        let owner = owner_data.rows[0].user_id;
        console.log(owner)
        console.log(req.session.user)
        if (req.session.user == owner) {
            let responses_data = await db.query('select * from responses where form_id = $1 order by user_id;',[req.params.id]);
            let responses = [];
            let user_id = [];
            for (let i=0;i<responses_data.rows.length;i++) {
                let response = responses_data.rows[i]
                if (membership(user_id,response.user_id)) {
                    for (let j=0;j<responses.length;j++) {
                        for (let k in responses[j]) {
                            if (k == response.user_id) {
                                responses[j][k]['questions'].push(response.question_id)
                                if (response.option_answer == null) {
                                    responses[j][k]['answer'].push(response.text_answer);
                                } else {
                                    responses[j][k]['answer'].push(response.option_answer);
                                }
                                // user_id.push(response.user_id)
                                // break; 
                            }
                        }
                        // break;
                    }
                } else {
                    let object_temp = {}
                    let object_temp2 = {}
                    object_temp2['questions'] = [response.question_id]
                    if (response.option_answer == null) {
                        object_temp2['answer'] = [response.text_answer]
                    } else {
                        object_temp2['answer'] = [response.option_answer]
                    }
                    object_temp[response.user_id] = object_temp2
                    // console.log(object_temp)
                    responses.push(object_temp)
                    user_id.push(response.user_id)
                }
            }
            // console.log(responses)
            for (let j=0;j<responses.length;j++) {
                console.log(responses[j])
            }
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
            let marks_data = await generate_marks(req.params.id)
            res.render('Question.ejs',{question_data: quiz_questions,quiz_id: req.params.id,options: options,owner:owner,status: owner_data.rows[0].status,responses:responses,login_details:login_details,marks_data:marks_data});
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL');
    }
})

app.get('/new-question/:id',async (req,res) => {
    try {
        let owner_data_4 = await db.query('select user_id from quizzes where id = $1;',[req.params.id]);
        let owner_4 = owner_data_4.rows[0].user_id;
        if (req.session.user == owner_4) {
            res.render('new_question.ejs',{quiz_id: req.params.id,owner:owner_4})
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/question_submit/:id',async (req,res) => {
    try {
        let owner_data_4 = await db.query('select user_id from quizzes where id = $1;',[req.params.id]);
        let owner_4 = owner_data_4.rows[0].user_id;
        if (req.session.user == owner_4) {
            try {
                await db.query('insert into questions(quiz_id,question_text,marks,min_marks) values($1,$2,$3,$4);',[req.params.id,req.body.question_text,req.body.marks,req.body.min_marks]);
                res.redirect('/quiz/'+req.params.id);
            } catch(err) {
                console.log(err)
                res.send('Invalid entry in fields');
            }
        } else {
            res.send('Unauthorized')
        }
    } catch(err) {
        res.send('Invalid URL')
    }
})

app.get('/question/:id',async (req,res) => {
    try {
        let quiz_id_data = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
        let quiz_id = quiz_id_data.rows[0].quiz_id;
        let owner_data_2 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_2 = owner_data_2.rows[0].user_id;
        let question = await db.query('select question_text,marks,correct_option,input_type,correct_answer from questions where id=$1',[req.params.id])
        let option_data = await db.query('select * from options where question_id=$1',[req.params.id])
        // console.log(question.rows[0]);
        if (req.session.user == owner_2) {
            res.render('options.ejs',{question_data: question.rows[0],option_data:option_data.rows,question_id:req.params.id,quiz_id:quiz_id,owner:owner_2});
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.get('/add_option/:id',async (req,res)=> {
    try {
        let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
        let quiz_id = quiz_id_data_2.rows[0].quiz_id;
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
            res.render('add_option.ejs',{quest_id:req.params.id,quiz_id:quiz_id,owner:owner_3})
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/add_option/:id',async (req,res) => {
    try {
        let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
        let quiz_id = quiz_id_data_2.rows[0].quiz_id;
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
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

        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/correct/:id',async (req,res) => {
    // console.log(req.body.correct_option)
    try {
        let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.id])
        let quiz_id = quiz_id_data_2.rows[0].quiz_id;
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
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
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL');
    }
})

app.get('/form/:id',async(req,res) => {
    if (req.session.user == null) {
        res.render('index.ejs',{signin: true,form_id:req.params.id});
    } else {
        res.redirect('/form/'+req.params.id+'/'+req.session.user)
    }
})

app.get('/form/:id/:stud_id',async (req,res) => {
    try {
        console.log(req.params.stud_id)
        console.log(req.session.user)
        if (req.session.user == req.params.stud_id) {
            let user_data = await db.query('select id from login_credentials;');
        // console.log(user_data)
            let users = [];
            for (let i=0;i<user_data.rows.length;i++) {
                users.push(user_data.rows[i].id);
            }
            if (membership(users,req.params.stud_id)) {
                let quiz_data = await db.query('select * from quizzes where id=$1 and status = 0;',[req.params.id])
                let submitted_data = await db.query('select user_id from responses where form_id = $1;',[req.params.id])
                let submitted = null;
                for (let i=0;i<submitted_data.rows.length;i++) {
                    if (submitted_data.rows[i].user_id == req.params.stud_id) {
                        submitted = true;
                    }
                }
                if (submitted == null) {
                    submitted = false;
                }
                // console.log(submitted)
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
                    res.render('form.ejs',{quiz_name:quiz_name,questions:questions,marks:marks,options:options,stud_id:req.params.stud_id,form_id:req.params.id,question_ids:ids,text_box:text_box,submitted:submitted});
                } else {
                    if (submitted == true) {
                        res.render('form.ejs',{submitted: true})
                    } else {
                        res.send('Form doesn\'t exist');
                    }
                }
            } else {
                res.send('User not found.')
            }
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
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
            req.session.user = user_id;
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

app.post('/form-submit/:form_id/:stud_id',async (req,res)=> {
    try {
        if (req.session.user == req.params.stud_id) {
            let quiz_data_4 = await db.query('select status from quizzes where id=$1;',[req.params.form_id]);
            if (quiz_data_4.rows[0].status == 0) {
                console.log(req.body)
                let questions_ids = [];
                let option_selected = [];
                let input_type = [];
                for (let i in req.body) {
                    questions_ids.push(i);
                    let data = await db.query('select input_type from questions where id=$1;',[i])
                    input_type.push(data.rows[0].input_type);
                    option_selected.push(req.body[i]);
                }
                console.log(questions_ids);
                console.log(option_selected);
                console.log(input_type)
                for (let i=0;i<questions_ids.length;i++) {
                    if (input_type[i] == null) {
                        await db.query('insert into responses(user_id,question_id,option_answer,text_answer,form_id) values($1,$2,$3,null,$4);',[req.params.stud_id,questions_ids[i],option_selected[i],req.params.form_id])
                    } else {
                        await db.query('insert into responses(user_id,question_id,option_answer,text_answer,form_id) values($1,$2,null,$3,$4);',[req.params.stud_id,questions_ids[i],option_selected[i],req.params.form_id])
                    }
                }
            }
            res.redirect('/form/'+req.params.form_id+'/'+req.params.stud_id);
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.get('/add-text-box/:quest_id',async (req,res) => {
    try {
        let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.quest_id])
        let quiz_id = quiz_id_data_2.rows[0].quiz_id;
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
            await db.query('update questions set input_type=1 where id=$1;',[req.params.quest_id]);
            await db.query('delete from options where question_id=$1;',[req.params.quest_id]);
            res.redirect('/question/'+req.params.quest_id)
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/correct-answer/:quest_id',async (req,res)=> {
    try {
        let quiz_id_data_2 = await db.query('select quiz_id from questions where id=$1;',[req.params.quest_id])
        let quiz_id = quiz_id_data_2.rows[0].quiz_id;
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
            let test = await db.query('update questions set correct_answer=$1 where id=$2;',[req.body.correct_answer,req.params.quest_id]);
            // console.log(test)
            res.redirect('/question/'+req.params.quest_id)
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }
}) 

app.get('/form-register/:form_id',(req,res) => {
    res.render('register.ejs',{form: true,form_id: req.params.form_id})
})

app.post('/form-register/:form_id',async (req,res) => {
    let Username = req.body.username;
    let Password = md5(req.body.password);
    let user_data = await db.query('select username from login_credentials;')
    let users_exist = false;
    for (let i=0;i<user_data.rows.length;i++) {
        if (user_data.rows[i].username == Username) {
            users_exist = true;
        }
    }
    console.log(users_exist)
    if (users_exist == false) {
        await db.query('insert into login_credentials(username,password) values($1,$2)',[Username,Password])
        res.redirect('/form/'+req.params.form_id)
    } else {
        res.render('index.ejs',{users_exist:true,signin:true,form_id: req.params.form_id})
    }
})

app.get('/status-update/:quiz_id',async (req,res) => {
    try {
        let owner_data_3 = await db.query('select user_id from quizzes where id = $1;',[req.params.quiz_id]);
        let owner_3 = owner_data_3.rows[0].user_id;
        if (req.session.user == owner_3) {
            let quiz_data_3 = await db.query('select status from quizzes where id=$1;',[req.params.quiz_id]);
            if (quiz_data_3.rows[0].status == 1) {
                await db.query('update quizzes set status=0 where id =$1;',[req.params.quiz_id])
            }
            else {
                await db.query('update quizzes set status=1 where id =$1;',[req.params.quiz_id])
            }
            res.redirect('/quiz/'+req.params.quiz_id)
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL');
    }
});

app.post('/marks-submit/:id',async (req,res) => {
    try {
        let owner_data = await db.query('select user_id,status from quizzes where id = $1;',[req.params.id]);
        // console.log(owner_data.rows[0].user_id)
        // console.log()
        if (owner_data.rows[0].user_id == req.session.user) {
            console.log(req.body)
            for (let i in req.body) {
                // console.log(await check_membership(i.split(':')[0],i.split(':')[1]))
                if (await check_membership(i.split(':')[0],i.split(':')[1]) === false) {
                    try {
                        await db.query('insert into marks values ($1,$2,$3);',[i.split(':')[0],i.split(':')[1],req.body[i]]);
                        console.log([i.split(':')[0],i.split(':')[1]])
                        console.log('Not found')
                    } catch(err) {
                        console.log(err)
                    }
                } else {
                    try {
                        await db.query('update marks set awarded_marks=$1 where quest_id=$2 and user_id=$3;',[req.body[i],i.split(':')[0],i.split(':')[1]]);
                        console.log([req.body[i],i.split(':')[0],i.split(':')[1]])
                        console.log('else')
                    } catch(err) {
                        console.log(err)
                    }
                }
            }
            res.redirect('/quiz/'+req.params.id)
        } else {
            res.send('Unauthorised')
        }
    } catch {
        res.send('Invalid URL')
    }
})

app.post('/delete_question/:quest_id',async (req,res) => {
    try {
        let quiz_id_data = await db.query('select quiz_id from questions where id=$1;',[req.params.quest_id])
        let quiz_id = quiz_id_data.rows[0].quiz_id;
        let owner_data_2 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_2 = owner_data_2.rows[0].user_id;
        if (req.session.user == owner_2) {
            await db.query('delete from options where question_id=$1;',[req.params.quest_id]);
            await db.query('delete from responses where question_id=$1;',[req.params.quest_id]);
            await db.query('delete from marks where quest_id=$1;',[req.params.quest_id]);
            await db.query('delete from questions where id=$1',[req.params.quest_id]);
            res.redirect('/quiz/'+quiz_id)
        } else {
            res.send('Unauthorised')
        }
    } catch(err) {
        console.log(err)
        res.send('Invalid URL')
    }
})

app.get('/update/:quest_id',async (req,res) => {
    try {
        // let question_data = await db.query('select * from questions ')
        let quiz_id_data = await db.query('select * from questions where id=$1;',[req.params.quest_id])
        let quiz_id = quiz_id_data.rows[0].quiz_id;
        let owner_data_2 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_2 = owner_data_2.rows[0].user_id;
        if (req.session.user == owner_2) {
            res.render('new_question.ejs',{quest_id:req.params.quest_id,owner:owner_2,update:true,quiz_id:quiz_id,question_data:quiz_id_data.rows[0]})
        } else {
            res.send('Unauthorised')
        }
    }catch {
        res.send('Invalid URL.')
    }
    
})

app.post('/update_quest/:quest_id',async (req,res) => {
    try {
        let quiz_id_data = await db.query('select quiz_id from questions where id=$1;',[req.params.quest_id])
        let quiz_id = quiz_id_data.rows[0].quiz_id;
        let owner_data_2 = await db.query('select user_id from quizzes where id = $1;',[quiz_id]);
        let owner_2 = owner_data_2.rows[0].user_id;
        if (req.session.user == owner_2) {
            await db.query('update questions set question_text=$1,marks=$2,min_marks=$3 where id=$4;',[req.body.question_text,req.body.marks,req.body.min_marks,req.params.quest_id]);
            res.redirect('/question/'+req.params.quest_id)
        } else {
            res.send('Unauthorized')
        }
    } catch {
        res.send('Invalid URL')
    }  
})
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});