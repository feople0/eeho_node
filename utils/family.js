const express = require('express');
// const app = express();
const router = express.Router();
// const path = require('path');

router.post('/member/login', async (req, res) => { // (가족이름, 사용자이름) (familyName, userName)
    let result_family = await req.app.db.collection('family').findOne({ familyName : req.body.familyName });
    if(result_family) {
        console.log(result_family);
        let result_find = await req.app.db.collection('user_login').findOne({ userName : req.body.userName, familyId : result_family._id });
        if(result_find) {
            const accessToken = req.app.TokenUtils.makeToken({ id: String(result_find._id) });
            return res.status(200).json({ message : "login success", token : accessToken });
        } else {
            res.status(500).send({ message : 'non-existent userName!!!'});
        }
    } else {
        res.status(500).send({ message : 'non-existent familyName!!!'});
    }
});

router.post('/create', async (req, res) => { // (가족이름, 사용자이름, 구성역할) (familyName, userName, familyRule)
    let result_find = await req.app.db.collection('family').findOne({ familyName : req.body.familyName });
    if(!(result_find)) {
        let dateToday = new Date();
        let result_user = await req.app.db.collection('user_login').insertOne({ userName : req.body.userName, signDate : dateToday });
        // console.log(result_user);
        let result_insert = await req.app.db.collection('family').insertOne({ familyName : req.body.familyName, user : [{ userId : result_user.insertedId, userName : req.body.userName, rule : req.body.familyRule }] });
        // console.log(result_insert);
        await req.app.db.collection('user_login').updateOne({ userName : req.body.userName, signDate : dateToday }, { $set: {familyId : result_insert.insertedId} });
        res.status(200).send({ message : '성공했습니다!' });
    } else {
        res.status(500).send({ message : 'Duplicated familyName'});
    }
});

router.post('/participate', async (req, res) => { // (가족이름, 사용자이름, 구성역할) (familyName, userName, familyRule)
    let result_find = await req.app.db.collection('family').findOne({ familyName : req.body.familyName });
    if(result_find) {
        let dateToday = new Date();
        let result_user = await req.app.db.collection('user_login').insertOne({ userName : req.body.userName, signDate : dateToday });
        await req.app.db.collection('family').updateOne({ familyName : req.body.familyName }, { $push: { user: { $each: [{ userId : result_user.insertedId, userName : req.body.userName, rule : req.body.familyRule }] } } });
        // console.log(result_find)
        await req.app.db.collection('user_login').updateOne({ userName : req.body.userName, signDate : dateToday }, { $set: {familyId : result_find._id} });
        res.status(200).send({ message : '성공했습니다!' });
    } else {
        res.status(500).send({ message : 'non-existent familyName!!!' });
    }
});

module.exports = router;
