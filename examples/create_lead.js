const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
const MMG = require('mmg-graph')

const MMGClient = new MMG({
  CLIENT_ID: CLIENT_ID,
  CLIENT_SECRET: CLIENT_SECRET,
  BASE_URL : BASE_URL,
  ALLOW_SECRET_AUTH : true
})

MMGClient.post_lead({
  bid : 'valid bid'
},{
  body : {
    campaign_id : 'valid campaign_id',
    first_name : 'some name'
  }
}).then(x=>{
  console.log(x)
})



