const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const knex = require('knex')

const database = knex({
	client: 'pg',
  //Removing connection details for git commit.
});

const app = express();

app.use(express.json());
app.use(cors());

//Main App
app.get('/', (req, res) => {
	res.send('Welcome to note_me!')
})


//Sign In
app.post('/signin', (req, res) => {
	const { email, password } = req.body;
	if (!email || !password) {
		return res.status(400).json('Invalid email or password')
	}
	else {
		database.select('email', 'hash').from('login')
		.where('email', '=' , email)
		.then(data => {
			const isValid = bcrypt.compareSync(password, data[0].hash);
			if(isValid) {
				return database.select('*').from('users')
				.where('email', '=', email)
				.then(user => {
					database.select('*').from('notes')
					.where('user_id', '=', user[0].id)
					.then(notes => {
						res.json({
							user: user[0],
							notes: notes
						})
					})
					.catch(err => res.status(400).json('Error getting notes'))
				})
				.catch(err => res.status(400).json('User not found!'))
			}
			else{
				res.status(400).json("Either email or password is wrong! Please try again.")
			}
		})
		.catch(err => res.status(400).json('Wrong credentials'))
	}	
})

//Notes default call
app.post('/note_me/:user_id', (req, res) => {
	const { user_id } = req.params;

	return database.select('*').from('notes')
		.where('user_id', '=', user_id)
		.then(notes => res.json({
			notes:notes
		}))
		.catch(err => res.status(400).json('Error fetching notes'))
})

//Sign Up 
app.post('/register', (req,res) => {
	const { firstname, lastname, email, password } = req.body;
	
	if (!email || !password || !firstname || !lastname) {
		return res.status(400).json('Incomplete information')
	}
	
	else {
		//Crypting the password with costFactor of 10
		const saltRounds = 10;
		const hash = bcrypt.hashSync(password, saltRounds);

		//Creating a knex transaction for populating users and login
		database.transaction(trx => {
			trx.insert({
				email: email,
				hash: hash,
			})
			.into('login')
			.returning('email')
			.then(loginEmail => {
				return trx('users')
					.returning('*')
					.insert({
						firstname: firstname,
						lastname: lastname,
						email: email,
						joined: new Date()
					})
					.then(user => {
						res.json(user[0])
					})
				})
			.then(trx.commit)
			.catch(trx.rollback)
		})
		.catch(err => res.status(400).json('Unable to register'))
	}
})

//New_Note
app.post('/new_note/:user_id', (req, res) => {
	const { note } = req.body;
	const { user_id } = req.params;

	return database('notes')
		.returning('*')
		.insert({
			user_id: user_id,
			note: note,
			date_created: new Date()
		})
		.then(new_note => res.json(new_note[0]))
		.catch(err => err.status(400).json('Error creating note'))
})


//Edit Note
app.put('/edit_note/:user_id', (req, res) => {
	const { note_id, note_rev } = req.body;
	const { user_id } = req.params;

	database('notes')
	.returning('*')
	.where({
		'user_id':user_id,
		'note_id':note_id
	})
	.update({note:note_rev})
	.then(note => res.json(note[0]))
	.catch(err => err.status(400).json('Unable to edit the note'))
})

//Delete note
app.delete('/del_note/:user_id', (req, res) => {
	const { note_id } = req.body;
	const { user_id } = req.params;

	database('notes')
	.returning('*')
	.where({
		'user_id': user_id,
		'note_id':note_id
	})
	.del()
	.then(note => res.json(note[0]))
	.catch(err => err.status(400).json('Unable to delete the note'))
})

//Listener
app.listen(process.env.PORT || 3000, () => {
	 console.log(`App has started on port ${process.env.PORT}`);
})


/*
main app --> GET --> Welcome message
sign in --> POST(!query) --> success/fail
register --> POST --> user{}
default notes loader for refresh --> POST --> notes{}
new_note --> POST --> notes{}
edit_note --> PUT --> notes{}
delete_note --> DELETE --> notes{}
*/
