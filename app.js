const express = require('express')
const app = express()
app.use(express.json())

const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const initializeserver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`DBError ${e.message}`)
    process.exit(1)
  }
}
initializeserver()

const convertstateObjectToResponseObj = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
const convertdistrictObjectToResponseObj = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.header['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(400)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payLoad) => {
      if (error) {
        response.status(400)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//POST API-01
app.post('/login/', authenticateToken, async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
  SELECT *
  FROM user WHERE 
  username='${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const ispasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (ispasswordMatched === true) {
      const payLoad = {
        username: username,
      }
      const jwtToken = jwt.sign(payLoad, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//GET API-02
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT * FROM state;`
  const stateArray = await db.get(getStatesQuery)
  response.send(
    stateArray.map(eachState => {
      convertstateObjectToResponseObj(eachState)
    }),
  )
})
//GET API-03
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `
  SELECT * FROM state WHERE
  state_id='${stateId}';`
  const state = await db.get(getStatesQuery)
  response.send(convertstateObjectToResponseObj(state))
})
// POST DISTRICT API-04
app.post('/districts/', authenticateToken, async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = request.body

  const addDistrictsQuery = `
  INSERT INTO 
  district
  ( state_id,district_name, cases, cured, active, deaths)
  VALUES
  (${stateId},'${districtName}','${cases}','${cured}','${active}','${deaths}');`
  await db.run(addDistrictsQuery)
  response.send('District Successfully Added')
})
//GET DISTRICT API-05
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT * FROM district 
  WHERE
  district_id=${districtId};`
    const districtArray = await db.get(getDistrictQuery)
    response.send(convertdistrictObjectToResponseObj(districtArray))
  },
)
// DELETE API-06
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `
  DELETE FROM district
  WHERE
  district_id=${districtId};`
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

//PUT API-07
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {stateId, districtName, cases, cured, active, deaths} = request.body
    const updateQuery = `
   UPDATE district
   SET 
   district_name='${districtName}',
   state_id='${stateId}',
   cases='${cases}',
   cured='${cured}',
   active='${active}',
   deaths='${deaths}'
   WHERE
   district_id='${districtId}';`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)
//GET API-08
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getstateQuery = `SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM
  state_id=${stateId};`
    const stats = await db.get(getstateQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totaldeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
