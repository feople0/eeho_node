const express = require('express');
// const app = express();
const router = express.Router();
// const path = require('path');

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = new S3Client({
  region : 'ap-northeast-2',
  credentials : {
      accessKeyId : process.env.AWS_KEY,
      secretAccessKey : process.env.AWS_SECRET
  }
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'eehoforum',
        key: function (req, file, cb) {
            ext = path.extname(file.originalname);
            console.log("ext : " + ext);
            // if(ext !== '.png' && ext !== '.JPG' && ext !== '.jpg') {
            //     return callback(new Error('PNG, JPG만 업로드하세요'))
            // }
            // console.log(dateString);
            cb(null, file.originalname); //업로드시 파일명 변경가능
        }
    })
});

router.post('/member/login', async (req, res) => { // (가족이름, 사용자이름) (familyName, userName)
    console.log(req.body.familyName);
    if (!req.body.familyName) return res.status(500).json({ ok: false, message: 'you should put your familyName' });
    let result_family = await req.app.db.collection('family').findOne({ familyName : req.body.familyName });
    if(result_family) {
        console.log(result_family);
        if (!req.body.userName) return res.status(500).json({ ok: false, message: 'you should put your userName' });
        let result_find = await req.app.db.collection('user').findOne({ userName : req.body.userName, familyId : result_family._id });
        if(result_find) {
            const accessToken = req.app.TokenUtils.makeToken({ id: String(result_find._id) });
            return res.status(200).json({ ok: true, token : accessToken });
        } else {
            return res.status(500).send({ ok: false, message: 'non-existent userName!!!' });
        }
    } else {
        return res.status(500).send({ ok: false, message: 'non-existent familyName!!!' });
    }
});

router.post('/create', upload.single("profile"), async (req, res) => { // (가족이름, 사용자이름, 구성역할, 이미지) (familyName, userName, familyRole, profile)
    let dateToday = new Date();
    
    let fileLocation = 'https://eehoforum.s3.ap-northeast-2.amazonaws.com/basic-profile-img.png';
    if (req.file) fileLocation = (req.file.location);
    if (!(req.body.userName && req.body.pushToken && req.body.familyName && req.body.familyRole)) return res.status(500).json({ ok: false, message: 'check your body, userName, pushToken, familyName, and familyRole' });
    let result_user = await req.app.db.collection('user').insertOne({ userName : req.body.userName, signDate : dateToday, pushToken : req.body.pushToken });
    
    if (!result_user) return res.status(500).json({ ok: false, message: "cannot insert user data" });
    let result_insert = await req.app.db.collection('family').insertOne({ familyName : req.body.familyName, familyCount : 1, user : [{ userId : result_user.insertedId, userName : req.body.userName, role : req.body.familyRole, profileImg : fileLocation, pushToken : req.body.pushToken }] });
    
    if (!result_insert) return res.status(500).json({ ok: false, message: "cannot insert family data" });
    try {
        await req.app.db.collection('user').updateOne({ userName: req.body.userName, signDate: dateToday }, { $set: { familyId: result_insert.insertedId } });
        
        let familyCode = (String(result_insert.insertedId)).slice(-8);
        await req.app.db.collection('family').updateOne({ _id: result_insert.insertedId }, { $set: { code: familyCode } });
        
        const accessToken = req.app.TokenUtils.makeToken({ id: String(result_user.insertedId) });
        return res.status(200).send({ ok : true, code : familyCode, token : accessToken });
    } catch (error) {
        return res.status(500).send({ ok: false, message: 'internal sever error', error: error });
    }
});

router.post('/code/isExisted', async (req, res) => { // (코드) (code)
    if (!req.body.code) return res.status(500).json({ ok: false, message: 'code is required' });
    let result_find = await req.app.db.collection('family').findOne({ code: req.body.code });
    if (result_find) {
        if (result_find.familyCount >= 5) return res.status(500).json({ ok: false, message: "더이상 사용할 수 없음. 다섯명 넘어버림 ㅋ" });
        return res.status(200).json({ ok: true });
    }
    else return res.status(500).json({ ok: false });
});

router.post('/participate', upload.single("profile"), async (req, res) => { // (코드, 사용자이름, 구성역할, 이미지) (code, userName, familyRole, profile)
    console.log('participate');
    console.log(req.body.code);
    console.log(req.body.userName);
    console.log(req.body.familyRole);
    console.log(req.body.pushToken);
    if (!(req.body.code && req.body.userName && req.body.familyRole)) return res.status(500).json({ ok: false, message: 'check your body again' });
    let result_find = await req.app.db.collection('family').findOne({ code: req.body.code });
    if(result_find) {
        if (result_find.familyCount >= 5) return res.status(500).json({ ok: false, message: "더이상 사용할 수 없음. 다섯명 넘어버림 ㅋ" });
        let dateToday = new Date();
        let fileLocation = 'https://eehoforum.s3.ap-northeast-2.amazonaws.com/basic-profile-img.png';
        if(req.file) fileLocation = (req.file.location);
        let result_user = await req.app.db.collection('user').insertOne({ userName : req.body.userName, signDate : dateToday, pushToken : req.body.pushToken });
        if (!result_user) return res.status(500).json({ ok: false, message: "cannot insert user data" });
        try {
            await req.app.db.collection('family').updateOne({ code: req.body.code }, { $push: { user: { $each: [{ userId: result_user.insertedId, userName: req.body.userName, role: req.body.familyRole, profileImg: fileLocation, pushToken : req.body.pushToken }] } } });
            await req.app.db.collection('user').updateOne({ userName: req.body.userName, signDate: dateToday }, { $set: { familyId: result_find._id } });
            await req.app.db.collection('family').updateOne({ _id : result_find._id }, { $inc : {familyCount : 1}});
            const accessToken = req.app.TokenUtils.makeToken({ id: String(result_user.insertedId) });
            return res.status(200).send({ ok : true, token : accessToken, familyName : result_find.familyName });
        } catch(error) {
            return res.status(500).send({ ok: false, message: 'internal sever error', error: error });
        }
        // console.log(result_find)
    } else {
        return res.status(500).send({ ok: false, message : 'non-existent code!!!' });
    }
});

module.exports = router;
