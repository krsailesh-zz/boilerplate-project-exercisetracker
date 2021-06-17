require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { response } = require('express');

mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true, useNewUrlParser: true })
  .then(() => console.log('database connected...'))
  .catch(err => console.log(err));

app.use(cors())
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const userSchema = new mongoose.Schema({
  username: String,
  count: Number,
  log: [{
    description: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    date: String
  }]
})

const User = mongoose.model('User', userSchema);

app.post('/api/users', (req,res) => {
  const { username } = req.body;
  User.findOne({username})
    .then((data) => {
      if(data){
        return res.json("Username already taken");
      }

      const newUser = new User({
        username
      })

      newUser.save()
        .then((doc) => {
          return res.json({username: doc.username, _id: doc._id})
        })
        .catch(err => console.log(err));
    })
    .catch(err => console.log(err));
})

app.get('/api/users', (req,res) => {
  User.find()
    .select('_id username')
    .then((data) => {
      return res.json(data);
    })
    .catch(err => console.log(err));
})

app.post('/api/users/:_id/exercises', (req,res) => {
  const _id = req.params._id;
  let { description, duration, date } = req.body;
  if(!description || !duration){
    return res.json(`Path ${description?'duration':'description'} is required.`);
  }
  if(!date){
    date = new Date().toDateString();
  }else{
    if(new Date(date).toDateString()=='Invalid Date'){
      return res.json(`Cast to date failed for value ${date} at path date`)
    }

    date = new Date(date).toDateString();
  }
  if(duration.match(/[^0-9]/g)){
    return res.json(`Cast to Number failed for value ${duration} at path duration`)
  }
  duration = parseInt(duration);
  User.findByIdAndUpdate(
    _id,
    {$push: {"log": {description, duration, date}}, $inc: { count: 1 }},
    {new: true}
  )
    .then((data) => {
      if(!data){
        return res.json('unknown userId');
      }

      return res.json({
        _id,
        username: data.username,
        description,
        duration,
        date
      });
    })
    .catch(err => console.log(err));
})

app.get('/api/users/:_id/logs', (req,res) => {
  const { _id } = req.params;

  User.findById(_id)
    .then((data) => {
      if(!data){
        return res.json('Unkown userId');
      }
      if(!Object.keys(req.query).length){
        return res.json(data);
      }
      
      const { from, to } = req.query;
      const logArray = filterTheLogArray(data.log,req.query);
      let responseObj = {_id: data._id, 
                          username: data.username, 
                          count: logArray.length, 
                          log: logArray };
      
      if(from){
        responseObj = {...responseObj, from: new Date(from).toDateString()};
      }
      if(to){
        responseObj = {...responseObj, to: new Date(to).toDateString()};
      }
      return res.json(responseObj);
    })
    .catch(err => console.log(err));
})

const filterTheLogArray = (logArray, queryParam) => {
  let newArray = logArray;
  if(queryParam.from){
    newArray = logArray.filter((data) => {
      return new Date(queryParam.from) <= new Date(data.date);
    })
  }

  if(queryParam.to){
    newArray = logArray.filter((data) => {
      return new Date(queryParam.to) >= new Date(data.date);
    })
  }
  
  if(queryParam.limit < newArray.length){
    newArray = newArray.slice(0,queryParam.limit);
  }
  
  let arrWithoutId = [];
  newArray.forEach((data) => {
    arrWithoutId.push({
      description: data.description,
      duration: data.duration,
      date: data.date
    })
  })
  return arrWithoutId;
}



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
