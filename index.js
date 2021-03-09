const SESSION_SECRET = 'some-random-thing'
const DOMAIN = '127.0.0.1:4000'
const PROTOCOL = 'http'
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

const serverless = require('serverless-http');
const express = require('express')
const MMG = require('mmg-graph')
const moment = require('moment')
const AWS = require('aws-sdk')
const passport = require('passport');
const app = express()
const session = require('express-session');
const Signature = require('cookie-signature');
const isRunningLocally = !process.env.AWS_EXECUTION_ENV
const DynamoDBStore = require('connect-dynamodb')({
  session: session
});

const Dynamo = isRunningLocally? new AWS.DynamoDB({
    endpoint: new AWS.Endpoint('http://localhost:8000')
  }) : new AWS.DynamoDB()

app.use((req, res, next)=>{
  if (req.query.sessionId){
    req.query.sessionId = req.query.sessionId.replace(/\ /g, '+')
    req.headers['cookie'] = 'connect.sid=' + encodeURIComponent(req.query.sessionId) + '; Domain=.' + req.get('host') + '; Path=/; HttpOnly; Max-Age=2592000';
  }
  next()
})

app.use(session({
  store: new DynamoDBStore({
    // Optional DynamoDB table name, defaults to 'sessions'
    table: 'sessions',

    // Optional path to AWS credentials and configuration file
    // AWSConfigPath: './path/to/credentials.json',

    // Optional JSON object of AWS credentials and configuration

    // Optional client for alternate endpoint, such as DynamoDB Local
    client: isRunningLocally? new AWS.DynamoDB({
      endpoint: new AWS.Endpoint('http://localhost:8000')
    }) : null,

    // Optional ProvisionedThroughput params, defaults to 5
    readCapacityUnits: 25,
    writeCapacityUnits: 25
  }),
  secret: SESSION_SECRET,
}));

const path = require('path');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

passport.serializeUser((user, done) => {
  done(null, user.id)
});

passport.deserializeUser((req, id, done) => {
  done(null, {
    id: id
  })
})

app.use(passport.initialize());
app.use(passport.session());

const MMGClient = new MMG({
  CLIENT_ID: CLIENT_ID,
  CLIENT_SECRET: CLIENT_SECRET,
  REDIRECT_URI: `${PROTOCOL}://${DOMAIN}/auth`
})

app.get('/auth', async (req, res)=>{
  if (req.query.code){
    const access_token = await MMGClient.getAccessToken(req.query.code)
    
    MMGClient.ACCESS_TOKEN = access_token
    const params = {
      TableName: 'sessions',
      Item: {
        token: {
          'S': MMGClient.ACCESS_TOKEN
        },
        id : {
          'S' : req.query.state.split('?bid=')[1].split('&')[0]
        }
      }
    };
    await Dynamo.putItem(params).promise()
    res.redirect(req.query.state)
    return
  }
  res.send('You need to accept the permissions.')
})

const isAuthenticated = async (req, res, next) => {

  const authenticated = req.isAuthenticated()

  const bid = /[a-f0-9]{24}/.test(req.query.bid) && req.query.bid
  const uid = /[a-f0-9]{24}/.test(req.query.uid) && req.query.uid
  
  const params = {
    TableName: 'sessions',
    Key: {
      id : {
        S : bid
      }
    },
    ConsistentRead: true
  };
  
  const access_token = await Dynamo.getItem(params).promise()
  
  if (!Object.keys(access_token).length && uid){
    if (MMGClient.verifySignature(req.query)){
      req.logIn({
        id: uid
      }, () => {
        res.redirect(MMGClient.getAuthCodeUri('',`${req.originalUrl}&sessionId=${encodeURIComponent('s:' + Signature.sign(req.sessionID, SESSION_SECRET))}`))
      })
    }
    return
  }else{
    MMGClient.ACCESS_TOKEN = access_token.Item.token.S
  }
  
  

  if (!bid) {
    if (!authenticated) {
      res.send('bid is not sent.')
      return
    }
    next()
    return
  }

  //at this point, we know we have bid (we might be authenticated or not)

  if (MMGClient.verifySignature(req.query)) {
    req.logIn({
      id: uid
    }, () => {
      res.redirect(`${req.originalUrl}&sessionId=${encodeURIComponent('s:' + Signature.sign(req.sessionID, SESSION_SECRET))}`)
    })
    return
  }

  if (authenticated) {
    next()
    return
  }
  res.send('signature does not match')

}

app.get('/download', isAuthenticated, async(req, res) => {
  const response = await MMGClient.download_call({
    call_id: req.query.call_id
  },{
    resolveWithFullResponse: true
  })

  res.writeHead(200, {
    'Content-Type': response.headers['content-type'],
    'Content-disposition': response.headers['content-disposition']
  });
  res.end(response.data);
})


app.get('/admin', isAuthenticated, async (req, res,next)=>{
  const rangeBeg_m = (req.query.rangeBeg ? moment(parseInt(req.query.rangeBeg)) : moment().startOf('day'))
  const rangeEnd_m = (req.query.rangeEnd ? moment(parseInt(req.query.rangeEnd)) : moment().startOf('day')).add(1, 'day');

  const [leads, campaigns] = await Promise.all([
    MMGClient.get_leads({
      rangeBeg: rangeBeg_m.valueOf(),
      rangeEnd: rangeEnd_m.valueOf(),
    }).then(r => r.data),
    MMGClient.get_campaigns().then(r => r.data)
  ])

  res.render('admin', {
    leads,
    campaigns,
    bid: req.query.bid,
    moment,
    begDate: rangeBeg_m.format('L').toString(),
    endDate: rangeEnd_m.subtract(1, 'days').format('L').toString(),
    req,
    sessionId: encodeURIComponent(req.query.sessionId)
  })
})

module.exports.handler = serverless(app);
