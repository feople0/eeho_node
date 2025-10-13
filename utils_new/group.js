const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
require('dotenv').config();
// const app = express();

const multer = require('multer');
const multerS3 = require('multer-sharp-s3');
const { ObjectId } = require('mongodb');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: 'ap-northeast-2',
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        Bucket: 'eehoforum',
        ACL: 'private', // 액세스 권한 설정
        Key: (req, file, cb) => {
            // 파일 이름 설정
            var dateString = WhatTimeNow();
            cb(null, (dateString + file.originalname)); //업로드시 파일명 변경가능
        },
        resize: {
            width: 600
        },
        max: true, // 비율 유지
        format: 'jpeg', // 변경할 이미지 포맷
        quality: 90 // 이미지 품질
    })
});

router.post('/create', async (req, res) => { // (가족이름) (groupName)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user) return res.status(500).json({ ok: false, message: 'cannot find user' });
    let dateToday = new Date();
    if (!(req.body.groupName)) return res.status(400).json({ ok: false, message: 'check your body' });
    
    if (result_user.group) return res.status(500).json({ ok: false, message: 'Already exist group' });
    var data = { userId: result_user._id, userName: result_user.userName, profileImg: result_user.profileImg, pushToken: result_user.pushToken, signDate: dateToday, };
    var groupData = { groupName: req.body.groupName, groupCount: 1, createDate: dateToday, user: [data] };
    let result_insert = await req.app.db.collection('group').insertOne(groupData);
    
    if (!result_insert) return res.status(500).json({ ok: false, message: "cannot insert group data" });
    try {
        await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, { $push: { group: { groupId: result_insert.insertedId, groupName: req.body.groupName }  } });
        
        var bin = parseInt((String(result_insert.insertedId)).slice(-10), 16);
        let groupCode = (String(bin)).slice(-10);
        // let familyCode = (String(result_insert.insertedId)).slice(-8);
        await req.app.db.collection('group').updateOne({ _id: result_insert.insertedId }, { $set: { code: groupCode } });
        
        return res.status(200).json({ ok: true, code: groupCode, groupName: req.body.groupName });
    } catch (error) {
        return res.status(500).json({ ok: false, message: 'internal sever error', error: error });
    }
});

router.post('/code/isExisted', async (req, res) => { // (코드) (code)
    if (!req.body.code)
        return res.status(400).json({ ok: false, message: 'no_data' });
    let result_find = await req.app.db.collection('group').findOne({ code: req.body.code });
    if (result_find) return res.status(200).json({ ok: true });
    else return res.status(500).json({ ok: false, message: 'wrong' });
});

router.post('/participate', async (req, res) => { // (코드) (code)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus) return res.status(500).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user) return res.status(500).json({ ok: false, message: 'cannot find user' });
    if (!(req.body.code))
        return res.status(400).json({ ok: false, message: 'check your body again' });
    let result_find = await req.app.db.collection('group').findOne({ code: req.body.code });
    
    if (result_user.group) return res.status(500).json({ ok: false, message: 'Already exist group' });
    if(result_find) {
        let checkName = ((result_find.user).find(item => (item.userId.toString() === (result_user._id).toString())));
        if (checkName)
            return res.status(500).json({ ok: false, message: "duplicate" });
        else {
            try {
                let dateToday = new Date();
                var data = { userId: result_user._id, userName: result_user.userName, profileImg: result_user.profileImg, pushToken: result_user.pushToken, signDate: dateToday, };
                await req.app.db.collection('group').updateOne({ code: req.body.code }, { $push: { user: { $each: [data] } }, $inc: { groupCount: 1 } });
                await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, { $push: { group: { groupId: result_find._id, groupName: result_find.groupName } } });
                // return res.status(200).json({ ok : true, token : accessToken, familyName : result_find.familyName, profileImg : fileLocation });
            } catch (error) {
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
        
            var pushText = `${result_user.userName}님이 ${result_find.groupName}에 참여했습니다.`;
            req.app.notificationUtils(somePushTokens, pushText); // senderId를 넣었다 쳐. 사람 별로 조회가 왜 없어
    
            try {
                for(const receiver of pushReceiver) {
                    await req.app.db.collection('notification').insertOne({
                        date: new Date(),
                        receiverId: receiver,
                        text: pushText
                    });
                }
                
                return res.status(200).json({
                    ok: true,
                    groupName: result_find.groupName,
                });
            } catch (error) {
                return res.status(500).json({ ok: false, message: "notification internal server error", error : error });
            }
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
