const express = require('express');
// const app = express();
const router = express.Router();
const path = require('path');

const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { ObjectId } = require('mongodb');
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
            var dateString = WhatTimeNow();
            cb(null, (dateString + file.originalname)); //업로드시 파일명 변경가능
        }
    })
});

router.post('/member/login', async (req, res) => { // (가족이름, 사용자이름) (familyName, userName)
    if (!req.body.familyName)
        return res.status(400).json({ ok: false, message: 'you should put your familyName' });
    let result_family = await req.app.db.collection('family').findOne({ familyName : req.body.familyName });
    if(result_family) {
        if (!req.body.userName)
            return res.status(400).json({ ok: false, message: 'you should put your userName' });
        let result_find = await req.app.db.collection('user').findOne({
            userName: req.body.userName,
            familyId: result_family._id
        });
        if(result_find) {
            const accessToken = req.app.TokenUtils.makeToken({ id: String(result_find._id) });
            return res.status(200).json({ ok: true, token : accessToken });
        } else {
            return res.status(500).json({ ok: false, message: 'non-existent userName!!!' });
        }
    } else {
        return res.status(500).json({ ok: false, message: 'non-existent familyName!!!' });
    }
});

router.post('/create', upload.single("profile"), async (req, res) => { // (가족이름, 사용자이름, 구성역할, 이미지, 푸시토큰) (familyName, userName, role, profile, pushToken)
    console.log('create 접근');
    let dateToday = new Date();
    let fileLocation = process.env.Domain_Link + '/image/basic-profile-img.png';
    if (req.file) fileLocation = (req.file.location);
    console.log(req.body);
    if (!(req.body.userName && req.body.familyName && req.body.role))
        return res.status(400).json({ ok: false, message: 'check your body' });
    let result_user = await req.app.db.collection('user').insertOne({
        userName: req.body.userName,
        signDate: dateToday, pushToken: req.body.pushToken
    });
    
    if (!result_user)
        return res.status(500).json({ ok: false, message: "cannot insert user data" });
    const replacedString = (fileLocation).replace(process.env.AWS_Link, process.env.Domain_Link + '/image/');
    let result_insert = await req.app.db.collection('family').insertOne({
        familyName: req.body.familyName,
        familyCount: 1,
        user: [{
            userId: result_user.insertedId,
            userName: req.body.userName,
            role: req.body.role,
            profileImg: replacedString,
            pushToken: req.body.pushToken
        }]
    });
    
    if (!result_insert)
        return res.status(500).json({ ok: false, message: "cannot insert family data" });
    try {
        await req.app.db.collection('user').updateOne({ userName: req.body.userName, signDate: dateToday }, { $set: { familyId: result_insert.insertedId } });
        
        let familyCode = (String(result_insert.insertedId)).slice(-8);
        await req.app.db.collection('family').updateOne({
            _id: result_insert.insertedId
        }, {
            $set: {
                code: familyCode
            }
        });
        
        const accessToken = req.app.TokenUtils.makeToken({ id: String(result_user.insertedId) });
        return res.status(200).json({
            ok: true,
            id: result_user.insertedId,
            code: familyCode,
            token: accessToken
        });
    } catch (error) {
        return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
    }
});

router.post('/code/isExisted', async (req, res) => { // (코드) (code)
    if (!req.body.code)
        return res.status(400).json({ ok: false, message: 'code is required' });
    let result_find = await req.app.db.collection('family').findOne({ code: req.body.code });
    if (result_find) {
        if (result_find.familyCount >= 5)
            return res.status(400).json({ ok: false, message: "한 가족 당 최대 사용자 수는 다섯명입니다." });
        return res.status(200).json({ ok: true });
    }
    else
        return res.status(500).json({ ok: false, message: 'wrong approach' });
});

router.post('/participate', upload.single("profile"), async (req, res) => { // (코드, 사용자이름, 구성역할, 이미지, 푸시토큰) (code, userName, role, profile, pushToken)
    if (!(req.body.code && req.body.userName && req.body.role))
        return res.status(400).json({ ok: false, message: 'check your body again' });
    let result_find = await req.app.db.collection('family').findOne({ code: req.body.code });
    
    if(result_find) {
        if (result_find.familyCount >= 5)
            return res.status(400).json({ ok: false, message: "한 가족 당 최대 사용자 수는 다섯명입니다." });
        let dateToday = new Date();
        let fileLocation = process.env.Domain_Link + '/image/basic-profile-img.png';
        if(req.file) fileLocation = (req.file.location);
        let result_user = await req.app.db.collection('user').insertOne({
            userName: req.body.userName,
            signDate: dateToday,
            pushToken: req.body.pushToken,
            familyId: result_find._id
        });
        if (!result_user)
            return res.status(500).json({ ok: false, message: "cannot insert user data" });
        try {
            const replacedString = (fileLocation).replace(process.env.AWS_Link, process.env.Domain_Link + '/image/');
            await req.app.db.collection('family').updateOne({ code: req.body.code }, {
                $push: {
                    user: {
                        $each: [{
                            userId: result_user.insertedId,
                            userName: req.body.userName,
                            role: req.body.role,
                            profileImg: replacedString,
                            pushToken: req.body.pushToken
                        }]
                    }
                }
            });
            await req.app.db.collection('family').updateOne({ code: req.body.code }, {
                $inc: {
                    familyCount: 1
                }
            });
            // return res.status(200).json({ ok : true, token : accessToken, familyName : result_find.familyName, profileImg : fileLocation });
        } catch(error) {
            return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
        }
        
        // 3. DB 저장.
        // id, date, body, senderId, text
        const pushReceiver = [];
        const somePushTokens = [];
        for (let i = 0; i < (result_find.user).length; i++) {
            pushReceiver.push(result_find.user[i].userId);
            if (result_find.user[i].pushToken) somePushTokens.push(result_find.user[i].pushToken);
        }
    
        var pushText = `${req.body.userName}님이 ${result_find.familyName}에 참여했습니다.`;
        req.app.notificationUtils(somePushTokens, pushText); // senderId를 넣었다 쳐. 사람 별로 조회가 왜 없어

        try {
            for(const receiver of pushReceiver) {
                await req.app.db.collection('notification').insertOne({
                    date: new Date(),
                    receiverId: receiver,
                    text: pushText
                });
            }
            const accessToken = req.app.TokenUtils.makeToken({ id: String(result_user.insertedId) });
            return res.status(200).json({
                ok: true,
                id: result_user.insertedId,
                token: accessToken,
                familyName: result_find.familyName,
                profileImg: fileLocation
            });
        } catch (error) {
            return res.status(500).json({ ok: false, message: "notification internal server error", error : error });
        }
    } else {
        return res.status(500).json({ ok: false, message : 'non-existent code!!!' });
    }
});

/** 현재 시간 구하기 위한 함수. */
function WhatTimeNow() { 
    var date = new Date();
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var dateNum = date.getDate();
    var hour = date.getHours();
    var min = date.getMinutes();
    var sec = date.getSeconds();
    var milsec = date.getMilliseconds();

    var dateString = year;
    if(month < 10) dateString += "0";
    dateString += String(month);
    if(dateNum < 10) dateString += "0";
    dateString += String(dateNum) + "_";
    if(hour < 10) dateString += "0";
    dateString += String(hour);
    if(min < 10) dateString += "0";
    dateString += String(min);
    if(sec < 10) dateString += "0";
    dateString += String(sec);
    if(milsec < 10) dateString += "00";
    else if(milsec < 100) dateString += "0";
    dateString += String(milsec) + "__";

    return dateString;
}

module.exports = router;
