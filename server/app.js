import express from 'express'
import mysql from 'mysql'
import cors from 'cors'

const app = express();

app.listen(8082, ()=>{
    console.log("Listening...!!!!");
})