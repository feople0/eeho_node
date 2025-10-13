const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');
require('dotenv').config();

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
  
router.get('/profile', async (req, res) => { // (개인 프로필 조회)
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
	let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(400).json({ ok: false, message: 'cannot find user' });

    const group_data = [];
    if(result_user.group)
        for (groupId of result_user.group) group_data.push(await req.app.db.collection('group').findOne({ _id: new ObjectId(groupId.groupId) }));
    
    try {
        delete result_user.pushToken, delete result_user.signDate;
        return res.status(200).json({ ok: true, data: result_user, group: group_data });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error, message: 'internal server error' });
    }

});

// 유저 id를 사용해서 유저 정보를 전부 조회하고 내려보내기
// post -> body { userId: "123" }
// user에 따라 접근 권한을 설정해야할 듯?
router.post('/user/info', async (req, res) => { // body : userId
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    // 1. req.body.userId => 사용해서 user 정보 조회하기.
    if (!(req.body.userId))
        return res.status(400).json({ ok: false, message: 'check your body again' });
    let result_find = await req.app.db.collection('user').findOne({ _id : new ObjectId(req.body.userId) }); //String에서 ObjectId로 형변환
    // 2. 조회한 data가 있으면 json형식으로 데이터 보내주기.
    if (!result_find)
        return res.status(400).json({ ok: false, message: 'cannot find user'});
    delete result_find._id, delete result_find.pushToken, delete result_find.signDate, delete result_find.boolean, delete result_find.PW;
    return res.status(200).json({ ok: true, userInformation: result_find });
    // 3. error handling.

});

// email 변경 -> 인증, PW 변경, 이미지 변경, userName 변경
// email 인증은 기존 user 회원가입 시 사용한 방식 사용 -> update 요청 보낼 때 찾아서 삭제하고 변경
const crypto = require('crypto');
const exp = require('constants');

function sha256Hash(input) {
  const hash = crypto.createHash('sha256');
  hash.update(input);
  return hash.digest('hex');
}

router.post('/account/update', upload.single('profileImg'), async (req, res) => { // userName, role, profileImg
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let user = await req.app.db.collection('user').findOne({ _id : new ObjectId(loginStatus.id) }); //String에서 ObjectId로 형변환
    
    try {
        if (req.file) user.profileImg = req.file.location;
        if (req.body.email) {
            let filter = { email: req.body.email, boolean: true };
            if (await req.app.db.collection('user').findOne(filter)) user.email = req.body.email;
            else return res.status(500).json({ ok: false, message: 'verify email first' });
            req.app.db.collection('user').deleteOne(filter);
        }
        if (req.body.PW) user.PW = sha256Hash(req.body.PW);
        if (req.body.userName) user.userName = req.body.userName;
        delete user._id, delete user.group, delete user.pushToken, delete user.signDate;
        
        await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, { $set: user });
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'internal server error', error: err });
    }
});

router.get('/account/delete', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(500).json({ ok: false, message: 'cannot find user' });
    for (groupId of result_user.group) {
        let result_group = await req.app.db.collection('group').findOne({ _id: new ObjectId(groupId.groupId) });
        if (!result_group)
            return res.status(500).json({ ok: false, message: 'cannot find group' });
        if ((result_group.groupCount) <= 1)
            req.app.db.collection('group').deleteOne({ _id: new ObjectId(groupId.groupId) });
        else {
            await req.app.db.collection('group').findOneAndUpdate({ _id: new ObjectId(groupId.groupId) }, {
                $pull: {
                    user: {
                        userId: new ObjectId(loginStatus.id)
                    }
                }
            });
            await req.app.db.collection('group').updateOne({ _id: new ObjectId(groupId.groupId) }, {
                $inc: {
                    groupCount: -1
                }
            });
        }
    }

    try {
        await req.app.db.collection('user').deleteOne({ _id: new ObjectId(loginStatus.id) });
        await req.app.db.collection('EEHO').deleteMany({ senderId: result_user._id });
        // receiverIds에서 user의 id 제거하기 추가. *****************************************************************************

        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, message: 'internal server error', error: err });
    }
});

router.get('/logout', async (req, res) => {
    let loginStatus = req.app.TokenUtils.verify(req.headers.token);
    console.log(loginStatus);
    if (!loginStatus)
        return res.status(400).json({ ok: false, message: 'accessToken is required' });
    let result_user = await req.app.db.collection('user').findOne({ _id: new ObjectId(loginStatus.id) });
    if (!result_user)
        return res.status(500).json({ ok: false, message: 'cannot find user' });

    try {
        await req.app.db.collection('user').updateOne({ _id: new ObjectId(loginStatus.id) }, { $set: { pushToken: null } });
        
        if(result_user.group)
            for (groupId of result_user.group) {
                let result_group = await req.app.db.collection('group').findOne({ _id: new ObjectId(groupId.groupId) });
                if (!result_group)
                    return res.status(500).json({ ok: false, message: 'cannot find group' });
                await req.app.db.collection('group').updateOne({ _id: new ObjectId(groupId.groupId) }, {
                    $set: {
                        "user.$[elem].pushToken": null
                    }
                }, { arrayFilters: [{ "elem.userId": new ObjectId(loginStatus.id) }] });
            }
        return res.status(200).json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false });
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

